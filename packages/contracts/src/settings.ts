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

  /**
   * Segundos que un turno terminado espera tu respuesta desde la Torre (D25).
   *
   * 0 —lo normal— apaga la función: los turnos terminan como siempre. Con un
   * valor, al terminar un turno aparece una tarjeta con la respuesta del
   * asistente; si contestas a tiempo, la conversación continúa en su sesión con
   * tu texto, sin buscar ninguna ventana. Si no, termina como siempre: la Torre
   * es un atajo, nunca un cuello de botella.
   *
   * Ojo con subirlo: mientras espera, la sesión no da su turno por cerrado.
   */
  turnReplyWindowSeconds: z.number().int().min(0).max(300).default(0),

  /**
   * Sacar la tarjeta del turno en una ventanita **junto al puntero** (D26).
   *
   * Es la diferencia entre «la Torre tiene tu respuesta esperando» y «tu
   * respuesta te sale al paso». Trabajas en tus repos como siempre; cuando una
   * conversación termina su turno, la ventanita aparece donde está el ratón,
   * contestas y desaparece. No hay que buscar ninguna ventana, ni la de VSCode
   * ni la propia Torre — que puede estar minimizada.
   *
   * Tres cautelas deliberadas, todas por la misma razón (una ventana que
   * aparece sola encima de todo es intrusiva y puede hacer daño):
   *
   *  - **No roba el foco.** Sale visible pero inactiva, así que no se traga lo
   *    que estés tecleando en otro sitio. Un clic y ya escribes en ella.
   *  - **Aparece desplazada del puntero**, no debajo, para que un clic que ya
   *    ibas a dar no caiga dentro sin querer.
   *  - **Su aspa no descarta nada.** Cerrarla es «ahora no»: la tarjeta sigue
   *    en la Torre. Descartar de verdad es «Dar por vista», que es explícito.
   *
   * Solo hace algo si «Responder desde la Torre» está encendido: sin turnos no
   * hay tarjetas que enseñar.
   */
  turnPopupAtCursor: z.boolean().default(true),

  /**
   * Traer al frente la ventana del proyecto cuando salte un aviso (O10).
   *
   * En el momento exacto en que se entrega un aviso —terminada, te espera o
   * fallida, ya pasadas la espera anti-lluvia y la deduplicación— la ventana
   * cuyo título lleva el nombre del proyecto (la de VSCode, si hay varias) pasa
   * al primer plano. Si Windows bloquea el cambio de foco, la ventana queda
   * parpadeando en la barra de tareas, que sigue siendo un buen aviso.
   *
   * Solo Windows. Nace apagado: robar el foco es intrusivo y debe pedirse.
   */
  focusProjectWindowOnAttention: z.boolean().default(false),

  /**
   * Aprobar solo, sin preguntarte, los permisos que pida el asistente (D24).
   *
   * Apagado —lo normal— cada permiso es un clic tuyo. Encendido, la Torre
   * contesta «sí» al momento, la tarea no pasa por «te espera» y no salta
   * ningún aviso: nadie está esperando nada.
   *
   * Es el único ajuste de la aplicación que hace que decida ella en tu lugar.
   * Por eso arranca apagado, se ve en pantalla mientras está activo, y todo lo
   * que aprueba queda listado en la actividad del enlace.
   *
   * Lo que NO cambia: los hooks de protección del proyecto siguen actuando
   * antes de que la petición llegue aquí. Lo que ellos bloquean no llega.
   */
  autoApprovePermissions: z.boolean().default(false),

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
