import { turnRequestSchema, type TurnResolution } from '@torre/contracts'
import type { HookActivityLog } from '../hooks/hook-activity-log.js'
import type { SessionLinker } from '../hooks/session-linker.js'
import type { TaskService } from '../services/task-service.js'
import type { TurnRegistry } from './turn-registry.js'

/**
 * Atiende el fin de un turno de Claude Code y decide si el dueño quiere
 * contestar desde la Torre (D25).
 *
 * Con la función apagada (ventana = 0) responde `pass` al instante y el enlace
 * sigue su camino de siempre. Encendida, la tarjeta aparece y se espera el
 * tiempo configurado.
 *
 * Si el dueño contesta, la tarea vuelve a «trabajando» —la conversación sigue—
 * y el texto viaja al enlace, que reengancha la sesión. La Torre no redacta
 * nada: transmite lo que el dueño tecleó, o no transmite nada (D18).
 */
export interface TurnServiceDeps {
  registry: TurnRegistry
  linker: SessionLinker
  taskService: TaskService
  activity?: HookActivityLog
  /** Ventana de respuesta vigente, en milisegundos. 0 = apagado. */
  windowMs: () => number
  now?: () => string
}

export class TurnService {
  private readonly registry: TurnRegistry
  private readonly linker: SessionLinker
  private readonly tasks: TaskService
  private readonly activity: HookActivityLog | undefined
  private readonly windowMs: () => number
  private readonly now: () => string

  constructor(deps: TurnServiceDeps) {
    this.registry = deps.registry
    this.linker = deps.linker
    this.tasks = deps.taskService
    this.activity = deps.activity
    this.windowMs = deps.windowMs
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  async request(raw: unknown): Promise<TurnResolution> {
    const parsed = turnRequestSchema.safeParse(raw)
    if (!parsed.success) {
      // Malformado → pass: el enlace cae a su comportamiento normal.
      this.activity?.record({
        event: 'turno mal formado',
        cwd: '—',
        accepted: false,
        detail: parsed.error.issues[0]?.message ?? 'datos no válidos',
        taskTitle: null,
      })
      return { action: 'pass' }
    }

    const ventana = this.windowMs()
    if (ventana <= 0) return { action: 'pass' }

    const input = parsed.data
    const task = this.linker.resolve(input.cwd, input.sessionId)

    // En la ventana de actividad se anota el HECHO, nunca la respuesta del
    // asistente: esa solo vive en la tarjeta (D5-ter).
    this.activity?.record({
      event: 'turno terminado',
      cwd: input.cwd,
      accepted: true,
      detail: 'esperando por si contestas desde la Torre',
      taskTitle: task.title,
    })

    const resolution = await this.registry.await(
      {
        requestId: input.requestId,
        taskId: task.id,
        taskTitle: task.title,
        sessionTitle: task.sessionTitle,
        output: input.output,
        cwd: input.cwd,
        requestedAt: this.now(),
      },
      ventana,
    )

    if (resolution.action === 'reply') {
      // La conversación sigue: la tarea vuelve a trabajar sin pasar por la
      // mesa de entregas. Si la máquina de estados lo rechaza, el texto viaja
      // igualmente — el estado es contexto; tu respuesta es lo urgente.
      try {
        this.tasks.changeStatus({
          id: task.id,
          status: 'running',
          source: 'claude_hook',
          confidence: 'high',
        })
      } catch {
        /* ver arriba */
      }
      this.activity?.record({
        event: 'turno respondido',
        cwd: input.cwd,
        accepted: true,
        detail: 'tu respuesta viajó a la sesión y la conversación continúa',
        taskTitle: task.title,
      })
    }

    return resolution
  }

  decide(requestId: string, resolution: TurnResolution): boolean {
    return this.registry.decide(requestId, resolution)
  }
}
