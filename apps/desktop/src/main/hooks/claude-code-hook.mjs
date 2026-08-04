#!/usr/bin/env node
/**
 * Enlace entre Claude Code y AI Torre de Control.
 *
 * Este fichero lo instala la propia aplicación en tu carpeta de datos. No lo
 * edites a mano: al reinstalar se sobrescribe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA QUE MANDA SOBRE TODAS LAS DEMÁS
 *
 * Este script NUNCA puede estropear una sesión de Claude Code. Ante cualquier
 * duda —la Torre está cerrada, el fichero de conexión no existe, la red local
 * no responde, el JSON viene raro— sale en silencio con código 0 y Claude Code
 * sigue comportándose exactamente como si esto no existiera.
 *
 * Es la decisión D21: la Torre es un atajo, nunca un cuello de botella.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Qué hace en cada evento:
 *
 *   PermissionRequest → te lo enseña en la Torre y espera tu clic (máx. 90 s).
 *                       Si decides, transmite tu decisión. Si no, se rinde y
 *                       Claude Code te pregunta en la terminal como siempre.
 *   Notification      → marca la tarea como «te espera».
 *   Stop              → refresca la señal de vida; la tarea sigue trabajando.
 *   SessionEnd        → marca la tarea como terminada.
 */

import { readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Nunca se espera más que esto. Un poco por encima del tope de la Torre. */
const REQUEST_TIMEOUT_MS = 100_000
/** Los avisos que no bloquean se rinden enseguida: no valen una espera. */
const FIRE_AND_FORGET_TIMEOUT_MS = 3_000
/** Tope del texto que se manda. La Torre lo rechazaría por encima de 4000. */
const DETAIL_MAX = 3_800

/** Sale sin hacer nada. Es la respuesta correcta ante cualquier problema. */
function bailOut() {
  process.exit(0)
}

/** Misma carpeta que fija el proceso principal de la aplicación. */
function userDataDir() {
  if (process.env.TORRE_USER_DATA) return process.env.TORRE_USER_DATA
  const home = homedir()
  const appData =
    platform() === 'win32'
      ? (process.env.APPDATA ?? join(home, 'AppData', 'Roaming'))
      : platform() === 'darwin'
        ? join(home, 'Library', 'Application Support')
        : (process.env.XDG_CONFIG_HOME ?? join(home, '.config'))
  return join(appData, 'ai-torre-de-control')
}

function readEndpoint() {
  try {
    const raw = readFileSync(join(userDataDir(), 'event-endpoint.json'), 'utf8')
    const endpoint = JSON.parse(raw)
    if (!endpoint?.host || !endpoint?.port || !endpoint?.token) return null
    return endpoint
  } catch {
    // La aplicación no está abierta, o nunca lo estuvo. Perfectamente normal.
    return null
  }
}

async function readStdin() {
  try {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8').trim()
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function post(endpoint, path, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(`http://${endpoint.host}:${endpoint.port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))
}

/**
 * Traduce lo que la herramienta quiere hacer a una frase que se pueda leer y
 * aprobar con criterio.
 *
 * Para Bash se manda el comando ENTERO: aprobar un comando recortado sería peor
 * que no aprobar nada. Para escrituras se manda la ruta y el tamaño, no el
 * contenido — con eso se decide igual de bien y no se mueve texto que la Torre
 * ha prometido no guardar.
 */
function describe(toolName, toolInput) {
  const input = toolInput ?? {}
  const cut = (value) => {
    const text = String(value ?? '')
    return text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX)}\n…(recortado)` : text
  }

  switch (toolName) {
    case 'Bash':
    case 'PowerShell':
      return cut(input.command)

    case 'Write':
    case 'NotebookEdit': {
      const bytes = Buffer.byteLength(String(input.content ?? ''), 'utf8')
      return `Escribir en ${input.file_path ?? input.notebook_path ?? '(sin ruta)'}\n${bytes} bytes`
    }

    case 'Edit':
      return `Editar ${input.file_path ?? '(sin ruta)'}`

    case 'Read':
      return `Leer ${input.file_path ?? '(sin ruta)'}`

    case 'WebFetch':
      return `Descargar ${input.url ?? '(sin dirección)'}`

    default: {
      try {
        return cut(JSON.stringify(input, null, 2))
      } catch {
        return '(no se pudo describir la petición)'
      }
    }
  }
}

/** Manda un aviso de estado y sigue. No espera nada útil de vuelta. */
async function sendStatus(endpoint, payload, status) {
  try {
    await post(
      endpoint,
      '/sessions',
      {
        sessionId: payload?.session_id ?? null,
        cwd: payload?.cwd ?? process.cwd(),
        status,
        timestamp: new Date().toISOString(),
      },
      FIRE_AND_FORGET_TIMEOUT_MS,
    )
  } catch {
    // Da igual: si la Torre no está abierta, no pasa nada.
  }
}

async function main() {
  const payload = await readStdin()
  if (!payload) bailOut()

  const endpoint = readEndpoint()
  if (!endpoint) bailOut()

  const event = String(payload.hook_event_name ?? '')

  // ── Peticiones de permiso: el único caso que espera ────────────────────────
  if (event === 'PermissionRequest' || event === 'PreToolUse') {
    const toolName = String(payload.tool_name ?? 'desconocida')
    let response
    try {
      response = await post(
        endpoint,
        '/permissions',
        {
          requestId: randomUUID(),
          sessionId: payload.session_id ?? null,
          cwd: payload.cwd ?? process.cwd(),
          toolName,
          detail: describe(toolName, payload.tool_input),
          timestamp: new Date().toISOString(),
        },
        REQUEST_TIMEOUT_MS,
      )
    } catch {
      // La Torre no contestó. Que pregunte Claude Code, como siempre.
      bailOut()
    }

    if (!response.ok) bailOut()

    let resolution
    try {
      resolution = await response.json()
    } catch {
      bailOut()
    }

    // `timeout` o cualquier cosa rara: no se decide nada y Claude Code pregunta.
    if (resolution?.outcome !== 'allow' && resolution?.outcome !== 'deny') bailOut()

    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          permissionDecision: resolution.outcome,
          permissionDecisionReason: String(resolution.reason ?? 'Decidido en AI Torre de Control'),
        },
      })}\n`,
    )
    process.exit(0)
  }

  // ── Avisos de estado: se mandan y se sigue ────────────────────────────────
  if (event === 'Notification') await sendStatus(endpoint, payload, 'waiting_user')
  else if (event === 'SessionEnd') await sendStatus(endpoint, payload, 'completed')
  else if (event === 'Stop') await sendStatus(endpoint, payload, 'running')

  process.exit(0)
}

main().catch(bailOut)
