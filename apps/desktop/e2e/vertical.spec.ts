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
 * Prueba de interfaz: recorre la vertical completa sobre la aplicación real.
 *
 * Crear → cambiar estado → ver lo mismo en las dos vistas → recibir un evento
 * local por HTTP → notificar → dejar constancia en el historial → cerrar y
 * reabrir sin perder nada.
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
 *
 * También se fuerza `isSupported()` a true. Motivo: en los servidores de
 * integración continua no hay servicio de notificaciones, así que Electron
 * responde que no las soporta y la aplicación —con buen criterio— ni lo
 * intenta. Sin este apaño, la prueba mediría si el servidor tiene demonio de
 * avisos en lugar de medir si NUESTRA lógica decide avisar cuando debe.
 */
async function interceptNotifications(target: ElectronApplication): Promise<void> {
  await target.evaluate(({ Notification }) => {
    const store: { title: string; body: string }[] = []
    ;(globalThis as unknown as Record<string, unknown>)['__torreNotifications'] = store
    Notification.isSupported = () => true
    Notification.prototype.show = function show(this: { title: string; body: string }): void {
      store.push({ title: this.title, body: this.body })
    } as typeof Notification.prototype.show
  })
}

/**
 * Intercepta la apertura de enlaces externos: se comprueba que la aplicación
 * pide abrir la URL correcta, sin lanzar un navegador en cada ejecución.
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

const readNotifications = (target: ElectronApplication): Promise<NotificationRecord[]> =>
  target.evaluate(
    () =>
      ((globalThis as unknown as Record<string, unknown>)['__torreNotifications'] ??
        []) as NotificationRecord[],
  )

const readOpenedUrls = (target: ElectronApplication): Promise<string[]> =>
  target.evaluate(
    () => ((globalThis as unknown as Record<string, unknown>)['__torreOpened'] ?? []) as string[],
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
  await firstWindow.waitForSelector('[data-testid="nav-tower"]')
  return { app: launched, page: firstWindow }
}

function readEndpoint(): { host: string; port: number; token: string } {
  return JSON.parse(readFileSync(join(userDataDir, 'event-endpoint.json'), 'utf8')) as {
    host: string
    port: number
    token: string
  }
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
  // El aviso de «te espera» normalmente espera 45 s a ver si vuelves. Para la
  // prueba se pone a cero: lo que se comprueba aquí es que el aviso SALE, y esa
  // espera tiene sus propios tests unitarios.
  // `globalThis` es el `window` del renderer; se usa así porque este archivo se
  // compila sin los tipos del navegador.
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        torre: { updateSettings: (patch: unknown) => Promise<unknown> }
      }
    ).torre.updateSettings({ idleNoticeDelaySeconds: 0 }),
  )

  // ── 1. Arranca vacía ──────────────────────────────────────────────────────
  await page.getByTestId('nav-tasks').click()
  await expect(page.getByTestId('tasks-empty')).toBeVisible()

  // ── 2. Registrar una tarea ────────────────────────────────────────────────
  await page.getByTestId('new-task').click()
  await page.getByTestId('field-title').fill('Informe de proveedores Q3')
  await page.getByTestId('field-url').fill('https://chatgpt.com/c/abc-123')

  // La plataforma se deduce sola del dominio del enlace.
  await expect(page.getByTestId('platform-detected')).toBeVisible()
  await expect(page.getByTestId('chip-chatgpt')).toHaveAttribute('data-active', 'true')

  await page.getByTestId('initial-running').click()
  await page.getByTestId('submit-task').click()

  const row = page.getByTestId('task-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Informe de proveedores Q3')
  await expect(row.getByTestId('badge-running')).toBeVisible()

  // ── 3. La Torre cuenta lo mismo ───────────────────────────────────────────
  await page.getByTestId('nav-tower').click()
  await expect(page.getByTestId('counter-running')).toContainText('1')

  // ── 4. Cambiar el estado a mano desde la ficha ────────────────────────────
  await page.getByTestId('nav-tasks').click()
  await row.getByTestId('open-detail').click()
  const detail = page.getByTestId('task-detail')
  await expect(detail).toBeVisible()
  await detail.getByTestId('fix-waiting_user').click()

  await expect(detail.getByTestId('pill-waiting_user')).toBeVisible()
  await expect(page.getByTestId('attention-badge')).toContainText('1')

  // Ese cambio ya debe haber producido un aviso de escritorio.
  await expect.poll(async () => (await readNotifications(app)).length, { timeout: 5000 }).toBe(1)
  expect((await readNotifications(app))[0]?.title).toBe('Te están esperando')

  // ── 5. El historial deja constancia (D19) ─────────────────────────────────
  const history = detail.getByTestId('history-list').locator('li')
  await expect(history).toHaveCount(2)
  await expect(history.first()).toContainText('Te espera')
  await expect(history.last()).toContainText('al registrarla')

  await detail.getByRole('button', { name: 'Cerrar' }).click()

  // ── 6. Las dos vistas muestran el mismo estado (D10) ──────────────────────
  await page.getByTestId('view-office').click()
  const worker = page.getByTestId('office-worker')
  await expect(worker).toHaveCount(1)
  await expect(worker).toHaveAttribute('data-status', 'waiting_user')
  // En la oficina, quien te espera levanta la mano en tu puerta.
  await expect(worker.getByTestId('worker-bubble')).toBeVisible()

  // ── 7. La ficha se abre pulsando al trabajador ────────────────────────────
  await worker.locator('.worker__figure').click()
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('https://chatgpt.com/c/abc-123')
  await detail.getByRole('button', { name: 'Cerrar' }).click()
  // De la fábrica se sale por su consola de mando: es pantalla completa y no
  // tiene cabecera con el conmutador. Es lo que la hace parecer una sala de
  // control y no una pestaña más.
  await page.getByTestId('factory-tower').click()
  await page.getByTestId('nav-tasks').click()

  // ── 8. Un evento local real cambia el estado ──────────────────────────────
  const taskId = await row.getAttribute('data-task-id')
  expect(taskId).toBeTruthy()
  const endpoint = readEndpoint()

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
  await expect(row.getByTestId('badge-completed')).toBeVisible()
  await expect.poll(async () => (await readNotifications(app)).length, { timeout: 5000 }).toBe(2)
  expect((await readNotifications(app))[1]?.title).toBe('Tarea terminada')

  // ── 9. Un evento sin clave local se rechaza ───────────────────────────────
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
  await expect(row.getByTestId('badge-completed')).toBeVisible()

  // ── 10. Volver a la conversación de un clic (D4) ──────────────────────────
  await row.getByTestId('open-external').click()
  await expect
    .poll(async () => await readOpenedUrls(app), { timeout: 5000 })
    .toEqual(['https://chatgpt.com/c/abc-123'])
})

test('los ajustes se guardan y gobiernan los avisos', async () => {
  await page.getByTestId('nav-settings').click()
  await expect(page.getByTestId('settings-view')).toBeVisible()

  // Silenciar los avisos de tarea terminada.
  await page.getByTestId('switch-toggle-completed').click()
  await expect(page.getByTestId('toggle-completed')).not.toBeChecked()

  // Los ajustes son una ventana encima, no una sección: se cierran y te dejan
  // donde estabas. Sin cerrarla, el fondo no se puede pulsar.
  await page.getByTestId('settings-close').click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()

  await page.getByTestId('nav-tasks').click()
  const taskId = await page.getByTestId('task-row').getAttribute('data-task-id')
  const before = (await readNotifications(app)).length
  const endpoint = readEndpoint()

  // Se reabre y se vuelve a cerrar: el segundo cierre ya no debe avisar.
  for (const status of ['running', 'completed']) {
    await fetch(`http://${endpoint.host}:${endpoint.port}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
      body: JSON.stringify({
        type: 'status_changed',
        taskId,
        status,
        source: 'local_event',
        confidence: 'high',
        timestamp: new Date().toISOString(),
      }),
    })
  }

  await expect(page.getByTestId('task-row').getByTestId('badge-completed')).toBeVisible()
  expect((await readNotifications(app)).length).toBe(before)
})

/**
 * Una tarea recién registrada tiene que poder tocarse.
 *
 * Encontrado en uso real: el dueño del proyecto no podía seleccionar —ni por
 * tanto borrar— las tareas «en cola». La Torre solo listaba lo que trabaja y lo
 * que te reclama, y una conversación recién registrada no es ninguna de las
 * dos: desaparecía de la pantalla principal.
 *
 * Daba igual mientras «en cola» era un estado raro. Con la extensión, TODA
 * conversación que registras nace ahí.
 */
test('una tarea en cola se ve en la Torre y se puede abrir', async () => {
  const crear = (title: string, url: string) =>
    page.evaluate(
      ([t, u]) =>
        (
          globalThis as unknown as {
            torre: { createTask: (input: unknown) => Promise<unknown> }
          }
        ).torre.createTask({
          title: t,
          provider: 'chatgpt',
          externalUrl: u,
          status: 'queued',
        }),
      [title, url],
    )

  await crear('Conversación en cola', 'https://chatgpt.com/c/en-cola-1')

  await page.getByTestId('nav-tower').click()

  // Está en la Torre, no escondida en otra pantalla.
  const enCola = page.getByTestId('tower-queued')
  await expect(enCola).toBeVisible()
  await expect(enCola.getByText('Conversación en cola')).toBeVisible()

  // Y se puede abrir para actuar sobre ella: es lo que faltaba.
  await enCola.getByText('Conversación en cola').click()
  await expect(page.getByTestId('task-detail')).toBeVisible()

  // Hasta borrarla, que era exactamente lo que no se podía hacer.
  await page.getByTestId('delete-task').click()
  await page.getByTestId('confirm-delete').click()

  await expect(page.getByTestId('tower-queued')).toBeHidden()
})

/**
 * Pinchar un muñeco de la oficina tiene que abrir su ficha.
 *
 * Encontrado en uso real, y era peor de lo que parecía: NINGÚN muñeco se podía
 * pulsar con el ratón. La planta va inclinada y cada figura lleva la
 * contrarrotación que la endereza; eso mueve los botones donde se ven, pero el
 * navegador seguía registrando el clic sobre el contenedor. Caía en el hueco,
 * sin error y sin pista.
 *
 * La prueba usa un clic de RATÓN de verdad a propósito. Un `element.click()`
 * de JavaScript funcionaba perfectamente —el manejador nunca estuvo mal—, así
 * que una prueba escrita así habría pasado en verde mientras la aplicación
 * seguía rota.
 */
test('pinchar un muñeco de la oficina abre su ficha', async () => {
  await page.evaluate(() =>
    (globalThis as unknown as { torre: { createTask: (i: unknown) => Promise<unknown> } })
      .torre.createTask({
        title: 'Muñeco en cola',
        provider: 'chatgpt',
        externalUrl: 'https://chatgpt.com/c/muneco-1',
        status: 'queued',
      }),
  )

  await page.getByTestId('view-office').click()

  const muneco = page.getByTestId('office-worker').filter({ hasText: 'Muñeco en cola' })
  await expect(muneco).toBeVisible()

  // Se pulsa la FIGURA, que es lo que se ve y lo que pulsa una persona, con un
  // clic de ratón real. Un element.click() de JavaScript siempre funcionó: una
  // prueba escrita así habría pasado en verde con la aplicación rota.
  await muneco.getByRole('button').first().click()
  await expect(page.getByTestId('task-detail')).toBeVisible()

  // Y desde ahí se puede borrar, que es a lo que se venía.
  await page.getByTestId('delete-task').click()
  await page.getByTestId('confirm-delete').click()
  await expect(muneco).toBeHidden()

  await page.getByTestId('factory-tower').click()
})

test('los datos siguen ahí después de cerrar y volver a abrir', async () => {
  await app.close()

  const relaunched = await launch()
  app = relaunched.app
  page = relaunched.page

  await page.getByTestId('nav-tasks').click()
  const row = page.getByTestId('task-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Informe de proveedores Q3')
  await expect(row.getByTestId('badge-completed')).toBeVisible()

  // Y el historial también sobrevive.
  await row.getByTestId('open-detail').click()
  await expect(page.getByTestId('history-list').locator('li').first()).toBeVisible()
})

/**
 * La fábrica es pantalla completa, y sus dos salidas funcionan.
 *
 * Al quitar la barra lateral y la cabecera, esas dos puertas son lo ÚNICO que
 * queda para salir de la oficina. Si una se rompe, el usuario se queda
 * encerrado en una pantalla sin menús — y eso no lo cazaría ninguna prueba que
 * solo mire que la vista se pinta.
 */
test('la fábrica ocupa la pantalla y sus dos salidas llevan a alguna parte', async () => {
  // Las pruebas comparten la misma aplicación abierta: si una anterior dejó
  // una ficha encima, aquí estorba. Escape es lo que pulsaría una persona.
  await page.keyboard.press('Escape')
  await page.getByTestId('view-office').click()
  await expect(page.getByTestId('office-view')).toBeVisible()

  // Sin barra lateral ni cabecera: la nave llega hasta el borde.
  await expect(page.getByTestId('nav-tower')).toBeHidden()

  // La consola de mando lleva al detalle de todo.
  await page.getByTestId('factory-tower').click()
  await expect(page.getByTestId('tower-view')).toBeVisible()
  await expect(page.getByTestId('nav-tower')).toBeVisible()

  // Y la rueda abre los ajustes ENCIMA de la nave, sin sacarte de ella: es la
  // diferencia entre tocar un interruptor y perder la sala de control.
  await page.getByTestId('view-office').click()
  await page.getByTestId('factory-settings').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.getByTestId('settings-view')).toBeVisible()
  await expect(page.getByTestId('office-view')).toBeVisible()

  // Y dentro está TODO, incluido el receptor local, que antes colgaba fuera.
  await page.getByTestId('open-dev-panel').click()
  await expect(page.getByTestId('dev-panel')).toBeVisible()
  await page.getByTestId('dev-panel').getByRole('button', { name: 'Cerrar' }).click()
  // Al cerrarlo se vuelve a los ajustes, no a la pantalla de fondo.
  await expect(page.getByTestId('settings-dialog')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  await expect(page.getByTestId('office-view')).toBeVisible()
})
