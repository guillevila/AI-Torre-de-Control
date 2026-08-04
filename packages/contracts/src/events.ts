import { z } from 'zod'
import {
  isoTimestampSchema,
  statusConfidenceSchema,
  statusSourceSchema,
  taskIdSchema,
  taskStatusSchema,
} from './task.js'

/**
 * Contrato de los eventos que llegan al receptor local (127.0.0.1).
 *
 * Dos garantías deliberadas de este archivo:
 *
 *  1. `.strict()` — cualquier campo no declarado hace que el evento se RECHACE
 *     entero. Es la barrera que impide que una integración futura cuele
 *     contenido de conversaciones dentro de un evento (D5).
 *
 *  2. No existe ningún campo de texto libre. Un evento solo puede decir
 *     "esta tarea pasó a este estado, según esta fuente, con esta confianza".
 *     Nunca puede transportar un prompt ni una respuesta.
 */

export const statusChangedEventSchema = z
  .object({
    type: z.literal('status_changed'),
    taskId: taskIdSchema,
    status: taskStatusSchema,
    source: statusSourceSchema,
    confidence: statusConfidenceSchema,
    timestamp: isoTimestampSchema,
  })
  .strict()

export type StatusChangedEvent = z.infer<typeof statusChangedEventSchema>

/**
 * Unión discriminada por `type`.
 *
 * Hoy solo existe `status_changed`. Está montado así para que añadir un tipo
 * nuevo (por ejemplo, una señal de vida periódica) sea una línea, sin romper
 * a los emisores existentes.
 */
export const localEventSchema = z.discriminatedUnion('type', [statusChangedEventSchema])

export type LocalEvent = z.infer<typeof localEventSchema>

/** Respuesta que devuelve el receptor local a quien envía un evento. */
export type EventIngestResult =
  | { accepted: true; taskId: string; status: string }
  | { accepted: false; reason: string; details?: string[] }

/**
 * Aviso de estado de una sesión que NO conoce el identificador de la tarea.
 *
 * Es el caso de Claude Code: sabe desde qué carpeta trabaja y cuál es su
 * sesión, pero no qué tarea has creado tú en la Torre. Aquí se manda lo que sí
 * sabe, y la aplicación se encarga de encontrar —o crear— la tarea.
 *
 * Estricto igual que los eventos: un campo de más y se rechaza entero. Y por
 * las mismas razones, no hay ningún campo de texto libre por el que pudiera
 * colarse contenido de una conversación (D5).
 */
export const sessionUpdateSchema = z
  .object({
    sessionId: z.string().trim().max(200).nullable(),
    /** Carpeta desde la que trabaja la sesión. Es la vía para casar con la tarea. */
    cwd: z.string().trim().min(1).max(1024),
    status: taskStatusSchema,
    timestamp: isoTimestampSchema,
  })
  .strict()

export type SessionUpdate = z.infer<typeof sessionUpdateSchema>

export type SessionUpdateResult =
  | { accepted: true; taskId: string; status: string }
  | { accepted: false; reason: string; details?: string[] }
