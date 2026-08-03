#!/usr/bin/env node
/**
 * pre-tool-use.mjs — Se ejecuta ANTES de cada herramienta.
 *
 * Es la red de seguridad del proyecto: bloquea operaciones destructivas sin
 * vuelta atrás y el acceso a ficheros con credenciales.
 *
 * IMPORTANTE sobre el código de salida: para BLOQUEAR una herramienta hay que
 * salir con **2**. Con 1 (o cualquier otro) Claude Code lo trata como un error
 * no bloqueante y la herramienta se ejecuta igualmente. La versión anterior de
 * este hook usaba 1, así que aunque hubiera podido ejecutarse no habría
 * bloqueado nada.
 */

import { readHookInput } from './_input.mjs'

/** Operaciones irreversibles. Ninguna razón justifica ejecutarlas sin pedirlo. */
const DESTRUCTIVE = [
  /drop\s+database/i,
  /drop\s+table/i,
  /truncate\s+table/i,
  /rm\s+-rf\s+\/(?!\w)/i,
  /rm\s+-rf\s+~/i,
  /format\s+c:/i,
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard\s+HEAD~/i,
  /git\s+clean\s+-[a-z]*f/i,
  /Remove-Item\s+.*-Recurse\s+.*-Force\s+[A-Z]:\\?$/im,
]

/**
 * Ficheros que Claude no debe leer ni editar.
 *
 * `.env.example` queda expresamente permitido: es la plantilla sin valores
 * reales, está pensada para leerse y forma parte del repositorio.
 */
const SENSITIVE = [/(^|[\\/])\.env(\.|$)/i, /[\\/]secrets?[\\/]/i, /credential/i, /private[_-]?key/i, /\.pem$/i, /\.key$/i, /\.p12$/i]
const SENSITIVE_ALLOWED = [/\.env\.example$/i]

function block(reason, detail) {
  // stderr con salida 2 es lo que Claude Code devuelve al modelo como motivo.
  process.stderr.write(`${reason}\n${detail}\n`)
  process.exit(2)
}

const payload = await readHookInput()
const toolName = String(payload.tool_name ?? '')
const toolInput = payload.tool_input ?? {}

// ── 1. Comandos destructivos ─────────────────────────────────────────────────
const command = String(toolInput.command ?? '')
if (command) {
  for (const pattern of DESTRUCTIVE) {
    if (pattern.test(command)) {
      block(
        '🛑 BLOQUEADO: operación destructiva irreversible.',
        'Si de verdad hace falta, pídelo explícitamente al dueño del proyecto y explica por qué.',
      )
    }
  }
}

// ── 2. Ficheros sensibles ────────────────────────────────────────────────────
// Solo se miran las rutas y el comando, no el contenido: buscar la palabra
// «credential» dentro de un texto cualquiera bloquearía trabajo legítimo.
const paths = [toolInput.file_path, toolInput.path, toolInput.notebook_path, command]
  .filter((value) => typeof value === 'string' && value.length > 0)
  .map(String)

for (const candidate of paths) {
  if (SENSITIVE_ALLOWED.some((pattern) => pattern.test(candidate))) continue
  for (const pattern of SENSITIVE) {
    if (pattern.test(candidate)) {
      block(
        '🔐 BLOQUEADO: intento de acceder a un fichero sensible.',
        `Los ficheros .env, claves y credenciales no se leen ni se editan. Ruta: ${candidate}`,
      )
    }
  }
}

// ── 3. Aviso, sin bloquear, al tocar la rama principal ───────────────────────
if (toolName === 'Bash' || toolName === 'PowerShell') {
  if (/git\s+(checkout|switch)\s+(master|main)\b/i.test(command) && /git\s+(commit|merge)/i.test(command)) {
    process.stderr.write(
      'Recordatorio: la rama principal no se toca directamente. Trabaja en una rama y abre una PR.\n',
    )
  }
}

process.exit(0)
