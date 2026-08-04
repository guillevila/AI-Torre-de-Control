import {
  PERMISSION_TIMEOUT_MS,
  type PendingPermission,
  type PermissionDecision,
  type PermissionResolution,
} from '@torre/contracts'

/**
 * Registro de permisos que esperan una decisión tuya.
 *
 * **Vive solo en memoria (D20).** No toca la base de datos, no entra en el
 * historial y desaparece al cerrar la aplicación. Es lo que permite enseñar el
 * comando completo en la tarjeta sin romper la promesa de no guardar contenido
 * (D5): lo que se muestra no queda escrito en ningún sitio.
 *
 * Cada petición lleva su propio temporizador. Si nadie decide a tiempo, se
 * resuelve como `timeout` y la herramienta pregunta por su vía normal (D21): la
 * Torre es un atajo, nunca un cuello de botella.
 */

interface Waiting {
  permission: PendingPermission
  resolve: (resolution: PermissionResolution) => void
  timer: NodeJS.Timeout
}

export interface PermissionRegistryOptions {
  /** Cuánto se espera antes de rendirse. Inyectable para que los tests no duerman. */
  timeoutMs?: number
  now?: () => number
  /** Se llama cada vez que la lista de pendientes cambia. */
  onChange?: (pending: PendingPermission[]) => void
}

export class PermissionRegistry {
  private readonly waiting = new Map<string, Waiting>()
  private readonly timeoutMs: number
  private readonly now: () => number
  private readonly onChange: (pending: PendingPermission[]) => void

  constructor(options: PermissionRegistryOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? PERMISSION_TIMEOUT_MS
    this.now = options.now ?? (() => Date.now())
    this.onChange = options.onChange ?? (() => {})
  }

  /**
   * Registra una petición y devuelve una promesa que se resuelve cuando el
   * usuario decide, o cuando se agota el tiempo.
   *
   * Quien llama —el receptor HTTP— se queda esperando esta promesa con la
   * conexión abierta.
   */
  await(
    permission: Omit<PendingPermission, 'expiresAt'>,
  ): Promise<PermissionResolution> {
    // Una petición repetida con el mismo identificador sustituye a la anterior:
    // el reintento manda, y la vieja se libera para no dejar a nadie colgado.
    this.settle(permission.requestId, {
      outcome: 'timeout',
      reason: 'Sustituida por una petición más reciente con el mismo identificador',
    })

    const expiresAt = new Date(this.now() + this.timeoutMs).toISOString()
    const full: PendingPermission = { ...permission, expiresAt }

    return new Promise<PermissionResolution>((resolve) => {
      const timer = setTimeout(() => {
        this.settle(full.requestId, {
          outcome: 'timeout',
          reason: 'Nadie decidió en la Torre a tiempo; se devuelve el control a la herramienta',
        })
      }, this.timeoutMs)

      // No debe impedir que la aplicación se cierre.
      timer.unref?.()

      this.waiting.set(full.requestId, { permission: full, resolve, timer })
      this.publish()
    })
  }

  /**
   * Transmite la decisión del usuario.
   *
   * Devuelve false si la petición ya no existe —caducó, o ya se decidió—, para
   * que la interfaz pueda decirlo en lugar de fingir que hizo algo.
   */
  decide(requestId: string, decision: PermissionDecision): boolean {
    if (!this.waiting.has(requestId)) return false
    this.settle(requestId, {
      outcome: decision,
      reason:
        decision === 'allow'
          ? 'Lo aprobaste en AI Torre de Control'
          : 'Lo rechazaste en AI Torre de Control',
    })
    return true
  }

  list(): PendingPermission[] {
    return [...this.waiting.values()]
      .map((entry) => entry.permission)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  }

  /** Peticiones vivas de una tarea concreta. */
  forTask(taskId: string): PendingPermission[] {
    return this.list().filter((permission) => permission.taskId === taskId)
  }

  /**
   * Libera todo lo pendiente. Se llama al cerrar la aplicación para que ninguna
   * herramienta se quede esperando a un proceso que ya no existe.
   */
  releaseAll(): void {
    for (const requestId of [...this.waiting.keys()]) {
      this.settle(requestId, {
        outcome: 'timeout',
        reason: 'AI Torre de Control se cerró antes de que decidieras',
      })
    }
  }

  private settle(requestId: string, resolution: PermissionResolution): void {
    const entry = this.waiting.get(requestId)
    if (!entry) return
    clearTimeout(entry.timer)
    this.waiting.delete(requestId)
    entry.resolve(resolution)
    this.publish()
  }

  private publish(): void {
    this.onChange(this.list())
  }
}
