import { z } from 'zod'
import {
  accountSchema,
  externalUrlSchema,
  providerSchema,
  taskIdSchema,
  taskStatusSchema,
} from './task.js'

/**
 * Alta de una tarea desde fuera de la aplicación.
 *
 * Es lo que envía la extensión de navegador al pulsar «registrar en la Torre».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE CONTRATO ES DIMINUTO A PROPÓSITO
 *
 * Solo caben dos datos: **el título de la pestaña y su dirección**. Ni un campo
 * más. No hay hueco para el texto de la conversación, ni para lo que has
 * preguntado, ni para lo que te han contestado — y `.strict()` hace que
 * cualquier campo de más provoque el rechazo COMPLETO de la petición, no que se
 * ignore en silencio.
 *
 * Esto no es una precaución: es la promesa central del producto escrita en
 * forma de código. Si mañana alguien quisiera colar contenido de conversaciones,
 * tendría que cambiar este archivo, y ese cambio se ve en una revisión.
 *
 * La plataforma NO se acepta de fuera: se deduce aquí de la dirección. Quien
 * envía no puede decidir que algo es ChatGPT si su enlace dice otra cosa.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const taskIntakeSchema = z
  .object({
    /** El título de la pestaña. Se recorta y se limita, como cualquier título. */
    title: z.string().trim().min(1).max(200),
    /** La dirección de la conversación. Solo http o https (ver `externalUrlSchema`). */
    externalUrl: externalUrlSchema,
    /**
     * Cuenta o espacio de trabajo, si lo has etiquetado.
     *
     * Es el tercer y último campo, y merece explicarse porque este contrato
     * presume de ser diminuto: lo escribe **el usuario**, una vez por perfil de
     * navegador, y la extensión se limita a repetirlo. No se deduce de la
     * página ni sale de la conversación. Va limitado a 40 caracteres: es una
     * etiqueta para leer de un vistazo, no un hueco donde quepa nada más.
     */
    account: accountSchema.optional(),
  })
  .strict()

export type TaskIntake = z.infer<typeof taskIntakeSchema>

/**
 * Respuesta a un alta.
 *
 * Distingue tres desenlaces, y los tres importan:
 *
 *  - **Creada**: no existía y ahora sí.
 *  - **Ya estaba** (`duplicate`): pulsar dos veces sobre la misma conversación no
 *    debe llenarte la Torre de tareas repetidas.
 *  - **Recuperada** (`revived`): existía pero estaba archivada, o sea invisible en
 *    todas las pantallas. Contestar «ya la tienes» y no enseñar nada es una
 *    respuesta técnicamente cierta y prácticamente inútil, así que se
 *    desarchiva y se dice que se ha hecho.
 */
export interface TaskIntakeResult {
  accepted: boolean
  reason?: string
  taskId?: z.infer<typeof taskIdSchema>
  title?: string
  provider?: z.infer<typeof providerSchema>
  status?: z.infer<typeof taskStatusSchema>
  /** La tarea ya existía y se ha devuelto esa, sin crear ninguna nueva. */
  duplicate?: boolean
  /** Estaba archivada —invisible— y se ha traído de vuelta. */
  revived?: boolean
}
