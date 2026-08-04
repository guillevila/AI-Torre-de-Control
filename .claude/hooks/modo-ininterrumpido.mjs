#!/usr/bin/env node
/**
 * modo-ininterrumpido.mjs — Se ejecuta ANTES de que Claude pare a preguntarte.
 *
 * Sirve para trabajar sin interrupciones: cuando el modo está encendido y Claude
 * iba a hacerte una pregunta, este hook se la devuelve con la instrucción de que
 * decida él la opción más adecuada y siga. Cuando está apagado, no hace nada y la
 * pregunta te llega a ti como siempre.
 *
 * El interruptor es un fichero: `.claude/modo-ininterrumpido.on`
 *   · existe    → Claude decide solo
 *   · no existe → decides tú (comportamiento por defecto)
 *
 * Es intencionadamente un fichero y no un ajuste: así el modo no se hereda al
 * clonar el repositorio ni se queda encendido sin que se vea. El fichero está en
 * .gitignore, o sea que es tuyo y solo tuyo.
 *
 * Toda pregunta auto-resuelta se anota en `.claude/audit/decisiones-automaticas.log`.
 * Si una IA decide por ti, tienes que poder ver después qué decidió.
 *
 * Código de salida: 0 siempre. La decisión de bloquear se comunica por el JSON de
 * salida (`permissionDecision: "deny"`), no por el código de salida. Salir con 2
 * aquí abortaría el turno en vez de reconducirlo.
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readHookInput, timestamp } from './_input.mjs'

const payload = await readHookInput()

// El hook se registra con matcher AskUserQuestion, pero se comprueba igualmente:
// si algún día el matcher cambia, este hook no debe estorbar a otras herramientas.
if (String(payload.tool_name ?? '') !== 'AskUserQuestion') process.exit(0)

const raiz = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd()
const interruptor = join(raiz, '.claude', 'modo-ininterrumpido.on')

// Modo apagado → el dueño del proyecto responde. Es el comportamiento por defecto.
if (!existsSync(interruptor)) process.exit(0)

// ── Modo encendido: se recogen las preguntas para dejar rastro ────────────────
const preguntas = Array.isArray(payload.tool_input?.questions) ? payload.tool_input.questions : []

/** Resume una pregunta en una línea legible: enunciado → opciones disponibles. */
function resumir(pregunta) {
  const enunciado = String(pregunta?.question ?? '(sin enunciado)')
  const opciones = Array.isArray(pregunta?.options)
    ? pregunta.options.map((o) => String(o?.label ?? '?')).join(' | ')
    : '(sin opciones)'
  return `${enunciado} → ${opciones}`
}

const resumenes = preguntas.map(resumir)

// ── Registro de auditoría ────────────────────────────────────────────────────
// Fuera del repositorio (.claude/audit/ está en .gitignore). Si por lo que sea no
// se puede escribir, el hook sigue: perder el registro no justifica romper el turno.
try {
  const carpeta = join(raiz, '.claude', 'audit')
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true })
  const lineas = resumenes.map((r) => `${timestamp()}  ${r}`).join('\n')
  appendFileSync(join(carpeta, 'decisiones-automaticas.log'), `${lineas}\n`, 'utf8')
} catch {
  /* sin registro, pero el modo sigue funcionando */
}

// ── Instrucciones que recibe Claude en lugar de tu respuesta ─────────────────
const listado = resumenes.length
  ? resumenes.map((r) => `  · ${r}`).join('\n')
  : '  · (la herramienta no traía preguntas legibles)'

const instrucciones = `⏩ MODO ININTERRUMPIDO ACTIVO — el dueño del proyecto no está delante para responder.

No preguntes: decide tú y sigue trabajando hasta terminar la tarea.

Para cada pregunta que ibas a hacer:
  1. Si alguna opción está marcada como «(Recomendada)», elige esa.
  2. Si no, elige la más conservadora y reversible.
  3. Escribe la decisión en tu respuesta con el prefijo «[decisión automática]» y
     di en qué te has basado, para que se pueda revisar después.
  4. Continúa. No vuelvas a llamar a AskUserQuestion en este turno.

Preguntas que ibas a hacer (registradas en .claude/audit/decisiones-automaticas.log):
${listado}

LÍMITE QUE SÍ DEBE PARARTE: si decidir por tu cuenta implicaría borrar o sobrescribir
datos reales, tocar producción, o cualquier cosa que no se pueda deshacer — no lo hagas.
Termina todo lo demás, y explica al final qué has dejado sin hacer y por qué. Este modo
te libera de consultar lo rutinario, no de proteger lo irreversible.

Para desactivar este modo: borrar el fichero .claude/modo-ininterrumpido.on`

const salida = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: instrucciones,
  },
  systemMessage: `⏩ Modo ininterrumpido: ${resumenes.length || 1} pregunta(s) resuelta(s) por Claude — ver .claude/audit/decisiones-automaticas.log`,
  suppressOutput: true,
}

process.stdout.write(`${JSON.stringify(salida)}\n`)
process.exit(0)
