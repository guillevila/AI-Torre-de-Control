import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

/**
 * La ventanita que sale al paso junto al puntero (D26), de punta a punta.
 *
 * Esto NO se puede comprobar con tests unitarios: lo que hay que verificar es
 * que Electron abre de verdad una **segunda ventana**, que enseña el turno, que
 * responder desde ella llega hasta quien preguntaba, y —lo más importante— que
 * su aspa **no descarta nada**. Se hace con el mecanismo real: una petición
 * HTTP al receptor que se queda esperando, igual que hace el enlace.
 */

const appRoot = resolve(__dirname, '..')

test.describe.configure({ mode: 'serial' })

let userDataDir: string
let app: ElectronApplication
let page: Page

interface Endpoint {
  host: string
  port: number
  token: string
}

const readEndpoint = (): Endpoint =>
  JSON.parse(readFileSync(join(userDataDir, 'event-endpoint.json'), 'utf8')) as Endpoint

/** Manda un fin de turno y devuelve la promesa SIN esperarla. */
function endTurn(output: string, cwd: string, steps?: unknown[]) {
  const endpoint = readEndpoint()
  return fetch(`http://${endpoint.host}:${endpoint.port}/turns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
    body: JSON.stringify({
      requestId: randomUUID(),
      sessionId: randomUUID(),
      cwd,
      output,
      ...(steps ? { steps } : {}),
      timestamp: new Date().toISOString(),
    }),
  })
}

/** La ventanita, distinguida de la Torre por su marca en el `body`. */
async function popupWindow(): Promise<Page> {
  for (const ventana of app.windows()) {
    if (await ventana.locator('body[data-ventana="aviso"]').count()) return ventana
  }
  throw new Error('No se encontró la ventanita del turno')
}

/**
 * ¿Está la ventanita en pantalla?
 *
 * Se pregunta al proceso principal de Electron, no a Playwright: `isHidden()`
 * de una página pregunta por un ELEMENTO, no por la ventana que lo contiene.
 * Aquí lo que hay que comprobar es justo lo otro.
 */
const popupVisible = (): Promise<boolean> =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some(
      (ventana) => ventana.webContents.getURL().includes('ventana=aviso') && ventana.isVisible(),
    ),
  )

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'torre-popup-'))

  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) env[key] = value
  }
  env['TORRE_USER_DATA'] = userDataDir

  app = await electron.launch({ args: [appRoot], env })
  page = await app.firstWindow()
  await page.waitForSelector('[data-testid="nav-tower"]')

  // Sin sostener la sesión no hay turnos, así que no habría nada que enseñar.
  // Se coge la ventana más larga a propósito: lo que se comprueba aquí es el
  // mecanismo de la ventanita, no cuánto dura la espera (que ya se prueba en
  // los tests del registro). Con la más corta, el propio arranque de la segunda
  // ventana se comería el plazo y el test mediría el ordenador, no el código.
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('turn-reply-window').selectOption('120')
  await expect(page.getByTestId('toggle-turn-popup')).toBeChecked()
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
  rmSync(userDataDir, { recursive: true, force: true })
})

test('al terminar un turno se abre una segunda ventana con la respuesta', async () => {
  const salida = 'He migrado la tabla de clientes. ¿Sigo con la de facturas?'
  const nuevaVentana = app.waitForEvent('window')
  const pendiente = endTurn(salida, 'C:/proyectos/rialsa-financiero')

  const popup = await nuevaVentana
  await popup.waitForLoadState('domcontentloaded')

  // Es otra ventana de verdad, no un panel dentro de la Torre.
  expect(app.windows().length).toBe(2)
  await expect(popup.locator('body[data-ventana="aviso"]')).toBeAttached()

  // Y enseña el turno: el repositorio en la barra y la respuesta íntegra.
  await expect(popup.getByTestId('turn-output')).toContainText(salida)
  await expect(popup.locator('.popup__repo')).toContainText('rialsa-financiero')

  // Se responde desde la ventanita y el texto llega a quien preguntaba.
  await popup.getByTestId('turn-reply').fill('Sí, adelante con facturas.')
  await popup.getByTestId('turn-send').click()

  const respuesta = await pendiente
  expect(respuesta.status).toBe(200)
  expect(await respuesta.json()).toMatchObject({
    action: 'reply',
    text: 'Sí, adelante con facturas.',
  })

  // Sin nada pendiente, la ventanita se retira sola: no hay que cerrarla a mano.
  await expect.poll(popupVisible).toBe(false)
})

test('la respuesta se ve con formato: el código en su bloque, y el HTML como texto', async () => {
  const salida = [
    '## Hecho',
    '',
    'Migré la tabla con **cuidado**:',
    '',
    '```sql',
    'ALTER TABLE clientes ADD COLUMN nif TEXT;',
    '```',
    '',
    'Ojo: el fichero <script>alert(1)</script> seguía ahí.',
  ].join('\n')

  const pendiente = endTurn(salida, 'C:/proyectos/rialsa-financiero')
  const popup = await popupWindow()

  // El bloque de código llega ENTERO y sin las comillas de la valla: es lo que
  // hace que copiarlo sirva de algo.
  const codigo = popup.getByTestId('rich-code')
  await expect(codigo).toBeVisible()
  await expect(codigo.locator('code')).toHaveText('ALTER TABLE clientes ADD COLUMN nif TEXT;')
  await expect(codigo).toContainText('sql')
  await expect(popup.getByTestId('turn-output')).not.toContainText('```')

  // El título y la negrita son estructura, no asteriscos a la vista.
  await expect(popup.locator('.rich__titulo')).toHaveText('Hecho')
  await expect(popup.locator('.rich strong')).toHaveText('cuidado')

  // Y lo importante: el HTML de la respuesta se LEE, no se ejecuta. Si se
  // hubiera interpretado, este texto no estaría en pantalla y habría un <script>.
  await expect(popup.getByTestId('turn-output')).toContainText('<script>alert(1)</script>')
  expect(await popup.locator('.rich script').count()).toBe(0)

  await popup.getByTestId('popup-close').click()
  await page.getByTestId('nav-tower').click()
  await page.getByTestId('turn-review').click()
  await pendiente
})

test('el turno se lee paso a paso, y el cambio se despliega en diff', async () => {
  const pendiente = endTurn('', 'C:/proyectos/rialsa-financiero', [
    { kind: 'text', text: 'Toco el esquema:' },
    {
      kind: 'tool',
      name: 'Edit',
      target: 'C:/proyectos/rialsa-financiero/src/db/schema.ts',
      added: 1,
      removed: 1,
      diff: '  const version = 3\n- const tabla = "viejo"\n+ const tabla = "nuevo"\n  export {}',
    },
    { kind: 'tool', name: 'Bash', target: 'pnpm test --run', added: null, removed: null, diff: null },
  ])

  const popup = await popupWindow()

  // El renglón dice qué, sobre qué y cuánto cambia — con el NOMBRE del fichero,
  // no la ruta entera, que no cabe y no aporta.
  const filas = popup.getByTestId('turn-step-tool')
  await expect(filas).toHaveCount(2)
  await expect(filas.first()).toContainText('Edit')
  await expect(filas.first()).toContainText('schema.ts')
  await expect(filas.first()).toContainText('+1')
  await expect(filas.first()).toContainText('−1')

  // El diff nace plegado: la tarjeta se lee de un vistazo y el detalle se pide.
  await expect(popup.getByTestId('turn-diff')).toHaveCount(0)
  await filas.first().locator('.paso__fila').click()
  await expect(popup.getByTestId('turn-diff')).toBeVisible()
  await expect(popup.locator('.diff__linea--menos')).toContainText('const tabla = "viejo"')
  await expect(popup.locator('.diff__linea--mas')).toContainText('const tabla = "nuevo"')

  // Un comando no tiene diff, así que su renglón no finge que se despliega.
  await expect(filas.nth(1).locator('.paso__fila')).toBeDisabled()
  await expect(filas.nth(1)).toContainText('pnpm test --run')

  await popup.getByTestId('popup-close').click()
  await page.getByTestId('nav-tower').click()
  await page.getByTestId('turn-review').click()
  await pendiente
})

test('el aspa es un «ahora no»: la tarjeta sigue viva en la Torre', async () => {
  const pendiente = endTurn('¿Reviso también los tests?', 'C:/proyectos/rialsa-financiero')

  const popup = await popupWindow()
  await expect(popup.getByTestId('turn-output')).toHaveText('¿Reviso también los tests?')

  await popup.getByTestId('popup-close').click()
  await expect.poll(popupVisible).toBe(false)

  // La tarjeta NO se ha descartado: sigue en la Torre, esperando.
  await page.getByTestId('nav-tower').click()
  await expect(page.getByTestId('turn-card')).toBeVisible()
  await expect(page.getByTestId('turn-output')).toHaveText('¿Reviso también los tests?')

  // Y se puede resolver desde la ventana grande, como siempre.
  await page.getByTestId('turn-review').click()
  const respuesta = await pendiente
  expect(await respuesta.json()).toMatchObject({ action: 'pass' })
})

test('apagado el ajuste, el turno solo aparece en la Torre', async () => {
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('switch-toggle-turn-popup').click()
  await expect(page.getByTestId('toggle-turn-popup')).not.toBeChecked()

  const pendiente = endTurn('Tercer turno.', 'C:/proyectos/rialsa-financiero')

  await page.getByTestId('nav-tower').click()
  await expect(page.getByTestId('turn-card')).toBeVisible()

  // La ventanita existe de antes, pero con el ajuste apagado no se asoma.
  expect(await popupVisible()).toBe(false)

  await page.getByTestId('turn-review').click()
  await pendiente
})
