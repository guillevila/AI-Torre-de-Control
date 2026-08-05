import type { PendingTurn, TurnResolution } from '@torre/contracts'

/**
 * Turnos terminados que esperan una respuesta del dueño (D25).
 *
 * Calcado del registro de permisos, y por las mismas razones: **vive solo en
 * memoria** (D20/D5-ter). La respuesta del asistente que se enseña en la
 * tarjeta no toca la base de datos, no entra en el historial y desaparece al
 * decidirse o al cerrar la Torre.
 *
 * Si nadie contesta a tiempo se resuelve como `pass` y el turno termina como
 * siempre. La Torre es un atajo, nunca un cuello de botella.
 */

interface Waiting {
  turn: PendingTurn
  resolve: (resolution: TurnResolution) => void
  timer: NodeJS.Timeout
}

export interface TurnRegistryOptions {
  now?: () => number
  onChange?: (pending: PendingTurn[]) => void
}

export class TurnRegistry {
  private readonly waiting = new Map<string, Waiting>()
  private readonly now: () => number
  private readonly onChange: (pending: PendingTurn[]) => void

  constructor(options: TurnRegistryOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.onChange = options.onChange ?? (() => {})
  }

  /**
   * Registra un turno y espera. El tiempo viene de fuera en cada llamada porque
   * es un ajuste vivo: cambiarlo aplica a la petición siguiente sin reiniciar.
   */
  await(turn: Omit<PendingTurn, 'expiresAt'>, timeoutMs: number): Promise<TurnResolution> {
    this.settle(turn.requestId, { action: 'pass' })

    const expiresAt = new Date(this.now() + timeoutMs).toISOString()
    const full: PendingTurn = { ...turn, expiresAt }

    return new Promise<TurnResolution>((resolve) => {
      const timer = setTimeout(() => {
        this.settle(full.requestId, { action: 'pass' })
      }, timeoutMs)
      // No debe impedir que la aplicación se cierre.
      timer.unref?.()

      this.waiting.set(full.requestId, { turn: full, resolve, timer })
      this.publish()
    })
  }

  /** Devuelve false si el turno ya no espera: caducó o ya se contestó. */
  decide(requestId: string, resolution: TurnResolution): boolean {
    if (!this.waiting.has(requestId)) return false
    this.settle(requestId, resolution)
    return true
  }

  list(): PendingTurn[] {
    return [...this.waiting.values()]
      .map((entry) => entry.turn)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  }

  private settle(requestId: string, resolution: TurnResolution): void {
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
