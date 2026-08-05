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

/** Tope de un diff. Uno enorme no se lee: se mira por encima y se abre el editor. */
export const TURN_DIFF_MAX = 2000
/** Tope de pasos. Un turno con cientos de herramientas no cabe en una tarjeta. */
export const TURN_STEPS_MAX = 60

/**
 * Un paso del turno, tal y como se ve en la ventana de VSCode (D26-quater).
 *
 * Un turno no es solo prosa: el asistente habla, lee ficheros, ejecuta y edita.
 * Enseñar únicamente el texto deja fuera lo que más pesa al decidir — **qué ha
 * tocado**. Estos pasos son lo que permite que la tarjeta se lea igual que el
 * chat del editor.
 *
 * Siguen siendo contenido de conversación (D5-ter): se enseñan y no se guardan.
 * Con una diferencia que hay que tener presente: aquí entran **rutas de
 * ficheros, comandos y trozos de código**, no solo la prosa del asistente. Todo
 * ello vive en memoria y muere al decidir o al cerrar la Torre.
 */
export const turnStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string().max(TURN_OUTPUT_MAX),
  }),
  z.object({
    kind: z.literal('tool'),
    /** «Edit», «Bash», «Read»… tal cual lo llama Claude Code. */
    name: z.string().trim().min(1).max(60),
    /** Sobre qué: la ruta del fichero, el comando, el patrón buscado. */
    target: z.string().max(400),
    /** Líneas añadidas y quitadas, cuando la herramienta edita. */
    added: z.number().int().min(0).max(1_000_000).nullable(),
    removed: z.number().int().min(0).max(1_000_000).nullable(),
    /** El cambio en formato diff, recortado. Nulo si la herramienta no edita. */
    diff: z.string().max(TURN_DIFF_MAX).nullable(),
  }),
])

export type TurnStep = z.infer<typeof turnStepSchema>

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
    /**
     * El turno paso a paso. **Opcional a propósito**: un enlace antiguo —el que
     * sigue instalado hasta que se pulsa «Actualizar ahora»— no lo manda, y la
     * tarjeta tiene que seguir funcionando con solo `output`.
     */
    steps: z.array(turnStepSchema).max(TURN_STEPS_MAX).optional(),
    timestamp: isoTimestampSchema,
  })
  .strict()

export type TurnRequestInput = z.infer<typeof turnRequestSchema>

/**
 * Un turno esperando a que el dueño conteste. Solo en memoria, y SIN caducidad
 * (D25-bis): la tarjeta se queda hasta que el dueño responde o la da por vista.
 */
export interface PendingTurn {
  requestId: string
  taskId: string
  taskTitle: string
  /** Nombre de la conversación, si se conoce (D5-bis). */
  sessionTitle: string | null
  output: string
  /** El turno paso a paso (D26-quater). Vacío con un enlace sin actualizar. */
  steps: TurnStep[]
  cwd: string
  requestedAt: string
  /**
   * Hasta cuándo la sesión sigue SOSTENIDA esperando (misma sesión). `null`
   * cuando el turno ya terminó: contestar entonces relanza la conversación.
   */
  holdUntil: string | null
}

/**
 * Lo que vuelve al enlace. `reply` reengancha la conversación con el texto del
 * dueño; `pass` deja que el turno termine como siempre (aviso y mesa de
 * entregas). El agotamiento del tiempo es un `pass`, no un error.
 */
export type TurnResolution = { action: 'reply'; text: string } | { action: 'pass' }

export const turnDecisionInputSchema = z.object({
  requestId: z.string().trim().min(8).max(64),
  /** `reply` contesta (misma sesión o relanzando); `review` = dar por vista. */
  action: z.enum(['reply', 'review']),
  text: z.string().trim().min(1).max(TURN_OUTPUT_MAX).optional(),
})

/** Contestar a la conversación de una tarea desde su ficha (D25-bis). */
export const taskReplyInputSchema = z.object({
  taskId: z.string().trim().min(1).max(64),
  text: z.string().trim().min(1).max(TURN_OUTPUT_MAX),
})

export type TurnDecisionInput = z.infer<typeof turnDecisionInputSchema>
