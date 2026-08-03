import { join } from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import { IPC, type DevInfo, type Task } from '@torre/contracts'
import { SqliteTaskRepository } from './db/sqlite-task-repository.js'
import { LocalEventServer } from './events/local-event-server.js'
import { endpointFilePath, loadOrCreateToken, writeEndpointFile } from './events/endpoint.js'
import { showDesktopNotification } from './notifications/desktop-notifier.js'
import { createNotifier } from './notifications/notifier.js'
import { registerIpcHandlers } from './ipc/handlers.js'
import { TaskService } from './services/task-service.js'

/**
 * Arranque de la aplicación: monta las piezas y las conecta.
 *
 * Este archivo es el único que sabe que existen a la vez la base de datos, el
 * receptor de eventos, las notificaciones y la ventana. Cada pieza por separado
 * no conoce a las demás.
 */

/**
 * Carpeta de datos, fijada explícitamente.
 *
 * Por defecto Electron la deriva del nombre del paquete, que aquí sería
 * «@torre/desktop» y daría una ruta rara y distinta entre desarrollo y
 * producción. Fijándola a mano, la aplicación y el script de eventos siempre
 * miran al mismo sitio.
 */
app.setName('AI Torre de Control')
const userDataOverride = process.env['TORRE_USER_DATA']
app.setPath(
  'userData',
  userDataOverride ?? join(app.getPath('appData'), 'ai-torre-de-control'),
)

/**
 * Desarrollo se detecta por la presencia del servidor de Vite, no por
 * `app.isPackaged`: una aplicación construida pero todavía sin empaquetar
 * (como la que usan las pruebas de interfaz) es a todos los efectos producción.
 */
const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

let mainWindow: BrowserWindow | null = null
let repository: SqliteTaskRepository | null = null
let eventServer: LocalEventServer | null = null
let devInfo: DevInfo | null = null

function broadcastTasks(tasks: Task[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.tasksChanged, tasks)
  }
}

/**
 * Política de contenidos de la ventana.
 *
 * En producción se cierra a cal y canto: la interfaz solo puede cargar lo que
 * viene empaquetado con la aplicación. En desarrollo hay que aflojarla porque
 * la recarga en caliente de Vite necesita evaluar código y abrir un WebSocket
 * local. Ver la deuda técnica anotada en docs/ARQUITECTURA.md.
 */
function applyContentSecurityPolicy(): void {
  const policy = isDev
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self' ws://localhost:* http://localhost:*",
        "object-src 'none'",
        "base-uri 'none'",
      ]
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ]

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy.join('; ')],
      },
    })
  })
}

/**
 * Endurecimiento estándar de Electron: la ventana de la aplicación no puede
 * navegar a ningún sitio externo ni abrir ventanas nuevas. Los enlaces externos
 * se abren SIEMPRE en el navegador del sistema, previa validación.
 */
function hardenNavigation(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    contents.on('will-navigate', (event, url) => {
      const allowed = process.env['ELECTRON_RENDERER_URL']
      if (allowed && url.startsWith(allowed)) return
      if (url.startsWith('file://')) return
      event.preventDefault()
    })
  })
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'AI Torre de Control',
    backgroundColor: '#0f1420',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Las tres líneas que impiden que la interfaz toque el sistema.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

async function bootstrap(): Promise<void> {
  const userDataDir = app.getPath('userData')
  const databasePath = join(userDataDir, 'torre.db')

  repository = new SqliteTaskRepository(databasePath)

  const notify = createNotifier(showDesktopNotification)

  const service = new TaskService({
    repository,
    onNotify: (task) => notify(task),
    onChange: broadcastTasks,
  })

  // ── Receptor local de eventos ──────────────────────────────────────────────
  const token = loadOrCreateToken(userDataDir)
  eventServer = new LocalEventServer({
    token,
    onEvent: (raw) => service.ingestEvent(raw),
  })

  let address: { host: string; port: number } | null = null
  try {
    address = await eventServer.start()
    writeEndpointFile(userDataDir, { host: address.host, port: address.port, token })
    console.log(`[torre] Receptor local escuchando en http://${address.host}:${address.port}`)
  } catch (error) {
    // Que no arranque el receptor NO debe impedir usar la aplicación: el control
    // manual siempre tiene que funcionar (D6, y §12 de SYSTEM_VISION).
    console.error('[torre] No se pudo abrir el receptor local de eventos:', error)
    eventServer = null
  }

  devInfo = {
    eventServer: {
      listening: address !== null,
      host: address?.host ?? '127.0.0.1',
      port: address?.port ?? null,
      token: address ? token : null,
      tokenPath: endpointFilePath(userDataDir),
    },
    databasePath,
  }

  registerIpcHandlers({ service, getDevInfo: () => devInfo as DevInfo })

  applyContentSecurityPolicy()
  hardenNavigation()

  mainWindow = createWindow()
}

// Una sola instancia: dos ventanas escribiendo la misma base de datos sería
// una fuente segura de estados incoherentes.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    await bootstrap()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void eventServer?.stop()
  repository?.close()
})
