import {
  permissionRequestSchema,
  type PermissionDecision,
  type PermissionResolution,
} from '@torre/contracts'
import type { HookActivityLog } from '../hooks/hook-activity-log.js'
import type { SessionLinker } from '../hooks/session-linker.js'
import type { TaskService } from '../services/task-service.js'
import type { PermissionRegistry } from './permission-registry.js'

/**
 * Convierte una petición de permiso de una herramienta en algo que puedas ver y
 * decidir (D18-bis).
 *
 * Lo que hace, por orden:
 *  1. Encuentra a qué tarea pertenece la sesión —o crea una si es la primera vez.
 *  2. Pone esa tarea en «te espera», lo que dispara la notificación del sistema.
 *  3. Se queda esperando tu clic.
 *  4. Devuelve tu decisión a la herramienta y deja la tarea trabajando otra vez.
 *
 * Si nadie decide, el registro resuelve `timeout` y la herramienta pregunta por
 * su vía normal (D21). En ese caso la tarea se queda en «te espera», porque es
 * la verdad: sigue esperándote, solo que en la terminal.
 */
export interface PermissionServiceDeps {
  registry: PermissionRegistry
  linker: SessionLinker
  taskService: TaskService
  activity?: HookActivityLog
  now?: () => string
}

export class PermissionService {
  private readonly registry: PermissionRegistry
  private readonly linker: SessionLinker
  private readonly tasks: TaskService
  private readonly activity: HookActivityLog | undefined
  private readonly now: () => string

  constructor(deps: PermissionServiceDeps) {
    this.registry = deps.registry
    this.linker = deps.linker
    this.tasks = deps.taskService
    this.activity = deps.activity
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  /**
   * Atiende una petición. La promesa no se resuelve hasta que el usuario decide
   * o se agota el tiempo, porque quien llama —el receptor HTTP— mantiene la
   * conexión abierta esperando.
   */
  async request(raw: unknown): Promise<PermissionResolution> {
    const parsed = permissionRequestSchema.safeParse(raw)
    if (!parsed.success) {
      // Ante una petición mal formada se devuelve `timeout`, no un error: así la
      // herramienta cae a su comportamiento normal en vez de quedarse colgada.
      const reason = `Petición mal formada: ${parsed.error.issues[0]?.message ?? 'datos no válidos'}`
      this.activity?.record({
        event: 'permiso mal formado',
        cwd: '—',
        accepted: false,
        detail: reason,
        taskTitle: null,
      })
      return { outcome: 'timeout', reason }
    }

    const input = parsed.data
    const task = this.linker.resolve(input.cwd, input.sessionId)
    this.activity?.record({
      event: `permiso · ${input.toolName}`,
      cwd: input.cwd,
      accepted: true,
      detail: 'esperando tu decisión',
      taskTitle: task.title,
    })

    // La tarea pasa a «te espera»: eso es lo que dispara el aviso de Windows.
    this.moveTo(task.id, 'waiting_user')

    const resolution = await this.registry.await({
      requestId: input.requestId,
      taskId: task.id,
      taskTitle: task.title,
      toolName: input.toolName,
      detail: input.detail,
      cwd: input.cwd,
      requestedAt: this.now(),
    })

    // Decidido: la sesión sigue trabajando. Si caducó, se queda esperándote —
    // porque es cierto: te está esperando, solo que en la terminal.
    if (resolution.outcome !== 'timeout') this.moveTo(task.id, 'running')

    this.activity?.record({
      event: `permiso · ${input.toolName}`,
      cwd: input.cwd,
      accepted: resolution.outcome !== 'timeout',
      detail:
        resolution.outcome === 'allow'
          ? 'lo aceptaste'
          : resolution.outcome === 'deny'
            ? 'lo rechazaste'
            : 'se agotó el tiempo; Claude Code preguntó por su cuenta',
      taskTitle: task.title,
    })

    return resolution
  }

  decide(requestId: string, decision: PermissionDecision): boolean {
    return this.registry.decide(requestId, decision)
  }

  private moveTo(taskId: string, status: 'waiting_user' | 'running'): void {
    try {
      this.tasks.changeStatus({ id: taskId, status, source: 'claude_hook', confidence: 'high' })
    } catch {
      // Una transición rechazada por la máquina de estados no debe impedir que
      // el permiso llegue a la pantalla. El estado es contexto; el permiso es
      // lo urgente.
    }
  }
}
