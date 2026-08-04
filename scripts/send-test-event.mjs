#!/usr/bin/env node
/**
 * Simulador de eventos locales.
 *
 * Envía al receptor de la aplicación un evento igual al que enviará mañana un
 * hook de Claude Code o la extensión de navegador. Recorre el camino real
 * completo: HTTP a 127.0.0.1, token local, validación del contrato y máquina de
 * estados. No es un atajo interno.
 *
 * Uso:
 *   pnpm evento <id-de-la-tarea> <estado> [fuente] [confianza]
 *
 * Ejemplos:
 *   pnpm evento 3f2a…  completed
 *   pnpm evento 3f2a…  waiting_user claude_hook high
 *
 * La aplicación tiene que estar abierta: el script lee la dirección y la clave
 * del fichero que ella publica en tu carpeta de usuario.
 */

import { readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const STATUSES = [
  'draft',
  'queued',
  'running',
  'waiting_user',
  'completed',
  'failed',
  'unknown',
  'archived',
]
const SOURCES = ['manual', 'local_event', 'claude_hook', 'browser_extension', 'process_monitor']
const CONFIDENCES = ['high', 'medium', 'low']

/** Misma carpeta que fija el proceso principal en src/main/index.ts. */
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

function fail(message, hint) {
  console.error(`\n  ✖ ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

function readEndpoint() {
  const path = join(userDataDir(), 'event-endpoint.json')
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    fail(
      'No encuentro los datos de conexión del receptor local.',
      `Esperaba el fichero en:\n    ${path}\n    ¿Está la aplicación abierta? Arráncala con "pnpm dev".`,
    )
  }

  try {
    const endpoint = JSON.parse(raw)
    if (!endpoint.host || !endpoint.port || !endpoint.token) throw new Error('incompleto')
    return endpoint
  } catch {
    fail(`El fichero de conexión está corrupto:\n    ${path}`, 'Cierra y vuelve a abrir la aplicación.')
  }
}

async function main() {
  const [taskId, status, source = 'local_event', confidence = 'high'] = process.argv.slice(2)

  if (!taskId || !status) {
    console.error(`
  Uso: pnpm evento <id-de-la-tarea> <estado> [fuente] [confianza]

  Estados:    ${STATUSES.join(', ')}
  Fuentes:    ${SOURCES.join(', ')}   (por defecto: local_event)
  Confianza:  ${CONFIDENCES.join(', ')}   (por defecto: high)

  El identificador de la tarea aparece en su ficha, dentro de la aplicación.
`)
    process.exit(1)
  }

  if (!STATUSES.includes(status)) fail(`Estado desconocido: "${status}"`, `Válidos: ${STATUSES.join(', ')}`)
  if (!SOURCES.includes(source)) fail(`Fuente desconocida: "${source}"`, `Válidas: ${SOURCES.join(', ')}`)
  if (!CONFIDENCES.includes(confidence)) {
    fail(`Confianza desconocida: "${confidence}"`, `Válidas: ${CONFIDENCES.join(', ')}`)
  }

  const endpoint = readEndpoint()
  const url = `http://${endpoint.host}:${endpoint.port}/events`

  const event = {
    type: 'status_changed',
    taskId,
    status,
    source,
    confidence,
    timestamp: new Date().toISOString(),
  }

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token },
      body: JSON.stringify(event),
    })
  } catch (error) {
    fail(
      `No se pudo contactar con ${url}`,
      `${error instanceof Error ? error.message : error}\n    ¿Sigue abierta la aplicación?`,
    )
  }

  const body = await response.json().catch(() => ({}))

  if (response.ok && body.accepted) {
    console.log(`\n  ✔ Evento aceptado — la tarea ${body.taskId} pasa a "${body.status}"\n`)
    return
  }

  console.error(`\n  ✖ Evento rechazado (HTTP ${response.status}): ${body.reason ?? 'sin motivo'}`)
  if (Array.isArray(body.details)) for (const detail of body.details) console.error(`    · ${detail}`)
  console.error('')
  process.exit(1)
}

await main()
