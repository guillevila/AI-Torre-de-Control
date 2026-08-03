import type { Task } from './task.js'

/**
 * Canales de comunicación entre el proceso principal de Electron (que tiene
 * acceso al disco y a la red local) y la interfaz React (que no tiene ninguno).
 *
 * La interfaz NUNCA toca la base de datos ni el sistema operativo directamente:
 * solo puede pedir estas operaciones concretas a través del puente del preload.
 */
export const IPC = {
  /** Renderer → main: pedir la lista completa de tareas. */
  tasksList: 'tasks:list',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksChangeStatus: 'tasks:change-status',
  tasksArchive: 'tasks:archive',
  /** Renderer → main: abrir el enlace externo de una tarea en el navegador. */
  tasksOpenExternal: 'tasks:open-external',
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
}

/** Superficie exacta que el preload expone a la interfaz. Nada más. */
export interface TorreBridge {
  listTasks: () => Promise<IpcResult<Task[]>>
  createTask: (input: unknown) => Promise<IpcResult<Task>>
  updateTask: (input: unknown) => Promise<IpcResult<Task>>
  changeStatus: (input: unknown) => Promise<IpcResult<Task>>
  archiveTask: (id: string) => Promise<IpcResult<Task>>
  openExternal: (id: string) => Promise<IpcResult<null>>
  getDevInfo: () => Promise<IpcResult<DevInfo>>
  /** Suscripción a cambios. Devuelve la función para darse de baja. */
  onTasksChanged: (listener: (tasks: Task[]) => void) => () => void
}
