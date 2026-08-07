import { z } from 'zod'
import { isoTimestampSchema } from './task.js'

/**
 * Canal de entrega: contestarle a Claude Code sin abrir la terminal (D24).
 *
 * Cuando Claude termina un turno te ha entregado algo. Este canal enseña lo que
 * te dijo en un aviso de la Torre y te deja **responderle desde ahí**: lo que
 * escribas vuelve por el mismo camino y Claude sigue trabajando, sin que hayas
 * tocado la terminal.
 *
 * Cuatro reglas que este archivo hace cumplir:
 *
 *  - **Se enseña, no se guarda** (D24, que es D20 aplicada a un segundo canal).
 *    El texto vive en memoria del proceso principal y desaparece en cuanto
 *    contestas o caduca. No entra en la base de datos, ni en el historial, ni en
 *    el CSV, ni en el cuaderno de diagnóstico. Por eso puede verse entero sin
 *    romper D5, exactamente igual que ya pasa con el comando de un permiso.
 *  - **La Torre nunca escribe por ti.** No hay respuestas sugeridas, ni
 *    plantillas, ni «continuar» automático. Lo que llega a Claude lo tecleó una
 *    persona.
 *  - **Si no contestas, Claude termina como siempre** (D21). `release` no es un
 *    error: es la salida normal, y es lo que ocurre casi todo el tiempo.
 *  - **Apagado de fábrica.** Retener el final de cada turno tiene un coste real
 *    —Claude espera—, así que no se hace hasta que alguien lo enciende.
 */

/**
 * Tope del texto que viaja en cada sentido.
 *
 * El receptor local corta los cuerpos a 16 KB, así que esto va cómodamente por
 * debajo: una respuesta larguísima llega recortada, pero llega.
 */
export const HANDOFF_MESSAGE_MAX = 4000

/**
 * Cuánto puede retener la Torre el final de un turno, como mucho.
 *
 * Tres relojes tienen que ordenarse, y el más interno debe ser siempre el que
 * decida, para que la cuenta atrás que ves en pantalla sea la de verdad:
 *
 *   Torre (esto, ≤180 s)  <  enlace (190 s)  <  Claude Code (210 s)
 *
 * Si el orden se invirtiera, Claude Code mataría el enlace a media espera y tu
 * respuesta se perdería justo después de haberla escrito. Tocar uno de estos
 * tres números obliga a repasar los otros dos.
 */
export const HANDOFF_MAX_WAIT_SECONDS = 180

/** Lo que retiene de fábrica cuando lo enciendes. Un minuto largo, no diez. */
export const HANDOFF_DEFAULT_WAIT_SECONDS = 60

export const handoffRequestSchema = z
  .object({
    /** Identificador de la petición, generado por quien la envía. */
    requestId: z.string().trim().min(8).max(64),
    /** Sesión de Claude Code, si la conoce. Ayuda a encontrar la tarea. */
    sessionId: z.string().trim().max(200).nullable(),
    /** Carpeta desde la que trabaja. Es la vía principal para casar con una tarea. */
    cwd: z.string().trim().max(1024),
    /**
     * Lo que Claude acaba de contestarte, tal cual.
     *
     * Viene del campo `last_assistant_message` del evento `Stop`, que es el
     * texto final del turno ya montado. No se lee la transcripción: la propia
     * documentación avisa de que se escribe con retraso y puede no tener todavía
     * el último mensaje.
     *
     * Se enseña ÍNTEGRO y no se escribe en ningún sitio (D24).
     */
    message: z.string().max(HANDOFF_MESSAGE_MAX),
    timestamp: isoTimestampSchema,
  })
  .strict()

export type HandoffRequestInput = z.infer<typeof handoffRequestSchema>

/**
 * Cómo terminó una entrega.
 *
 * `release` cubre las tres formas de no contestar —no te apetece, no estabas, o
 * la función está apagada—, y las tres significan lo mismo para Claude: termina
 * el turno con normalidad.
 */
export const handoffOutcomeSchema = z.enum(['reply', 'release'])
export type HandoffOutcome = z.infer<typeof handoffOutcomeSchema>

/**
 * Una entrega esperando a que le contestes, tal y como la ve la interfaz.
 *
 * Vive solo en memoria. Si cierras la aplicación, desaparece — que es
 * exactamente lo que debe pasar con algo que prometimos no guardar.
 */
export interface PendingHandoff {
  requestId: string
  /** Tarea a la que se ha asociado. Siempre hay una: si no existía, se crea. */
  taskId: string
  taskTitle: string
  /** Lo que Claude te dijo. Nunca se escribe en disco. */
  message: string
  cwd: string
  requestedAt: string
  /** Momento en que dejará de esperar y Claude terminará su turno. */
  expiresAt: string
}

/** Respuesta que recibe el enlace que está esperando. */
export interface HandoffResolution {
  outcome: HandoffOutcome
  /** Lo que escribiste. Solo cuando `outcome` es `reply`. */
  reply: string | null
  /** Frase para el registro del enlace. Nunca se le enseña al usuario. */
  reason: string
}

export const handoffReplyInputSchema = z.object({
  requestId: z.string().trim().min(8).max(64),
  /**
   * Lo que le escribes a Claude.
   *
   * No puede estar vacío: mandar un turno en blanco haría que Claude siguiera
   * sin saber para qué. Quien no quiere decir nada usa «dejar que termine», que
   * es otra cosa y se llama distinto a propósito.
   */
  text: z.string().trim().min(1).max(HANDOFF_MESSAGE_MAX),
})

export type HandoffReplyInput = z.infer<typeof handoffReplyInputSchema>
