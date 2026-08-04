import { z } from 'zod'
import {
  isoTimestampSchema,
  providerSchema,
  statusConfidenceSchema,
  statusSourceSchema,
  taskIdSchema,
  taskStatusSchema,
} from './task.js'

/**
 * Historial de estados (decisión D19).
 *
 * Cada vez que una tarea cambia de estado queda una línea aquí. Es lo que
 * permite responder «¿desde cuándo lleva esperándome?» y «¿quién dijo que había
 * terminado?», y lo que hace comprobable la honestidad del sistema: si la
 * aplicación afirma algo, se puede ver de dónde vino.
 *
 * Igual que la tabla de tareas, NO puede contener contenido de conversaciones:
 * solo el salto de un estado a otro, con su procedencia y su hora.
 */
export const statusHistoryEntrySchema = z.object({
  id: z.number().int().nonnegative(),
  taskId: taskIdSchema,
  /** null cuando la línea corresponde a la creación de la tarea. */
  fromStatus: taskStatusSchema.nullable(),
  toStatus: taskStatusSchema,
  source: statusSourceSchema,
  confidence: statusConfidenceSchema,
  at: isoTimestampSchema,
})

export type StatusHistoryEntry = z.infer<typeof statusHistoryEntrySchema>

/**
 * Una línea del historial acompañada del título de su tarea.
 *
 * Es lo que alimenta el panel «Actividad reciente» de la Torre, donde se
 * mezclan cambios de tareas distintas y hace falta saber de cuál es cada uno.
 */
export interface RecentActivityEntry extends StatusHistoryEntry {
  taskTitle: string
  provider: z.infer<typeof providerSchema>
}
