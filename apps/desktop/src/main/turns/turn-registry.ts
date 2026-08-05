import type { PendingTurn, TurnResolution } from '@torre/contracts'

/**
 * Turnos esperando la respuesta del dueño (D25-bis).
 *
 * Dos vidas en una misma tarjeta:
 *
 *  1. **Sostenida** — el hook de Stop aguanta la sesión unos segundos. Si el
 *     dueño contesta ahora, la respuesta entra por la MISMA sesión.
 *  2. **En reposo** — pasado ese tiempo el hook se libera (`pass`, el turno
 *     termina como siempre) pero **la tarjeta se queda**, sin caducidad, hasta
 *     que el dueño responda (relanzando la conversación) o la dé por vista.
 *
 * Todo vive solo en memoria (D20/D5-ter): cerrar la Torre limpia las tarjetas.
 * Lo entregado no se pierde por eso: sigue en la mesa de entregas.
 */

interface Entry {
  turn: PendingTurn
  /** Presente solo mientras el hook sostiene la sesión. */
  hold: { resolve: (resolution: TurnResolution) => void; timer: NodeJS.Timeout } | null
}

export interface TurnRegistryOptions {
  now?: () => number
  onChange?: (pending: PendingTurn[]) => void
}

export class TurnRegistry {
  private readonly entries = new Map<string, Entry>()
  private readonly now: () => number
  private readonly onChange: (pending: PendingTurn[]) => void

  constructor(options: TurnRegistryOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.onChange = options.onChange ?? (() => {})
  }

  /**
   * Registra el turno y sostiene la conexión del hook `holdMs`. Al agotarse, el
   * hook recibe `pass` y la tarjeta pasa a reposo — no desaparece.
   */
  awaitHold(turn: Omit<PendingTurn, 'holdUntil'>, holdMs: number): Promise<TurnResolution> {
    // Un reintento con el mismo identificador sustituye al anterior.
    this.remove(turn.requestId)

    const holdUntil = new Date(this.now() + holdMs).toISOString()
    const full: PendingTurn = { ...turn, holdUntil }

    return new Promise<TurnResolution>((resolve) => {
      const timer = setTimeout(() => {
        const entry = this.entries.get(full.requestId)
        if (!entry?.hold) return
        entry.hold = null
        entry.turn = { ...entry.turn, holdUntil: null }
        resolve({ action: 'pass' })
        this.publish()
      }, holdMs)
      timer.unref?.()

      this.entries.set(full.requestId, { turn: full, hold: { resolve, timer } })
      this.publish()
    })
  }

  get(requestId: string): PendingTurn | null {
    return this.entries.get(requestId)?.turn ?? null
  }

  /** ¿Sigue el hook sosteniendo la sesión de este turno? */
  isHeld(requestId: string): boolean {
    return Boolean(this.entries.get(requestId)?.hold)
  }

  /**
   * Resuelve la conexión sostenida (si sigue viva) y retira la tarjeta. Es el
   * final de la tarjeta, decida lo que decida el dueño.
   */
  settle(requestId: string, resolution: TurnResolution): void {
    const entry = this.entries.get(requestId)
    if (!entry) return
    if (entry.hold) {
      clearTimeout(entry.hold.timer)
      entry.hold.resolve(resolution)
    }
    this.entries.delete(requestId)
    this.publish()
  }

  private remove(requestId: string): void {
    this.settle(requestId, { action: 'pass' })
  }

  list(): PendingTurn[] {
    return [...this.entries.values()]
      .map((entry) => entry.turn)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  }

  private publish(): void {
    this.onChange(this.list())
  }
}
