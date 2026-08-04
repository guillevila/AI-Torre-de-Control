import { statSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import { IPC, type DevInfo, type PendingPermission, type Task } from '@torre/contracts'
import { HookActivityLog } from './hooks/hook-activity-log.js'
import { HookInstaller } from './hooks/hook-installer.js'
import { SessionLinker } from './hooks/session-linker.js'
import { SessionStatusService } from './hooks/session-status-service.js'
import { IntakeService } from './intake/intake-service.js'
import { PermissionRegistry } from './permissions/permission-registry.js'
import { PermissionService } from './permissions/permission-service.js'
import { SqliteTaskRepository } from './db/sqlite-task-repository.js'
import { LocalEventServer } from './events/local-event-server.js'
import { endpointFilePath, loadOrCreateToken, writeEndpointFile } from './events/endpoint.js'
import { showDesktopNotification } from './notifications/desktop-notifier.js'
import { createNotifier } from './notifications/notifier.js'
import { registerIpcHandlers } from './ipc/handlers.js'
import { TaskService } from './services/task-service.js'
import { SettingsStore } from './settings/settings-store.js'

/**
 * Arranque de la aplicación: monta las piezas y las conecta.
 *
 * Este archivo es el único que sabe que existen a la vez la base de datos, los
 * ajustes, el receptor de eventos, las notificaciones y la ventana. Cada pieza
 * por separado no conoce a las demás.
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

/**
 * Identidad de la aplicación ante Windows.
 *
 * Sin esto, Windows atribuye las notificaciones a «electron.app.Electron»: el
 * aviso sale con el nombre y el icono genéricos de Electron, se mezcla con los
 * de cualquier otra aplicación Electron del sistema, y el usuario no puede
 * configurarlo por separado en Configuración → Notificaciones.
 *
 * Hay que llamarlo ANTES de que la aplicación esté lista. En macOS y Linux es
 * una operación sin efecto.
 */
app.setAppUserModelId('net.alsari.torre-de-control')

const userDataOverride = process.env['TORRE_USER_DATA']
app.setPath('userData', userDataOverride ?? join(app.getPath('appData'), 'ai-torre-de-control'))

/**
 * Desarrollo se detecta por la presencia del servidor de Vite, no por
 * `app.isPackaged`: una aplicación construida pero todavía sin empaquetar
 * (como la que usan las pruebas de interfaz) es a todos los efectos producción.
 */
const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

/** Cada cuánto se revisa si alguna tarea automática se ha quedado sin señal. */
const STALE_SWEEP_INTERVAL_MS = 60_000

let mainWindow: BrowserWindow | null = null
let repository: SqliteTaskRepository | null = null
let eventServer: LocalEventServer | null = null
let devInfo: DevInfo | null = null
let sweepTimer: NodeJS.Timeout | null = null
let permissionRegistry: PermissionRegistry | null = null

function broadcastTasks(tasks: Task[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.tasksChanged, tasks)
  }
}

function broadcastPermissions(pending: PendingPermission[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.permissionsChanged, pending)
  }
}

/**
 * Política de contenidos de la ventana.
 *
 * En producción se cierra a cal y canto: la interfaz solo puede cargar lo que
 * viene empaquetado con la aplicación (incluidas las tipografías, que van
 * dentro). En desarrollo hay que aflojarla porque la recarga en caliente de
 * Vite necesita evaluar código y abrir un WebSocket local.
 */
function applyContentSecurityPolicy(): void {
  if (!isDev) return // En producción la política viaja dentro del propio HTML.

  const policy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' ws://localhost:* http://localhost:*",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
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
      if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
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
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'AI Torre de Control',
    backgroundColor: '#F5F1EA',
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
  if (rendererUrl) void window.loadURL(rendererUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

function databaseBytes(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

async function bootstrap(): Promise<void> {
  const userDataDir = app.getPath('userData')
  const databasePath = join(userDataDir, 'torre.db')

  repository = new SqliteTaskRepository(databasePath)
  const settings = new SettingsStore(join(userDataDir, 'settings.json'))
  const notify = createNotifier(showDesktopNotification, {
    // Se lee el ajuste en cada aviso, no al arrancar: si lo cambias, aplica ya.
    idleDelayMs: () => settings.get().idleNoticeDelaySeconds * 1000,
  })

  const service = new TaskService({
    repository,
    settings: () => settings.get(),
    onStatusChange: (task, _previous, shouldNotify) => notify(task, shouldNotify),
    onChange: broadcastTasks,
  })

  // ── Enlace con Claude Code (D18-bis) ───────────────────────────────────────
  //
  // El registro de permisos vive SOLO en memoria (D20): nada de lo que se
  // enseña en la tarjeta —incluido el comando completo— toca el disco.
  permissionRegistry = new PermissionRegistry({ onChange: broadcastPermissions })
  const linker = new SessionLinker(service)
  // Ventana para poder mirar qué llega del enlace sin abrir la base de datos.
  const hookActivity = new HookActivityLog()
  const permissionService = new PermissionService({
    registry: permissionRegistry,
    linker,
    taskService: service,
    activity: hookActivity,
  })
  const sessionStatus = new SessionStatusService(linker, service, hookActivity)
  // Altas que llegan de fuera (extensión de navegador). No duplica tareas.
  const intakeService = new IntakeService({ taskService: service })
  const hookInstaller = new HookInstaller(userDataDir)

  // ── Receptor local de eventos ──────────────────────────────────────────────
  const token = loadOrCreateToken(userDataDir)
  eventServer = new LocalEventServer({
    token,
    onEvent: (raw) => service.ingestEvent(raw),
    onPermission: (raw) => permissionService.request(raw),
    onSession: (raw) => sessionStatus.apply(raw),
    onIntake: (raw) => intakeService.register(raw),
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
    dataDirectory: userDataDir,
    databaseBytes: databaseBytes(databasePath),
    // Estado REAL de las integraciones. El de Claude Code se lee del disco cada
    // vez que se pide, no se recuerda: si lo desinstalas por fuera, se nota.
    integrations: [
      { provider: 'claude_code', label: 'Claude Code · hook', status: 'not_configured' },
      { provider: 'chatgpt', label: 'ChatGPT · extensión', status: 'planned' },
      { provider: 'cowork', label: 'Cowork · extensión', status: 'planned' },
      { provider: 'codex', label: 'Codex · monitor', status: 'planned' },
    ],
  }

  const currentDevInfo = (): DevInfo => {
    const base = devInfo as DevInfo
    let hookInstalled = false
    try {
      hookInstalled = hookInstaller.status().installed
    } catch {
      // Una configuración de Claude Code ilegible no debe impedir arrancar.
    }
    return {
      ...base,
      databaseBytes: databaseBytes(databasePath),
      integrations: base.integrations.map((integration) =>
        integration.provider === 'claude_code'
          ? { ...integration, status: hookInstalled ? 'installed' : 'not_configured' }
          : integration,
      ),
    }
  }

  registerIpcHandlers({
    service,
    settings,
    permissions: permissionService,
    registry: permissionRegistry,
    hooks: hookInstaller,
    hookActivity,
    dataDirectory: userDataDir,
    getDevInfo: currentDevInfo,
  })

  applyContentSecurityPolicy()
  hardenNavigation()

  mainWindow = createWindow()

  // Barrido periódico: las tareas automáticas que llevan demasiado tiempo sin
  // dar señales pasan a «sin confirmar» en lugar de fingir que siguen vivas (D9).
  service.sweepStale()
  sweepTimer = setInterval(() => service.sweepStale(), STALE_SWEEP_INTERVAL_MS)
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
  if (sweepTimer) clearInterval(sweepTimer)
  // Se libera todo permiso pendiente antes de cerrar: si no, la sesión de
  // Claude Code que esperaba se quedaría colgada hasta agotar su propio tiempo.
  permissionRegistry?.releaseAll()
  void eventServer?.stop()
  repository?.close()
})
