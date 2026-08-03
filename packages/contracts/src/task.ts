import { z } from 'zod'

/**
 * Modelo normalizado de tarea.
 *
 * Decisiones de SYSTEM_VISION que este archivo implementa:
 *  - D5: aquí NO hay ningún campo que guarde prompts, respuestas ni contenido
 *        de conversaciones. Solo metadatos operativos.
 *  - D7: los estados de cualquier plataforma se traducen a esta lista común.
 *  - D8: todo estado arrastra su fuente y su nivel de confianza.
 */

// ─── Estados normalizados ────────────────────────────────────────────────────

export const TASK_STATUSES = [
  'draft',
  'queued',
  'running',
  'waiting_user',
  'completed',
  'failed',
  'unknown',
  'archived',
] as const

export const taskStatusSchema = z.enum(TASK_STATUSES)
export type TaskStatus = z.infer<typeof taskStatusSchema>

/** Estados que representan un final del trabajo (con o sin éxito). */
export const TERMINAL_STATUSES = ['completed', 'failed'] as const satisfies readonly TaskStatus[]

/** Estados que el usuario debe ver como "todavía en juego". */
export const ACTIVE_STATUSES = [
  'queued',
  'running',
  'waiting_user',
] as const satisfies readonly TaskStatus[]

// ─── Fuente del estado (D8) ──────────────────────────────────────────────────

export const STATUS_SOURCES = [
  'manual',
  'local_event',
  'claude_hook',
  'browser_extension',
  'process_monitor',
] as const

export const statusSourceSchema = z.enum(STATUS_SOURCES)
export type StatusSource = z.infer<typeof statusSourceSchema>

// ─── Confianza del estado (D8) ───────────────────────────────────────────────

export const STATUS_CONFIDENCES = ['high', 'medium', 'low'] as const

export const statusConfidenceSchema = z.enum(STATUS_CONFIDENCES)
export type StatusConfidence = z.infer<typeof statusConfidenceSchema>

// ─── Plataformas conocidas ───────────────────────────────────────────────────

/**
 * Lista cerrada a propósito: la interfaz no debe depender de texto libre.
 * `other` es la vía de escape para cualquier herramienta todavía no contemplada.
 */
export const PROVIDERS = [
  'claude_code',
  'claude_web',
  'cowork',
  'chatgpt',
  'codex',
  'gemini',
  'copilot',
  'other',
] as const

export const providerSchema = z.enum(PROVIDERS)
export type Provider = z.infer<typeof providerSchema>

// ─── Utilidades de validación ────────────────────────────────────────────────

/** Marca de tiempo ISO-8601 en texto. Se guarda así en SQLite y viaja así por IPC. */
export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .describe('Marca de tiempo ISO-8601')

/**
 * URL externa de la conversación o herramienta.
 *
 * Seguridad: solo se aceptan http y https. Esquemas como `javascript:`, `file:`
 * o `data:` quedan rechazados aquí, antes de llegar a la base de datos, para que
 * nunca pueda abrirse algo peligroso desde un enlace de una tarea.
 */
export const externalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      let parsed: URL
      try {
        parsed = new URL(value)
      } catch {
        return false
      }
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    },
    { message: 'La URL debe empezar por http:// o https://' },
  )

export const taskIdSchema = z.string().trim().min(1).max(64)

// ─── La entidad ──────────────────────────────────────────────────────────────

export const taskSchema = z.object({
  id: taskIdSchema,
  title: z.string().trim().min(1).max(200),
  provider: providerSchema,
  externalUrl: externalUrlSchema.nullable(),
  externalSessionId: z.string().trim().max(200).nullable(),
  projectPath: z.string().trim().max(1024).nullable(),
  status: taskStatusSchema,
  statusSource: statusSourceSchema,
  statusConfidence: statusConfidenceSchema,
  startedAt: isoTimestampSchema.nullable(),
  finishedAt: isoTimestampSchema.nullable(),
  lastActivityAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  notes: z.string().max(2000).nullable(),
})

export type Task = z.infer<typeof taskSchema>

// ─── Entradas desde la interfaz ──────────────────────────────────────────────

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(200),
  provider: providerSchema,
  externalUrl: externalUrlSchema.nullable().default(null),
  externalSessionId: z.string().trim().max(200).nullable().default(null),
  projectPath: z.string().trim().max(1024).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
  status: taskStatusSchema.default('draft'),
})

export type CreateTaskInput = z.input<typeof createTaskInputSchema>

export const updateTaskInputSchema = z.object({
  id: taskIdSchema,
  title: z.string().trim().min(1).max(200).optional(),
  provider: providerSchema.optional(),
  externalUrl: externalUrlSchema.nullable().optional(),
  externalSessionId: z.string().trim().max(200).nullable().optional(),
  projectPath: z.string().trim().max(1024).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>

export const changeStatusInputSchema = z.object({
  id: taskIdSchema,
  status: taskStatusSchema,
  source: statusSourceSchema.default('manual'),
  confidence: statusConfidenceSchema.default('high'),
})

export type ChangeStatusInput = z.input<typeof changeStatusInputSchema>
