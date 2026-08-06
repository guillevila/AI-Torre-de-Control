import type { HandoffResolution, PendingHandoff } from '@torre/contracts'

/**
 * Registro de entregas que esperan tu respuesta (D24).
 *
 * **Vive solo en memoria.** No toca la base de datos, no entra en el historial y
 * desaparece al cerrar la aplicación. Es lo que permite enseñar entero lo que
 * Claude te contestó sin romper la promesa de no guardar contenido de
 * conversaciones (D5): lo que se ve no queda escrito en ningún sitio.
 *
 * Es hermano del registro de permisos y se parece mucho a propósito. No se ha
 * unificado con él porque lo que retienen es distinto —allí una decisión de sí o
 * no, aquí un texto— y porque aquel funciona y está probado en producción: dos
 * ficheros claros valen más que una abstracción compartida que haya que
 * entender dos veces.
 *
 * Cada entrega lleva su temporizador. Si no contestas, se resuelve como
 * `release` y Claude termina su turno con normalidad (D21): la Torre es un
 * atajo, nunca un cuello de botella.
 */

interface Waiting {
  handoff: PendingHandoff
  resolve: (resolution: HandoffResolution) => void
  timer: NodeJS.Timeout
}

export interface HandoffRegistryOptions {
  /** Cuánto se espera antes de soltar. Inyectable para que los tests no duerman. */
  timeoutMs: number
  now?: () => number
  /** Se llama cada vez que la lista de pendientes cambia. */
  onChange?: (pending: PendingHandoff[]) => void
}

export class HandoffRegistry {
  private readonly waiting = new Map<string, Waiting>()
  private timeoutMs: number
  private readonly now: () => number
  private readonly onChange: (pending: PendingHandoff[]) => void

  constructor(options: HandoffRegistryOptions) {
    this.timeoutMs = options.timeoutMs
    this.now = options.now ?? (() => Date.now())
    this.onChange = options.onChange ?? (() => {})
  }

  /**
   * Cambia cuánto se retiene a partir de la siguiente entrega.
   *
   * Lo gobierna un ajuste que el usuario puede mover en caliente. Las entregas
   * que ya están esperando conservan el tiempo con el que nacieron: cambiarles
   * la cuenta atrás a mitad sería mentirle a quien está mirando el número bajar.
   */
  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs
  }

  /**
   * Registra una entrega y devuelve una promesa que se resuelve cuando
   * contestas, cuando la sueltas, o cuando se agota el tiempo.
   *
   * Quien llama —el receptor HTTP— se queda esperando esta promesa con la
   * conexión abierta, y con ella el turno de Claude.
   */
  await(handoff: Omit<PendingHandoff, 'expiresAt'>): Promise<HandoffResolution> {
    // Una entrega repetida con el mismo identificador sustituye a la anterior:
    // el reintento manda, y la vieja se libera para no dejar a nadie colgado.
    this.settle(handoff.requestId, {
      outcome: 'release',
      reply: null,
      reason: 'Sustituida por una entrega más reciente con el mismo identificador',
    })

    const expiresAt = new Date(this.now() + this.timeoutMs).toISOString()
    const full: PendingHandoff = { ...handoff, expiresAt }

    return new Promise<HandoffResolution>((resolve) => {
      const timer = setTimeout(() => {
        this.settle(full.requestId, {
          outcome: 'release',
          reply: null,
          reason: 'No contestaste a tiempo; Claude Code termina su turno con normalidad',
        })
      }, this.timeoutMs)

      // No debe impedir que la aplicación se cierre.
      timer.unref?.()

      this.waiting.set(full.requestId, { handoff: full, resolve, timer })
      this.publish()
    })
  }

  /**
   * Transmite lo que has escrito.
   *
   * Devuelve false si la entrega ya no existe —caducó, o ya se contestó—, para
   * que la interfaz pueda decirlo en lugar de fingir que ha mandado algo. Que
   * un mensaje escrito se pierda en silencio sería peor que no poder escribirlo.
   */
  reply(requestId: string, text: string): boolean {
    if (!this.waiting.has(requestId)) return false
    this.settle(requestId, {
      outcome: 'reply',
      reply: text,
      reason: 'Le contestaste desde AI Torre de Control',
    })
    return true
  }

  /** Deja que Claude termine el turno sin decirle nada. */
  release(requestId: string): boolean {
    if (!this.waiting.has(requestId)) return false
    this.settle(requestId, {
      outcome: 'release',
      reply: null,
      reason: 'Dejaste que terminara el turno',
    })
    return true
  }

  list(): PendingHandoff[] {
    return [...this.waiting.values()]
      .map((entry) => entry.handoff)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  }

  /**
   * Libera todo lo pendiente. Se llama al cerrar la aplicación para que ninguna
   * sesión de Claude Code se quede esperando a un proceso que ya no existe.
   */
  releaseAll(): void {
    for (const requestId of [...this.waiting.keys()]) {
      this.settle(requestId, {
        outcome: 'release',
        reply: null,
        reason: 'AI Torre de Control se cerró antes de que contestaras',
      })
    }
  }

  private settle(requestId: string, resolution: HandoffResolution): void {
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
