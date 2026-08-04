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
 *
 * **Excepción: modo desatendido (D24).** Si el ajuste `autoApprovePermissions`
 * está encendido, los pasos 2 y 3 se saltan: la Torre contesta «sí» al momento y
 * la tarea sigue trabajando. Es el único caso en que la aplicación decide en
 * lugar del usuario, y por eso queda listado en la actividad del enlace.
 */
export interface PermissionServiceDeps {
  registry: PermissionRegistry
  linker: SessionLinker
  taskService: TaskService
  activity?: HookActivityLog
  now?: () => string
  /**
   * Si la Torre debe aprobar sola (D24). Se lee en cada petición, no una vez al
   * arrancar: apagar el interruptor tiene efecto en la siguiente petición, sin
   * reiniciar nada.
   */
  autoApprove?: () => boolean
}

export class PermissionService {
  private readonly registry: PermissionRegistry
  private readonly linker: SessionLinker
  private readonly tasks: TaskService
  private readonly activity: HookActivityLog | undefined
  private readonly now: () => string
  private readonly autoApprove: () => boolean

  constructor(deps: PermissionServiceDeps) {
    this.registry = deps.registry
    this.linker = deps.linker
    this.tasks = deps.taskService
    this.activity = deps.activity
    this.now = deps.now ?? (() => new Date().toISOString())
    // Por omisión NO aprueba sola. Un servicio construido sin este parámetro se
    // comporta como antes de D24, que es lo que debe pasar.
    this.autoApprove = deps.autoApprove ?? (() => false)
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

    // ── Modo desatendido (D24) ────────────────────────────────────────────────
    // Se comprueba ANTES de tocar el estado de la tarea. Si la Torre va a decir
    // «sí» al momento, nadie está esperando: pasar por «te espera» dispararía un
    // aviso de Windows por cada permiso, que con un asistente trabajando son
    // decenas por minuto. La tarea sigue trabajando, que es la verdad.
    if (this.autoApprove()) {
      this.activity?.record({
        event: `permiso · ${input.toolName}`,
        cwd: input.cwd,
        accepted: true,
        // El comando entero, igual que en la tarjeta: si la Torre aprueba por ti,
        // como mínimo tienes que poder ver qué aprobó. El registro vive en
        // memoria y se pierde al cerrar, así que esto no rompe D20.
        detail: `aprobado solo · ${input.detail}`,
        taskTitle: task.title,
      })
      this.moveTo(task.id, 'running')
      return {
        outcome: 'allow',
        reason: 'Aprobado automáticamente por la Torre (modo desatendido, D24).',
      }
    }

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
