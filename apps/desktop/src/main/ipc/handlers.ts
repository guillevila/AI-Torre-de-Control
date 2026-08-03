import { writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  IPC,
  type DevInfo,
  type ExportResult,
  type IpcResult,
  type RecentActivityEntry,
  type Settings,
  type StatusHistoryEntry,
  type Task,
} from '@torre/contracts'
import { TaskServiceError, type TaskService } from '../services/task-service.js'
import { tasksToCsv } from '../services/csv-export.js'
import type { SettingsStore } from '../settings/settings-store.js'
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
  settings: SettingsStore
  getDevInfo: () => DevInfo
  dataDirectory: string
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

async function guardAsync<T>(operation: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return ok(await operation())
  } catch (error) {
    if (error instanceof TaskServiceError) return { ok: false, error: error.message }
    console.error('[torre] Error inesperado atendiendo una petición de la interfaz:', error)
    return { ok: false, error: 'Ha ocurrido un error inesperado. Revisa el registro técnico.' }
  }
}

export function registerIpcHandlers({
  service,
  settings,
  getDevInfo,
  dataDirectory,
}: IpcHandlerDeps): void {
  // ─── Tareas ────────────────────────────────────────────────────────────────

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

  ipcMain.handle(IPC.tasksDelete, (_event, id: unknown): IpcResult<null> =>
    guard(() => {
      service.remove(id)
      return null
    }),
  )

  ipcMain.handle(IPC.tasksHistory, (_event, id: unknown): IpcResult<StatusHistoryEntry[]> =>
    guard(() => service.history(id)),
  )

  ipcMain.handle(IPC.recentActivity, (_event, limit: unknown): IpcResult<RecentActivityEntry[]> =>
    guard(() => service.recentActivity(typeof limit === 'number' ? limit : 12)),
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

  // ─── Ajustes ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.settingsGet, (): IpcResult<Settings> => guard(() => settings.get()))

  ipcMain.handle(IPC.settingsUpdate, (_event, patch: unknown): IpcResult<Settings> =>
    guard(() => settings.update(patch)),
  )

  // ─── Datos ─────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.dataOpenFolder, async (): Promise<IpcResult<null>> => {
    const error = await shell.openPath(dataDirectory)
    if (error) return { ok: false, error: `No se pudo abrir la carpeta: ${error}` }
    return ok(null)
  })

  ipcMain.handle(
    IPC.dataExportCsv,
    async (event): Promise<IpcResult<ExportResult>> =>
      guardAsync(async () => {
        const tasks = service.list()
        const window = BrowserWindow.fromWebContents(event.sender)
        const suggested = join(app.getPath('downloads'), 'torre-de-control.csv')

        const result = window
          ? await dialog.showSaveDialog(window, {
              title: 'Exportar tareas',
              defaultPath: suggested,
              filters: [{ name: 'CSV', extensions: ['csv'] }],
            })
          : await dialog.showSaveDialog({ defaultPath: suggested })

        if (result.canceled || !result.filePath) {
          return { written: false, path: null, rows: 0 }
        }

        await writeFile(result.filePath, tasksToCsv(tasks), 'utf8')
        return { written: true, path: basename(result.filePath), rows: tasks.length }
      }),
  )

  ipcMain.handle(IPC.devInfo, (): IpcResult<DevInfo> => guard(() => getDevInfo()))
}
