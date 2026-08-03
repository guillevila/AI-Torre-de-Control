import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

/**
 * Prueba mínima de interfaz: recorre la vertical completa del sprint 1.
 *
 * Crear → cambiar estado → ver lo mismo en las dos vistas → recibir un evento
 * local real por HTTP → notificar → cerrar y reabrir sin perder nada.
 *
 * La aplicación se lanza con una carpeta de datos temporal, así que nunca toca
 * los datos reales del usuario.
 */

const appRoot = resolve(__dirname, '..')

// El segundo test parte del estado que deja el primero.
test.describe.configure({ mode: 'serial' })

let userDataDir: string
let app: ElectronApplication
let page: Page

interface NotificationRecord {
  title: string
  body: string
}

/**
 * Intercepta las notificaciones del sistema.
 *
 * Se parchea el prototipo, así que funciona sea cual sea la forma en que el
 * código las haya importado. Se registran sin llegar a mostrarlas, para no
 * llenar el escritorio de avisos cada vez que se ejecutan las pruebas.
 */
async function interceptNotifications(target: ElectronApplication): Promise<void> {
  await target.evaluate(({ Notification }) => {
    const store: { title: string; body: string }[] = []
    ;(globalThis as unknown as Record<string, unknown>)['__torreNotifications'] = store
    Notification.prototype.show = function show(this: { title: string; body: string }): void {
      store.push({ title: this.title, body: this.body })
    } as typeof Notification.prototype.show
  })
}

/**
 * Intercepta la apertura de enlaces externos.
 *
 * Se comprueba que la aplicación pide abrir la URL correcta, sin llegar a
 * lanzar un navegador cada vez que se ejecutan las pruebas.
 */
async function interceptExternalOpens(target: ElectronApplication): Promise<void> {
  await target.evaluate(({ shell }) => {
    const store: string[] = []
    ;(globalThis as unknown as Record<string, unknown>)['__torreOpened'] = store
    shell.openExternal = async (url: string): Promise<void> => {
      store.push(url)
    }
  })
}

const readOpenedUrls = (target: ElectronApplication): Promise<string[]> =>
  target.evaluate(
    () => ((globalThis as unknown as Record<string, unknown>)['__torreOpened'] ?? []) as string[],
  )

const readNotifications = (target: ElectronApplication): Promise<NotificationRecord[]> =>
  target.evaluate(
    () =>
      ((globalThis as unknown as Record<string, unknown>)['__torreNotifications'] ??
        []) as NotificationRecord[],
  )

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  // Los terminales integrados de editores basados en Electron heredan
  // ELECTRON_RUN_AS_NODE=1, que haría arrancar Electron como Node a secas.
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) env[key] = value
  }
  env['TORRE_USER_DATA'] = userDataDir

  const launched = await electron.launch({ args: [appRoot], env })
  const firstWindow = await launched.firstWindow()
  await firstWindow.waitForSelector('[data-testid="summary"]')
  return { app: launched, page: firstWindow }
}

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'torre-e2e-'))
  const launched = await launch()
  app = launched.app
  page = launched.page
  await interceptNotifications(app)
  await interceptExternalOpens(app)
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
  rmSync(userDataDir, { recursive: true, force: true })
})

test('la vertical completa funciona de principio a fin', async () => {
  // ── 1. Arranca vacía ──────────────────────────────────────────────────────
  await expect(page.getByTestId('empty-state')).toBeVisible()

  // ── 2. Crear una tarea a mano ─────────────────────────────────────────────
  await page.getByTestId('new-task').click()
  await page.getByTestId('field-title').fill('Informe de proveedores Q3')
  await page.getByTestId('field-provider').selectOption('chatgpt')
  await page.getByTestId('field-status').selectOption('running')
  await page.getByTestId('field-url').fill('https://example.test/chat/abc')
  await page.getByTestId('submit-task').click()

  const card = page.getByTestId('task-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Informe de proveedores Q3')
  await expect(page.getByTestId('summary-active')).toContainText('1')

  // ── 3. Cambiar el estado a mano ───────────────────────────────────────────
  await card.getByTestId('status-select').selectOption('waiting_user')
  await expect(page.getByTestId('pill-waiting_user')).toBeVisible()
  await expect(page.getByTestId('summary-attention')).toContainText('1')

  // Ese cambio ya debe haber producido un aviso de escritorio.
  await expect.poll(async () => (await readNotifications(app)).length, { timeout: 5000 }).toBe(1)
  expect((await readNotifications(app))[0]?.title).toBe('Te están esperando')

  // ── 4. Las dos vistas muestran el mismo estado (D10) ───────────────────────
  await page.getByTestId('view-office').click()
  const worker = page.getByTestId('office-worker')
  await expect(worker).toHaveCount(1)
  await expect(worker).toHaveAttribute('data-status', 'waiting_user')
  await expect(worker).toContainText('Informe de proveedores Q3')

  // ── 5. La ficha se abre pulsando al trabajador ─────────────────────────────
  await worker.click()
  const detail = page.getByTestId('task-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('Informe de proveedores Q3')
  await expect(detail).toContainText('https://example.test/chat/abc')
  await detail.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByTestId('view-operations').click()

  // ── 6. Un evento local real cambia el estado ──────────────────────────────
  const taskId = await card.getAttribute('data-task-id')
  expect(taskId).toBeTruthy()

  const endpoint = JSON.parse(readFileSync(join(userDataDir, 'event-endpoint.json'), 'utf8')) as {
    host: string
    port: number
    token: string
  }

  const response = await fetch(`http://${endpoint.host}:${endpoint.port}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
    body: JSON.stringify({
      type: 'status_changed',
      taskId,
      status: 'completed',
      source: 'local_event',
      confidence: 'high',
      timestamp: new Date().toISOString(),
    }),
  })
  expect(response.status).toBe(200)

  // La pantalla se actualiza sola, sin recargar nada.
  await expect(page.getByTestId('pill-completed')).toBeVisible()
  await expect(page.getByTestId('summary-completed')).toContainText('1')

  // Y ese cambio produce el segundo aviso, sin duplicar el anterior.
  await expect.poll(async () => (await readNotifications(app)).length, { timeout: 5000 }).toBe(2)
  expect((await readNotifications(app))[1]?.title).toBe('Tarea terminada')

  // ── 7. Un evento sin token se rechaza ─────────────────────────────────────
  const sinToken = await fetch(`http://${endpoint.host}:${endpoint.port}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'status_changed',
      taskId,
      status: 'failed',
      source: 'local_event',
      confidence: 'high',
      timestamp: new Date().toISOString(),
    }),
  })
  expect(sinToken.status).toBe(401)
  await expect(page.getByTestId('pill-completed')).toBeVisible()

  // ── 8. Volver a la conversación externa de un clic (D4) ───────────────────
  await card.getByTestId('open-external').click()
  await expect
    .poll(async () => await readOpenedUrls(app), { timeout: 5000 })
    .toEqual(['https://example.test/chat/abc'])
})

test('los datos siguen ahí después de cerrar y volver a abrir', async () => {
  await app.close()

  const relaunched = await launch()
  app = relaunched.app
  page = relaunched.page

  const card = page.getByTestId('task-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Informe de proveedores Q3')
  await expect(page.getByTestId('pill-completed')).toBeVisible()
})
