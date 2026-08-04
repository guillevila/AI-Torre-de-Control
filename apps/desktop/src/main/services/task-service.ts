import { randomUUID } from 'node:crypto'
import {
  changeStatusInputSchema,
  DEFAULT_SETTINGS,
  localEventSchema,
  taskIdSchema,
  type EventIngestResult,
  type RecentActivityEntry,
  type Settings,
  type StatusHistoryEntry,
  type Task,
  type TaskStatus,
} from '@torre/contracts'
import { applyStatusChange, applyTaskUpdate, createTask } from '@torre/domain'
import type { TaskRepository } from '../db/task-repository.js'

/**
 * Error con un mensaje pensado para enseñárselo al usuario tal cual.
 *
 * La interfaz no debe inventarse explicaciones: si algo se rechaza, el motivo
 * viene de aquí, escrito en lenguaje normal.
 */
export class TaskServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskServiceError'
  }
}

export interface TaskServiceDeps {
  repository: TaskRepository
  /** Inyectables para que los tests no dependan del reloj ni del azar. */
  now?: () => string
  newId?: () => string
  /** Ajustes vigentes. Se lee en cada uso para que los cambios apliquen ya. */
  settings?: () => Settings
  /**
   * Se llama en CADA cambio real de estado, con `notify` indicando si ese
   * cambio merecía interrumpir al usuario.
   *
   * Se avisa también de los que NO interrumpen porque quien escucha necesita
   * enterarse de todos: un aviso pendiente de «te espera» deja de tener sentido
   * en cuanto la tarea se mueve a otro sitio.
   */
  onStatusChange?: (task: Task, previousStatus: TaskStatus, notify: boolean) => void
  /** Se llama tras cualquier cambio, con la lista completa ya actualizada. */
  onChange?: (tasks: Task[]) => void
}

/** Estados que se avisan, y el ajuste que los gobierna. */
const NOTIFY_SETTING: Partial<Record<TaskStatus, keyof Settings>> = {
  waiting_user: 'notifyWaitingUser',
  completed: 'notifyCompleted',
  failed: 'notifyFailed',
}

/**
 * Toda operación sobre tareas pasa por aquí.
 *
 * Ni la interfaz ni el receptor de eventos hablan con la base de datos ni con la
 * máquina de estados directamente. Este servicio es el único que sabe coserlo
 * todo: validar la entrada, pedir la decisión al dominio, guardar el resultado,
 * dejar constancia en el historial, avisar si toca y publicar el estado nuevo.
 */
export class TaskService {
  private readonly repository: TaskRepository
  private readonly now: () => string
  private readonly newId: () => string
  private readonly settings: () => Settings
  private readonly onStatusChange: (task: Task, previousStatus: TaskStatus, notify: boolean) => void
  private readonly onChange: (tasks: Task[]) => void

  constructor(deps: TaskServiceDeps) {
    this.repository = deps.repository
    this.now = deps.now ?? (() => new Date().toISOString())
    this.newId = deps.newId ?? (() => randomUUID())
    this.settings = deps.settings ?? (() => DEFAULT_SETTINGS)
    this.onStatusChange = deps.onStatusChange ?? (() => {})
    this.onChange = deps.onChange ?? (() => {})
  }

  list(): Task[] {
    return this.repository.list()
  }

  getById(id: string): Task | null {
    return this.repository.findById(id)
  }

  history(rawId: unknown): StatusHistoryEntry[] {
    const id = taskIdSchema.parse(rawId)
    return this.repository.historyFor(id)
  }

  recentActivity(limit: number): RecentActivityEntry[] {
    return this.repository.recentActivity(limit)
  }

  create(rawInput: unknown): Task {
    let task: Task
    try {
      task = createTask(rawInput, { id: this.newId(), now: this.now() })
    } catch (error) {
      throw new TaskServiceError(describeValidationError(error))
    }

    this.repository.save(task)
    // Primera línea del historial: de la nada al estado con el que nace.
    this.repository.appendHistory({
      taskId: task.id,
      fromStatus: null,
      toStatus: task.status,
      source: task.statusSource,
      confidence: task.statusConfidence,
      at: task.createdAt,
    })
    this.publish()
    return task
  }

  update(rawInput: unknown): Task {
    const id = this.requireId(rawInput)
    const existing = this.requireTask(id)

    let updated: Task
    try {
      updated = applyTaskUpdate(existing, rawInput, this.now())
    } catch (error) {
      throw new TaskServiceError(describeValidationError(error))
    }
    this.repository.save(updated)
    this.publish()
    return updated
  }

  /**
   * Cambia el estado de una tarea. Único camino posible, venga de donde venga
   * el cambio: un botón, un evento local o una integración futura.
   */
  changeStatus(rawInput: unknown): Task {
    const parsed = changeStatusInputSchema.safeParse(rawInput)
    if (!parsed.success) throw new TaskServiceError(describeValidationError(parsed.error))

    const existing = this.requireTask(parsed.data.id)
    const result = this.transition(existing, {
      status: parsed.data.status,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
    })

    if (!result.ok) throw new TaskServiceError(result.message)
    this.publish()
    return result.task
  }

  /** Atajo para el botón de archivar de la interfaz. */
  archive(rawId: unknown): Task {
    const id = taskIdSchema.parse(rawId)
    return this.changeStatus({ id, status: 'archived', source: 'manual', confidence: 'high' })
  }

  /** Borrado definitivo. Se lleva por delante el historial de la tarea. */
  remove(rawId: unknown): void {
    const id = taskIdSchema.parse(rawId)
    this.requireTask(id)
    this.repository.remove(id)
    this.publish()
  }

  /**
   * Entrada de eventos del receptor local.
   *
   * Devuelve un resultado en lugar de lanzar excepciones porque quien llama es
   * un servidor HTTP que debe contestar siempre, también cuando el evento es
   * basura.
   */
  ingestEvent(rawEvent: unknown): EventIngestResult {
    const parsed = localEventSchema.safeParse(rawEvent)
    if (!parsed.success) {
      return {
        accepted: false,
        reason: 'El evento no cumple el contrato',
        details: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || 'evento'}: ${issue.message}`,
        ),
      }
    }

    const event = parsed.data
    const existing = this.repository.findById(event.taskId)
    if (!existing) {
      return { accepted: false, reason: `No existe ninguna tarea con id "${event.taskId}"` }
    }

    const result = this.transition(existing, {
      status: event.status,
      source: event.source,
      confidence: event.confidence,
    })
    if (!result.ok) return { accepted: false, reason: result.message }

    this.publish()
    return { accepted: true, taskId: result.task.id, status: result.task.status }
  }

  /**
   * Pasa a «sin confirmar» las tareas automáticas que llevan demasiado tiempo
   * sin dar señales (D9).
   *
   * Deliberadamente NO toca lo que fijaste a mano. Si tú dijiste que algo está
   * trabajando, la aplicación te cree hasta que otra cosa diga lo contrario:
   * sin integraciones instaladas, lo contrario sería marcar como dudoso todo lo
   * que registras, media hora después de registrarlo.
   *
   * Devuelve cuántas tareas ha movido.
   */
  sweepStale(): number {
    const minutes = this.settings().staleAfterMinutes
    if (minutes <= 0) return 0

    const nowIso = this.now()
    const cutoff = Date.parse(nowIso) - minutes * 60_000
    let moved = 0

    for (const task of this.repository.list()) {
      if (task.status !== 'running' && task.status !== 'queued') continue
      if (task.statusSource === 'manual') continue
      if (Date.parse(task.lastActivityAt) > cutoff) continue

      // Se conserva la última fuente conocida —es la última que dijo algo— y se
      // baja la confianza. La interfaz explica que no se puede confirmar.
      const result = this.transition(task, {
        status: 'unknown',
        source: task.statusSource,
        confidence: 'low',
      })
      if (result.ok) moved += 1
    }

    if (moved > 0) this.publish()
    return moved
  }

  // ─── Interno ───────────────────────────────────────────────────────────────

  /**
   * El paso común de todo cambio de estado: dominio → guardar → historial →
   * aviso. No publica: eso lo decide quien llama, para poder agrupar cambios.
   */
  private transition(
    task: Task,
    change: { status: TaskStatus; source: Task['statusSource']; confidence: Task['statusConfidence'] },
  ): { ok: true; task: Task } | { ok: false; message: string } {
    const previousStatus = task.status
    const now = this.now()

    const result = applyStatusChange(task, { ...change, now })
    if (!result.ok) return { ok: false, message: result.message }

    this.repository.save(result.task)

    // Solo se anota en el historial lo que de verdad cambió de estado: repetir
    // el mismo estado llenaría la ficha de ruido sin aportar nada.
    if (result.changed) {
      this.repository.appendHistory({
        taskId: result.task.id,
        fromStatus: previousStatus,
        toStatus: result.task.status,
        source: result.task.statusSource,
        confidence: result.task.statusConfidence,
        at: now,
      })
    }

    if (result.changed) {
      const notify = result.notify && this.notificationEnabled(result.task.status)
      this.onStatusChange(result.task, previousStatus, notify)
    }

    return { ok: true, task: result.task }
  }

  private notificationEnabled(status: TaskStatus): boolean {
    const key = NOTIFY_SETTING[status]
    return key ? this.settings()[key] === true : false
  }

  private requireId(rawInput: unknown): string {
    const id = (rawInput as { id?: unknown } | null)?.id
    const parsed = taskIdSchema.safeParse(id)
    if (!parsed.success) throw new TaskServiceError('Falta el identificador de la tarea.')
    return parsed.data
  }

  private requireTask(id: string): Task {
    const task = this.repository.findById(id)
    if (!task) throw new TaskServiceError(`No existe ninguna tarea con id "${id}".`)
    return task
  }

  private publish(): void {
    this.onChange(this.repository.list())
  }
}

/** Traduce un error de validación a una frase que el usuario pueda entender. */
function describeValidationError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: { path: (string | number)[]; message: string }[] }).issues
    const first = issues[0]
    if (first) {
      const field = first.path.join('.')
      return field ? `${field}: ${first.message}` : first.message
    }
  }
  return error instanceof Error ? error.message : 'Datos no válidos.'
}
