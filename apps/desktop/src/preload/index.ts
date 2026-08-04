import { contextBridge, ipcRenderer } from 'electron'
// Se importa la entrada específica de IPC, NO el índice del paquete.
// El índice arrastra los esquemas de validación (y con ellos `zod`), y un
// preload aislado no puede cargar módulos de Node en tiempo de ejecución.
// Este módulo son constantes y tipos: al compilar no queda ninguna dependencia.
import { IPC, type TorreBridge } from '@torre/contracts/ipc'
// `import type` se borra al compilar: no genera ninguna carga en ejecución.
import type { PendingPermission, Task } from '@torre/contracts'

/**
 * Puente entre la interfaz y el proceso principal.
 *
 * Este es el ÚNICO punto por el que la pantalla puede pedir algo al sistema.
 * La interfaz no tiene acceso a Node, ni al disco, ni a la red: solo puede
 * llamar a las operaciones de esta lista. Si mañana hiciera falta otra, hay que
 * añadirla aquí a conciencia — que es exactamente el control que se busca.
 */
const bridge: TorreBridge = {
  listTasks: () => ipcRenderer.invoke(IPC.tasksList),
  createTask: (input) => ipcRenderer.invoke(IPC.tasksCreate, input),
  updateTask: (input) => ipcRenderer.invoke(IPC.tasksUpdate, input),
  changeStatus: (input) => ipcRenderer.invoke(IPC.tasksChangeStatus, input),
  archiveTask: (id) => ipcRenderer.invoke(IPC.tasksArchive, id),
  deleteTask: (id) => ipcRenderer.invoke(IPC.tasksDelete, id),
  openExternal: (id) => ipcRenderer.invoke(IPC.tasksOpenExternal, id),

  taskHistory: (id) => ipcRenderer.invoke(IPC.tasksHistory, id),
  recentActivity: (limit) => ipcRenderer.invoke(IPC.recentActivity, limit),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),

  openDataFolder: () => ipcRenderer.invoke(IPC.dataOpenFolder),
  exportCsv: () => ipcRenderer.invoke(IPC.dataExportCsv),

  listPermissions: () => ipcRenderer.invoke(IPC.permissionsList),
  decidePermission: (requestId, decision) =>
    ipcRenderer.invoke(IPC.permissionsDecide, { requestId, decision }),

  hookStatus: () => ipcRenderer.invoke(IPC.hookStatus),
  hookPreview: () => ipcRenderer.invoke(IPC.hookPreview),
  hookInstall: () => ipcRenderer.invoke(IPC.hookInstall),
  hookUninstall: () => ipcRenderer.invoke(IPC.hookUninstall),

  getDevInfo: () => ipcRenderer.invoke(IPC.devInfo),

  onTasksChanged: (listener) => {
    const handler = (_event: unknown, tasks: Task[]): void => listener(tasks)
    ipcRenderer.on(IPC.tasksChanged, handler)
    return () => {
      ipcRenderer.removeListener(IPC.tasksChanged, handler)
    }
  },

  onPermissionsChanged: (listener) => {
    const handler = (_event: unknown, pending: PendingPermission[]): void => listener(pending)
    ipcRenderer.on(IPC.permissionsChanged, handler)
    return () => {
      ipcRenderer.removeListener(IPC.permissionsChanged, handler)
    }
  },
}

contextBridge.exposeInMainWorld('torre', bridge)
