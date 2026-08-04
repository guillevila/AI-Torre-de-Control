import { z } from 'zod'
import { externalUrlSchema, isoTimestampSchema, taskIdSchema, taskStatusSchema } from './task.js'

/**
 * Señal de que una conversación del navegador ha empezado o ha terminado.
 *
 * La envía el vigilante de la extensión al ver que la herramienta se pone a
 * responder o deja de hacerlo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO CABEN DOS ESTADOS, Y ES DELIBERADO
 *
 * `running` y `completed`. Nada más.
 *
 * El vigilante mira una página web: puede saber si algo se está generando o ha
 * dejado de generarse, y hasta ahí llega su conocimiento. **No puede saber si
 * algo ha fallado**, ni si la herramienta te está esperando, ni si el resultado
 * sirve. Dejarle decir `failed` o `waiting_user` sería darle voz sobre cosas
 * que no ve.
 *
 * Como en el alta, `.strict()` rechaza la petición ENTERA ante cualquier campo
 * de más: aquí tampoco hay hueco para el contenido de la conversación.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const WEB_ACTIVITY_STATUSES = ['running', 'completed'] as const

export const webActivitySchema = z
  .object({
    /** Qué conversación. Es lo único que permite emparejarla con su tarea. */
    externalUrl: externalUrlSchema,
    /** Empezó a responder, o terminó. Y no hay tercera opción. */
    status: z.enum(WEB_ACTIVITY_STATUSES),
    timestamp: isoTimestampSchema,
  })
  .strict()

export type WebActivity = z.infer<typeof webActivitySchema>

/**
 * Respuesta a una señal de actividad.
 *
 * `matched: false` significa que esa conversación no está registrada en la
 * Torre. No es un error: registrar sigue siendo una decisión tuya, así que el
 * vigilante puede estar mirando una conversación que nunca diste de alta. Se
 * ignora sin ruido, en lugar de crear tareas que no pediste.
 */
export interface WebActivityResult {
  accepted: boolean
  reason?: string
  matched?: boolean
  taskId?: z.infer<typeof taskIdSchema>
  status?: z.infer<typeof taskStatusSchema>
}
