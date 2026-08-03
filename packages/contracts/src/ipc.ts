import type { Provider, Task } from './task.js'
import type { RecentActivityEntry, StatusHistoryEntry } from './history.js'
import type { Settings } from './settings.js'

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

  /** Renderer → main: datos del panel de desarrollo (puerto y token del receptor). */
  devInfo: 'dev:info',

  /** Main → renderer: algo cambió, aquí tienes el estado nuevo completo. */
  tasksChanged: 'tasks:changed',
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
  /** Estado real de cada integración. Hoy ninguna está instalada. */
  integrations: { provider: Provider; label: string; status: 'not_configured' | 'planned' }[]
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

  getDevInfo: () => Promise<IpcResult<DevInfo>>

  /** Suscripción a cambios. Devuelve la función para darse de baja. */
  onTasksChanged: (listener: (tasks: Task[]) => void) => () => void
}
