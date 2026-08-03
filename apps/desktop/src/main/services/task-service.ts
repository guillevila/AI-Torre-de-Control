import { randomUUID } from 'node:crypto'
import {
  changeStatusInputSchema,
  localEventSchema,
  taskIdSchema,
  type EventIngestResult,
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
  /** Se llama cuando un cambio merece interrumpir al usuario. */
  onNotify?: (task: Task, previousStatus: TaskStatus) => void
  /** Se llama tras cualquier cambio, con la lista completa ya actualizada. */
  onChange?: (tasks: Task[]) => void
}

/**
 * Toda operación sobre tareas pasa por aquí.
 *
 * Ni la interfaz ni el receptor de eventos hablan con la base de datos ni con la
 * máquina de estados directamente. Este servicio es el único que sabe coserlo
 * todo: validar la entrada, pedir la decisión al dominio, guardar el resultado,
 * avisar si toca y publicar el estado nuevo.
 */
export class TaskService {
  private readonly repository: TaskRepository
  private readonly now: () => string
  private readonly newId: () => string
  private readonly onNotify: (task: Task, previousStatus: TaskStatus) => void
  private readonly onChange: (tasks: Task[]) => void

  constructor(deps: TaskServiceDeps) {
    this.repository = deps.repository
    this.now = deps.now ?? (() => new Date().toISOString())
    this.newId = deps.newId ?? (() => randomUUID())
    this.onNotify = deps.onNotify ?? (() => {})
    this.onChange = deps.onChange ?? (() => {})
  }

  list(): Task[] {
    return this.repository.list()
  }

  getById(id: string): Task | null {
    return this.repository.findById(id)
  }

  create(rawInput: unknown): Task {
    let task: Task
    try {
      task = createTask(rawInput, { id: this.newId(), now: this.now() })
    } catch (error) {
      throw new TaskServiceError(describeValidationError(error))
    }
    this.repository.save(task)
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
    if (!parsed.success) {
      throw new TaskServiceError(describeValidationError(parsed.error))
    }

    const existing = this.requireTask(parsed.data.id)
    const previousStatus = existing.status

    const result = applyStatusChange(existing, {
      status: parsed.data.status,
      source: parsed.data.source,
      confidence: parsed.data.confidence,
      now: this.now(),
    })

    if (!result.ok) throw new TaskServiceError(result.message)

    this.repository.save(result.task)
    if (result.notify) this.onNotify(result.task, previousStatus)
    this.publish()
    return result.task
  }

  /** Atajo para el botón de archivar de la interfaz. */
  archive(rawId: unknown): Task {
    const id = taskIdSchema.parse(rawId)
    return this.changeStatus({ id, status: 'archived', source: 'manual', confidence: 'high' })
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

    const previousStatus = existing.status
    const result = applyStatusChange(existing, {
      status: event.status,
      source: event.source,
      confidence: event.confidence,
      now: this.now(),
    })

    if (!result.ok) {
      return { accepted: false, reason: result.message }
    }

    this.repository.save(result.task)
    if (result.notify) this.onNotify(result.task, previousStatus)
    this.publish()
    return { accepted: true, taskId: result.task.id, status: result.task.status }
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
