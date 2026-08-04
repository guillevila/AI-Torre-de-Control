import { z } from 'zod'
import { isoTimestampSchema, taskIdSchema } from './task.js'

/**
 * Canal de permisos (decisiones D18-bis, D20 y D21).
 *
 * Cuando una herramienta se para a pedir permiso, envía la petición aquí. La
 * Torre la enseña, el usuario decide con un clic, y la respuesta vuelve por el
 * mismo camino.
 *
 * Tres cosas que este archivo hace cumplir:
 *
 *  - **La Torre nunca decide sola.** No hay reglas, ni listas de comandos
 *    permitidos, ni «recordar mi elección». Cada permiso es un clic humano.
 *  - **Nada de esto se guarda en disco** (D20). Las peticiones viven en memoria
 *    y desaparecen al decidirse. Por eso se puede enseñar el comando completo
 *    sin romper D5.
 *  - **Si nadie contesta, la herramienta pregunta como siempre** (D21). El
 *    resultado `timeout` no es un error: es la salida digna.
 */

/** Tope de tamaño del detalle. Suficiente para un comando largo, no para un volcado. */
export const PERMISSION_DETAIL_MAX = 4000

/** Cuánto espera la Torre a que decidas antes de rendirse (D21). */
export const PERMISSION_TIMEOUT_MS = 90_000

export const permissionRequestSchema = z
  .object({
    /** Identificador de la petición, generado por quien la envía. */
    requestId: z.string().trim().min(8).max(64),
    /** Sesión de la herramienta, si la conoce. Ayuda a encontrar la tarea. */
    sessionId: z.string().trim().max(200).nullable(),
    /** Carpeta desde la que trabaja. Es la vía principal para casar con una tarea. */
    cwd: z.string().trim().max(1024),
    /** Qué herramienta quiere usar: Bash, Write, Edit… */
    toolName: z.string().trim().min(1).max(100),
    /**
     * Qué va a hacer exactamente, en texto plano.
     *
     * Se enseña ÍNTEGRO en la tarjeta: aprobar un resumen sería peor que no
     * aprobar nada. Nunca se escribe en disco (D20).
     */
    detail: z.string().max(PERMISSION_DETAIL_MAX),
    timestamp: isoTimestampSchema,
  })
  .strict()

export type PermissionRequestInput = z.infer<typeof permissionRequestSchema>

/** Lo que decide el usuario. No hay más opciones a propósito. */
export const permissionDecisionSchema = z.enum(['allow', 'deny'])
export type PermissionDecision = z.infer<typeof permissionDecisionSchema>

/** Cómo terminó una petición. `timeout` es una salida normal, no un fallo. */
export const permissionOutcomeSchema = z.enum(['allow', 'deny', 'timeout'])
export type PermissionOutcome = z.infer<typeof permissionOutcomeSchema>

/**
 * Una petición viva, tal y como la ve la interfaz.
 *
 * Existe solo en memoria del proceso principal. Si cierras la aplicación,
 * desaparece — que es exactamente lo que debe pasar.
 */
export interface PendingPermission {
  requestId: string
  /** Tarea a la que se ha asociado. Siempre hay una: si no existía, se crea. */
  taskId: string
  taskTitle: string
  toolName: string
  detail: string
  cwd: string
  requestedAt: string
  /** Momento en que dejará de esperar y la herramienta preguntará por su cuenta. */
  expiresAt: string
}

/** Respuesta que recibe quien envió la petición. */
export interface PermissionResolution {
  outcome: PermissionOutcome
  /** Frase para el registro de la herramienta. Nunca se enseña al usuario. */
  reason: string
}

export const permissionDecisionInputSchema = z.object({
  requestId: z.string().trim().min(8).max(64),
  decision: permissionDecisionSchema,
})

export type PermissionDecisionInput = z.infer<typeof permissionDecisionInputSchema>

/** Identificador de tarea opcional, por si quien pide ya sabe a cuál pertenece. */
export const optionalTaskIdSchema = taskIdSchema.nullable()
