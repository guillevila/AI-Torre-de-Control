import {
  taskReplyInputSchema,
  turnRequestSchema,
  type Task,
  type TurnResolution,
} from '@torre/contracts'
import type { HookActivityLog } from '../hooks/hook-activity-log.js'
import type { SessionLinker } from '../hooks/session-linker.js'
import type { TaskService } from '../services/task-service.js'
import type { TurnRegistry } from './turn-registry.js'

/**
 * «Responder desde la Torre», versión sin caducidad (D25-bis).
 *
 * La tarjeta de un turno se queda hasta que el dueño actúe:
 *
 *  - **Responder** con la sesión aún sostenida → el texto entra por la misma
 *    sesión (el hook devuelve `decision: block`).
 *  - **Responder** con el turno ya cerrado → la Torre RELANZA la conversación
 *    (`claude --resume`) con el texto. Continúa con otro identificador; la
 *    tarea libera el suyo para que la adopte la continuación.
 *  - **Dar por vista** → la tarea pasa a «revisada» (el reposo de D22), desde
 *    donde siempre se puede volver a contestar por la ficha.
 */
export interface TurnServiceDeps {
  registry: TurnRegistry
  linker: SessionLinker
  taskService: TaskService
  activity?: HookActivityLog
  /** Cuánto sostiene el hook la sesión. 0 = función apagada (sin tarjetas). */
  holdMs: () => number
  /** Relanza una conversación. Inyectable para probarlo sin lanzar nada. */
  resume: (cwd: string, sessionId: string, text: string) => boolean
  now?: () => string
}

export class TurnService {
  private readonly registry: TurnRegistry
  private readonly linker: SessionLinker
  private readonly tasks: TaskService
  private readonly activity: HookActivityLog | undefined
  private readonly holdMs: () => number
  private readonly resume: (cwd: string, sessionId: string, text: string) => boolean
  private readonly now: () => string

  constructor(deps: TurnServiceDeps) {
    this.registry = deps.registry
    this.linker = deps.linker
    this.tasks = deps.taskService
    this.activity = deps.activity
    this.holdMs = deps.holdMs
    this.resume = deps.resume
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  async request(raw: unknown): Promise<TurnResolution> {
    const parsed = turnRequestSchema.safeParse(raw)
    if (!parsed.success) return { action: 'pass' }

    const hold = this.holdMs()
    if (hold <= 0) return { action: 'pass' }

    const input = parsed.data
    const task = this.linker.resolve(input.cwd, input.sessionId)

    // En la actividad se anota el HECHO, jamás la respuesta del asistente
    // (D5-ter): esa solo vive en la tarjeta.
    this.activity?.record({
      event: 'turno terminado',
      cwd: input.cwd,
      accepted: true,
      detail: 'la tarjeta espera tu respuesta en la Torre',
      taskTitle: task.title,
    })

    return this.registry.awaitHold(
      {
        requestId: input.requestId,
        taskId: task.id,
        taskTitle: task.title,
        sessionTitle: task.sessionTitle,
        output: input.output,
        // Un enlace sin actualizar no manda los pasos; la tarjeta enseña
        // entonces solo el texto, como antes de D26-quater.
        steps: input.steps ?? [],
        cwd: input.cwd,
        requestedAt: this.now(),
      },
      hold,
    )
  }

  /** La decisión del dueño sobre una tarjeta. Devuelve false si ya no existe. */
  decide(requestId: string, action: 'reply' | 'review', text?: string): boolean {
    const turn = this.registry.get(requestId)
    if (!turn) return false
    const task = this.tasks.list().find((candidate) => candidate.id === turn.taskId) ?? null

    if (action === 'review') {
      this.markReviewed(task)
      this.registry.settle(requestId, { action: 'pass' })
      return true
    }

    const limpio = (text ?? '').trim()
    if (!limpio) return false

    if (this.registry.isHeld(requestId)) {
      // La sesión sigue sostenida: el texto entra por la misma sesión.
      this.moveTo(task, 'running', 'claude_hook')
      this.registry.settle(requestId, { action: 'reply', text: limpio })
      return true
    }

    // El turno ya terminó: se relanza la conversación con el texto.
    const ok = this.replyByResume(task, turn.cwd, limpio)
    if (ok) this.registry.settle(requestId, { action: 'pass' })
    return ok
  }

  /** Contestar desde la ficha, sin tarjeta (una tarea revisada, por ejemplo). */
  replyToTask(raw: unknown): boolean {
    const parsed = taskReplyInputSchema.safeParse(raw)
    if (!parsed.success) return false
    const task = this.tasks.list().find((candidate) => candidate.id === parsed.data.taskId) ?? null
    if (!task?.projectPath) return false
    return this.replyByResume(task, task.projectPath, parsed.data.text)
  }

  private replyByResume(task: Task | null, cwd: string, text: string): boolean {
    const sessionId = task?.externalSessionId
    if (!task || !sessionId) return false
    if (!this.resume(cwd, sessionId, text)) return false

    // La continuación llegará con OTRO identificador: se libera el de la tarea
    // para que la primera señal de la continuación la adopte, no cree otra.
    try {
      this.tasks.update({ id: task.id, externalSessionId: null, sessionEnded: false })
    } catch {
      /* si no se puede, la adopción por carpeta sigue teniendo opciones */
    }
    this.moveTo(task, 'running', 'manual')
    this.activity?.record({
      event: 'conversación relanzada',
      cwd,
      accepted: true,
      detail: 'tu respuesta retoma la conversación',
      taskTitle: task.title,
    })
    return true
  }

  private markReviewed(task: Task | null): void {
    if (!task) return
    // «Revisada» solo existe desde terminada/fallida: si la tarjeta estaba
    // sostenida la tarea aún trabajaba, así que se pasa por «terminada» antes.
    if (!['completed', 'failed', 'reviewed'].includes(task.status)) {
      this.moveTo(task, 'completed', 'manual')
    }
    if (task.status !== 'reviewed') this.moveTo(task, 'reviewed', 'manual')
  }

  private moveTo(task: Task | null, status: 'running' | 'completed' | 'reviewed', source: 'manual' | 'claude_hook'): void {
    if (!task) return
    try {
      this.tasks.changeStatus({ id: task.id, status, source, confidence: 'high' })
    } catch {
      // Una transición rechazada no debe tumbar la decisión del dueño.
    }
  }
}
