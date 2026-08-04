import { z } from 'zod'

/**
 * Ajustes locales de la aplicación.
 *
 * Deliberadamente cortos: aquí solo hay opciones que hacen algo de verdad. Si
 * una preferencia aparece en la pantalla de Ajustes, es porque está conectada.
 * Nada de interruptores decorativos.
 *
 * Se guardan en un fichero JSON dentro de la carpeta de datos del usuario.
 */
export const settingsSchema = z.object({
  /** Avisar cuando una tarea pasa a «te espera». */
  notifyWaitingUser: z.boolean().default(true),
  /** Avisar cuando una tarea termina. */
  notifyCompleted: z.boolean().default(true),
  /** Avisar cuando una tarea falla. */
  notifyFailed: z.boolean().default(true),

  /**
   * Segundos que espera un aviso antes de salir, para ver si vuelves.
   *
   * Existe por el enlace con Claude Code: **cada turno** del asistente acaba en
   * «terminada» o «te espera», así que sin esta espera te llovería un aviso por
   * turno mientras trabajas en la terminal, y acabarías apagándolos.
   *
   * Si vuelves y le escribes antes de que pase el tiempo, el aviso se cancela
   * solo sin haber llegado a molestar. Solo sale si de verdad te has ido.
   *
   * 0 avisa al momento. No afecta a «fallida», que sale siempre al instante:
   * un error merece saberse ya.
   */
  idleNoticeDelaySeconds: z.number().int().min(0).max(600).default(45),

  /**
   * Minutos sin señal tras los cuales una tarea automática pasa a «sin
   * confirmar» (D9). 0 desactiva el barrido.
   *
   * Solo afecta a tareas cuyo estado vino de una fuente automática: lo que
   * marcaste tú a mano no caduca.
   */
  staleAfterMinutes: z.number().int().min(0).max(1440).default(30),

  /** Vista con la que arranca la aplicación. */
  startView: z.enum(['operations', 'office']).default('operations'),

  /** Sección en la que arranca la aplicación. */
  startSection: z.enum(['tower', 'attention', 'tasks', 'history', 'settings']).default('tower'),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

/** Cambios parciales de ajustes que envía la interfaz. */
export const settingsPatchSchema = settingsSchema.partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
