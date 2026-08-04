import type { Provider, Task } from './task.js'
import type { RecentActivityEntry, StatusHistoryEntry } from './history.js'
import type { Settings } from './settings.js'
import type { PendingPermission, PermissionDecision } from './permissions.js'

/**
 * Canales de comunicación entre el proceso principal de Electron (que tiene
 * acceso al disco y a la red local) y la interfaz React (que no tiene ninguno).
 *
 * La interfaz NUNCA toca la base de datos ni el sistema operativo directamente:
 * solo puede pedir estas operaciones concretas a través del puente del preload.
 *
 * IMPORTANTE: este archivo no debe importar nada en tiempo de ejecución. El
 * preload lo carga en modo aislado, donde no se pueden cargar módulos de Node,
 * así que aquí solo caben constantes y tipos.
 */
export const IPC = {
  /** Renderer → main: pedir la lista completa de tareas. */
  tasksList: 'tasks:list',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksChangeStatus: 'tasks:change-status',
  tasksArchive: 'tasks:archive',
  tasksDelete: 'tasks:delete',
  /** Renderer → main: abrir el enlace externo de una tarea en el navegador. */
  tasksOpenExternal: 'tasks:open-external',
  /** Renderer → main: historial de estados de una tarea concreta (D19). */
  tasksHistory: 'tasks:history',
  /** Renderer → main: últimos cambios de estado de todas las tareas. */
  recentActivity: 'tasks:recent-activity',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  /** Renderer → main: abrir la carpeta de datos en el explorador. */
  dataOpenFolder: 'data:open-folder',
  /** Renderer → main: exportar todas las tareas a un CSV elegido por el usuario. */
  dataExportCsv: 'data:export-csv',

  /** Renderer → main: permisos que ahora mismo esperan una decisión tuya. */
  permissionsList: 'permissions:list',
  /** Renderer → main: transmitir tu decisión a la herramienta que pregunta. */
  permissionsDecide: 'permissions:decide',

  /** Renderer → main: ¿está instalado el enlace con Claude Code? */
  hookStatus: 'hook:status',
  /** Renderer → main: enseñar el cambio EXACTO antes de tocar nada (D13). */
  hookPreview: 'hook:preview',
  hookInstall: 'hook:install',
  hookUninstall: 'hook:uninstall',

  /** Renderer → main: datos del panel de desarrollo (puerto y token del receptor). */
  devInfo: 'dev:info',

  /** Main → renderer: algo cambió, aquí tienes el estado nuevo completo. */
  tasksChanged: 'tasks:changed',
  /** Main → renderer: la lista de permisos pendientes ha cambiado. */
  permissionsChanged: 'permissions:changed',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

/**
 * Resultado uniforme de toda llamada IPC.
 *
 * Se devuelve un objeto en lugar de lanzar una excepción para que un error de
 * validación (por ejemplo, un título vacío) llegue a la interfaz como un mensaje
 * que se le pueda enseñar al usuario, no como un fallo genérico.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Información del receptor local que se muestra en el panel de desarrollo. */
export interface DevInfo {
  eventServer: {
    listening: boolean
    host: string
    port: number | null
    /** Token local exigido a los eventos. Se genera solo y no está en el repo. */
    token: string | null
    /** Ruta del fichero donde vive el token, para que otras herramientas lo lean. */
    tokenPath: string
  }
  databasePath: string
  dataDirectory: string
  /** Tamaño de la base de datos en bytes, para mostrarlo en Ajustes. */
  databaseBytes: number
  /** Estado real de cada integración. Nunca se dice «instalada» sin comprobarlo. */
  integrations: {
    provider: Provider
    label: string
    status: 'installed' | 'not_configured' | 'planned'
  }[]
}

/**
 * Estado del enlace con Claude Code.
 *
 * Se calcula leyendo de verdad el fichero de configuración, nunca recordando lo
 * que hicimos la última vez: si lo desinstalas a mano por fuera, la Torre tiene
 * que enterarse.
 */
export interface HookStatus {
  installed: boolean
  /**
   * true cuando está instalado pero con una versión anterior: o el script ha
   * cambiado, o hay eventos nuevos que enganchar.
   *
   * Sin esto, una corrección del enlace no llegaría nunca a quien ya lo tenía
   * instalado, y seguiría viendo el fallo sin saber por qué.
   */
  needsUpdate: boolean
  /** Ruta del fichero de ajustes de Claude Code que habría que tocar. */
  settingsPath: string
  /** false cuando Claude Code todavía no ha creado su configuración. */
  settingsExists: boolean
  /** Ruta del script que se instalaría. */
  hookScriptPath: string
  /** true si el script existe donde debería. */
  hookScriptExists: boolean
  /** Copia de seguridad más reciente, si se hizo alguna. */
  lastBackupPath: string | null
}

/**
 * Lo que se te enseña ANTES de tocar tu configuración global (D13).
 *
 * `before` y `after` son el contenido literal del fichero, para que puedas
 * compararlos tú mismo en lugar de fiarte de un resumen.
 */
export interface HookPreview {
  settingsPath: string
  before: string
  after: string
  /** Dónde se guardará la copia de seguridad antes de escribir. */
  backupPath: string
  /** Resumen en lenguaje normal de qué eventos se van a enganchar. */
  summary: string[]
}

export interface ExportResult {
  /** false cuando el usuario cierra el diálogo sin elegir destino. */
  written: boolean
  path: string | null
  rows: number
}

/** Superficie exacta que el preload expone a la interfaz. Nada más. */
export interface TorreBridge {
  listTasks: () => Promise<IpcResult<Task[]>>
  createTask: (input: unknown) => Promise<IpcResult<Task>>
  updateTask: (input: unknown) => Promise<IpcResult<Task>>
  changeStatus: (input: unknown) => Promise<IpcResult<Task>>
  archiveTask: (id: string) => Promise<IpcResult<Task>>
  deleteTask: (id: string) => Promise<IpcResult<null>>
  openExternal: (id: string) => Promise<IpcResult<null>>

  taskHistory: (id: string) => Promise<IpcResult<StatusHistoryEntry[]>>
  recentActivity: (limit: number) => Promise<IpcResult<RecentActivityEntry[]>>

  getSettings: () => Promise<IpcResult<Settings>>
  updateSettings: (patch: unknown) => Promise<IpcResult<Settings>>

  openDataFolder: () => Promise<IpcResult<null>>
  exportCsv: () => Promise<IpcResult<ExportResult>>

  listPermissions: () => Promise<IpcResult<PendingPermission[]>>
  decidePermission: (
    requestId: string,
    decision: PermissionDecision,
  ) => Promise<IpcResult<null>>

  hookStatus: () => Promise<IpcResult<HookStatus>>
  hookPreview: () => Promise<IpcResult<HookPreview>>
  hookInstall: () => Promise<IpcResult<HookStatus>>
  hookUninstall: () => Promise<IpcResult<HookStatus>>

  getDevInfo: () => Promise<IpcResult<DevInfo>>

  /** Suscripción a cambios. Devuelve la función para darse de baja. */
  onTasksChanged: (listener: (tasks: Task[]) => void) => () => void
  /** Suscripción a los permisos que esperan una decisión tuya. */
  onPermissionsChanged: (listener: (pending: PendingPermission[]) => void) => () => void
}
