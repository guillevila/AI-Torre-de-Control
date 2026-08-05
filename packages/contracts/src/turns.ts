import { z } from 'zod'
import { isoTimestampSchema } from './task.js'

/**
 * Canal de respuesta a fin de turno (D25): «Responder desde la Torre».
 *
 * Cuando Claude Code termina un turno, su enlace puede preguntarle a la Torre
 * si el dueño quiere contestar desde aquí. La Torre enseña la respuesta del
 * asistente en una tarjeta; si el dueño escribe algo, viaja de vuelta y la
 * conversación CONTINÚA en su sesión de siempre, sin buscar la ventana.
 *
 * Mismas reglas que los permisos, porque el riesgo es el mismo:
 *
 *  - **Nada de esto toca el disco** (D20/D5-ter). La respuesta del asistente se
 *    enseña desde la memoria y desaparece al decidirse o al cerrar la Torre.
 *  - **Si nadie contesta a tiempo, la sesión termina como siempre** (espíritu
 *    de D21): la Torre es un atajo, nunca un cuello de botella.
 *  - **La Torre no escribe nada por su cuenta** (D18): solo transmite el texto
 *    que el dueño teclea. Sin texto no viaja nada.
 */

/** Tope del texto que se enseña y del que se envía. Como el de los permisos. */
export const TURN_OUTPUT_MAX = 4000

export const turnRequestSchema = z
  .object({
    requestId: z.string().trim().min(8).max(64),
    sessionId: z.string().trim().max(200).nullable(),
    cwd: z.string().trim().min(1).max(1024),
    /**
     * La respuesta del asistente en este turno, recortada. Es contenido de
     * conversación (D5-ter): se enseña, no se guarda. Puede venir vacía si el
     * enlace no pudo leerla.
     */
    output: z.string().max(TURN_OUTPUT_MAX),
    timestamp: isoTimestampSchema,
  })
  .strict()

export type TurnRequestInput = z.infer<typeof turnRequestSchema>

/** Un turno esperando a que el dueño conteste. Solo en memoria. */
export interface PendingTurn {
  requestId: string
  taskId: string
  taskTitle: string
  /** Nombre de la conversación, si se conoce (D5-bis). */
  sessionTitle: string | null
  output: string
  cwd: string
  requestedAt: string
  expiresAt: string
}

/**
 * Lo que vuelve al enlace. `reply` reengancha la conversación con el texto del
 * dueño; `pass` deja que el turno termine como siempre (aviso y mesa de
 * entregas). El agotamiento del tiempo es un `pass`, no un error.
 */
export type TurnResolution = { action: 'reply'; text: string } | { action: 'pass' }

export const turnDecisionInputSchema = z.object({
  requestId: z.string().trim().min(8).max(64),
  action: z.enum(['reply', 'pass']),
  text: z.string().trim().min(1).max(TURN_OUTPUT_MAX).optional(),
})

export type TurnDecisionInput = z.infer<typeof turnDecisionInputSchema>
