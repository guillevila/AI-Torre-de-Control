import { ipcMain } from 'electron'
import { IPC, type DevInfo, type IpcResult, type Task } from '@torre/contracts'
import { TaskServiceError, type TaskService } from '../services/task-service.js'
import { openExternalUrl } from '../system/open-external.js'

/**
 * Registro de los canales que la interfaz puede invocar.
 *
 * Cada manejador devuelve `{ ok: true, data }` o `{ ok: false, error }` en lugar
 * de lanzar excepciones. Así un fallo previsible (un título vacío, una tarea que
 * ya no existe) llega a la pantalla como un mensaje comprensible, y no como un
 * error genérico de comunicación.
 */

export interface IpcHandlerDeps {
  service: TaskService
  getDevInfo: () => DevInfo
}

const ok = <T>(data: T): IpcResult<T> => ({ ok: true, data })

function guard<T>(operation: () => T): IpcResult<T> {
  try {
    return ok(operation())
  } catch (error) {
    if (error instanceof TaskServiceError) return { ok: false, error: error.message }
    console.error('[torre] Error inesperado atendiendo una petición de la interfaz:', error)
    return { ok: false, error: 'Ha ocurrido un error inesperado. Revisa el registro técnico.' }
  }
}

export function registerIpcHandlers({ service, getDevInfo }: IpcHandlerDeps): void {
  ipcMain.handle(IPC.tasksList, (): IpcResult<Task[]> => guard(() => service.list()))

  ipcMain.handle(IPC.tasksCreate, (_event, input: unknown): IpcResult<Task> =>
    guard(() => service.create(input)),
  )

  ipcMain.handle(IPC.tasksUpdate, (_event, input: unknown): IpcResult<Task> =>
    guard(() => service.update(input)),
  )

  ipcMain.handle(IPC.tasksChangeStatus, (_event, input: unknown): IpcResult<Task> =>
    guard(() => service.changeStatus(input)),
  )

  ipcMain.handle(IPC.tasksArchive, (_event, id: unknown): IpcResult<Task> =>
    guard(() => service.archive(id)),
  )

  ipcMain.handle(IPC.tasksOpenExternal, async (_event, id: unknown): Promise<IpcResult<null>> => {
    try {
      const task = typeof id === 'string' ? service.getById(id) : null
      if (!task) return { ok: false, error: 'Esa tarea ya no existe.' }
      if (!task.externalUrl) {
        return { ok: false, error: 'Esta tarea no tiene ningún enlace guardado.' }
      }
      await openExternalUrl(task.externalUrl)
      return ok(null)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'No se pudo abrir.' }
    }
  })

  ipcMain.handle(IPC.devInfo, (): IpcResult<DevInfo> => guard(() => getDevInfo()))
}
