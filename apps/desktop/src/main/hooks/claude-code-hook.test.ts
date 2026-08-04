import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Prueba del enlace REAL, ejecutándolo como lo ejecuta Claude Code.
 *
 * No importa el módulo ni prueba una copia: levanta una Torre de mentira, lanza
 * `node claude-code-hook.mjs` con una petición por la entrada estándar y mira
 * qué escribe por la salida. Es la única forma de comprobar el contrato de
 * verdad, que es donde estuvo el fallo:
 *
 * Durante un tiempo el enlace contestaba a `PermissionRequest` con el formato
 * de `PreToolUse`. No daba ningún error —Claude Code se limitaba a ignorar la
 * decisión y preguntar en la terminal—, así que desde fuera parecía que el
 * enlace no funcionaba, cuando lo único mal era el nombre de un campo.
 *
 * Un fallo mudo solo se caza con una prueba que hable el mismo idioma.
 */

const SCRIPT = fileURLToPath(new URL('./claude-code-hook.mjs', import.meta.url))
const TOKEN = 'clave-de-prueba'

interface Recibido {
  path: string
  body: Record<string, unknown>
}

let server: Server
let dataDir: string
let recibidas: Recibido[]
/** Lo que la Torre de mentira contesta a una petición de permiso. */
let respuesta: Record<string, unknown> | null

beforeEach(async () => {
  recibidas = []
  respuesta = null

  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      recibidas.push({ path: req.url ?? '', body })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(respuesta ?? { accepted: true }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port

  dataDir = mkdtempSync(join(tmpdir(), 'torre-hook-'))
  writeFileSync(
    join(dataDir, 'event-endpoint.json'),
    JSON.stringify({ host: '127.0.0.1', port, token: TOKEN }),
  )
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dataDir, { recursive: true, force: true })
})

/** Ejecuta el enlace igual que lo ejecuta Claude Code y devuelve lo que escribe. */
function ejecutar(payload: unknown): Promise<{ salida: string; codigo: number }> {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [SCRIPT], {
      env: { ...process.env, TORRE_USER_DATA: dataDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let salida = ''
    hijo.stdout.on('data', (c: Buffer) => {
      salida += c.toString('utf8')
    })
    hijo.on('close', (codigo) => resolve({ salida, codigo: codigo ?? 0 }))

    hijo.stdin.write(JSON.stringify(payload))
    hijo.stdin.end()
  })
}

const peticionDePermiso = (extra: Record<string, unknown> = {}) => ({
  hook_event_name: 'PermissionRequest',
  session_id: 'sesion-1',
  cwd: 'C:/proyectos/mi-app',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf temporal' },
  ...extra,
})

describe('peticiones de permiso: el sobre correcto', () => {
  it('contesta a PermissionRequest con decision.behavior, no con permissionDecision', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida, codigo } = await ejecutar(peticionDePermiso())
    const contestacion = JSON.parse(salida)

    expect(codigo).toBe(0)
    expect(contestacion.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(contestacion.hookSpecificOutput.decision.behavior).toBe('allow')
    // El campo de PreToolUse NO debe aparecer: es lo que rompía el enlace.
    expect(contestacion.hookSpecificOutput.permissionDecision).toBeUndefined()
  })

  it('al aceptar devuelve la orden original sin tocarla', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida } = await ejecutar(peticionDePermiso())
    const decision = JSON.parse(salida).hookSpecificOutput.decision

    expect(decision.updatedInput).toEqual({ command: 'rm -rf temporal' })
  })

  it('al rechazar dice deny y explica de dónde vino la decisión', async () => {
    respuesta = { outcome: 'deny', reason: 'Lo rechazaste en la Torre' }

    const { salida } = await ejecutar(peticionDePermiso())
    const contestacion = JSON.parse(salida)

    expect(contestacion.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(contestacion.systemMessage).toContain('rechazaste')
  })

  it('a PreToolUse sí le contesta en SU formato', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida } = await ejecutar(
      peticionDePermiso({ hook_event_name: 'PreToolUse' }),
    )
    const salidaHook = JSON.parse(salida).hookSpecificOutput

    expect(salidaHook.permissionDecision).toBe('allow')
    expect(salidaHook.decision).toBeUndefined()
  })

  it('manda el comando ENTERO para que puedas decidir con criterio', async () => {
    respuesta = { outcome: 'allow', reason: 'ok' }

    await ejecutar(peticionDePermiso())
    const enviado = recibidas.find((r) => r.path === '/permissions')

    expect(enviado?.body.toolName).toBe('Bash')
    expect(enviado?.body.detail).toBe('rm -rf temporal')
  })
})

describe('nunca estorba a Claude Code (D21)', () => {
  it('si se agota el tiempo no contesta nada y deja que pregunte él', async () => {
    respuesta = { outcome: 'timeout', reason: 'nadie decidió' }

    const { salida, codigo } = await ejecutar(peticionDePermiso())

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })

  it('no contesta una decisión que esta petición no admite', async () => {
    respuesta = { outcome: 'deny', reason: 'rechazado' }

    // Claude Code avisa de que aquí solo cabe aceptar.
    const { salida, codigo } = await ejecutar(
      peticionDePermiso({ permission_suggestions: ['allow'] }),
    )

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })

  it('sin Torre abierta sale en silencio y sin quejarse', async () => {
    rmSync(join(dataDir, 'event-endpoint.json'))

    const { salida, codigo } = await ejecutar(peticionDePermiso())

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })
})

/**
 * El reparto de estados que el dueño del proyecto corrigió dos veces.
 * «Te espera» está reservado a cuando el agente te PIDE algo; terminar un turno
 * es una ENTREGA, y va a la mesa de entregas.
 */
describe('qué estado manda cada evento', () => {
  const casos: ReadonlyArray<readonly [string, string]> = [
    ['UserPromptSubmit', 'running'],
    ['Stop', 'completed'],
    ['SessionEnd', 'completed'],
    ['Notification', 'waiting_user'],
  ]

  for (const [evento, esperado] of casos) {
    it(`${evento} → ${esperado}`, async () => {
      await ejecutar({
        hook_event_name: evento,
        session_id: 'sesion-1',
        cwd: 'C:/proyectos/mi-app',
      })

      const enviado = recibidas.find((r) => r.path === '/sessions')
      expect(enviado?.body.status).toBe(esperado)
    })
  }

  it('no manda nada del contenido de la conversación', async () => {
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: 'C:/algo/transcripcion.jsonl',
      message: 'texto que jamás debe salir de aquí',
    })

    const enviado = recibidas.find((r) => r.path === '/sessions')
    expect(JSON.stringify(enviado?.body)).not.toContain('jamás debe salir')
    expect(JSON.stringify(enviado?.body)).not.toContain('transcripcion')
  })
})
