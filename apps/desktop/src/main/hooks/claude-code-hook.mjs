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
 *   UserPromptSubmit  → le acabas de pedir algo: la tarea pasa a «trabajando».
 *   Stop              → ha terminado su turno y te ha ENTREGADO algo: la tarea
 *                       pasa a «terminada», a la mesa de entregas, esperando
 *                       que la revises. Y si has encendido «contestar desde la
 *                       Torre», además te enseña lo que te ha dicho y espera tu
 *                       respuesta (máx. lo que marques en Ajustes). Si escribes,
 *                       el turno NO termina y Claude sigue con lo que le digas.
 *   Notification      → te está PIDIENDO algo: la tarea pasa a «te espera».
 *   SessionEnd        → la sesión ha acabado: «terminada» también.
 *
 * La distinción entre las dos de en medio es deliberada y la marcó el dueño del
 * proyecto: «te espera» está reservado a cuando el agente te pide que aceptes
 * algo. Terminar un turno no es pedirte permiso, es entregarte trabajo. Si todo
 * acabara en «te espera», la puerta del despacho estaría siempre llena y dejaría
 * de significar nada.
 */

import { appendFileSync, readFileSync, rmSync, statSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Nunca se espera más que esto. Un poco por encima del tope de la Torre. */
const REQUEST_TIMEOUT_MS = 100_000
/**
 * Lo que se espera a que contestes al final de un turno.
 *
 * Por encima del tope de la Torre (180 s) y por debajo del que Claude Code le
 * da a este evento (210 s), para que el que se rinda primero sea siempre el más
 * interno. Si Claude Code matara el script a media espera, tu respuesta se
 * perdería justo después de haberla escrito.
 */
const HANDOFF_TIMEOUT_MS = 190_000
/** Los avisos que no bloquean se rinden enseguida: no valen una espera. */
const FIRE_AND_FORGET_TIMEOUT_MS = 3_000
/** Tope del texto que se manda. La Torre lo rechazaría por encima de 4000. */
const DETAIL_MAX = 3_800
/** Cuaderno donde queda constancia de cada permiso. Ver `apuntar()`. */
const DIAGNOSTIC_FILENAME = 'diagnostico-permisos.log'
/** Al pasarse de aquí, el cuaderno empieza de cero. Interesa lo reciente. */
const DIAGNOSTIC_MAX_BYTES = 256 * 1024

/** Sale sin hacer nada. Es la respuesta correcta ante cualquier problema. */
function bailOut() {
  process.exit(0)
}

/**
 * Cuaderno de bitácora de las peticiones de permiso.
 *
 * Existe porque un fallo mudo no se diagnostica adivinando, y este canal ya ha
 * fallado dos veces sin dar ni un error: primero por contestar con el nombre de
 * campo de otro evento, después por una comprobación de más que descartaba la
 * decisión en silencio. Las dos se habrían visto en dos minutos con esto.
 *
 * **Nunca escribe contenido de conversación.** Solo el nombre del evento, el de
 * la herramienta y la FORMA de los datos de decisión —qué campos vienen y de
 * qué tipo—. Ni prompts, ni respuestas, ni el contenido de los ficheros.
 *
 * Si no puede escribir, no pasa nada: es un cuaderno, no un requisito (D21).
 */
function apuntar(nota) {
  try {
    const ruta = join(userDataDir(), DIAGNOSTIC_FILENAME)

    // Un cuaderno de diagnóstico no puede crecer sin fin en el disco de nadie:
    // al pasarse de tamaño se empieza de cero. Interesa lo reciente.
    try {
      if (statSync(ruta).size > DIAGNOSTIC_MAX_BYTES) rmSync(ruta)
    } catch {
      // No existe todavía, o no se puede mirar. Se sigue igual.
    }

    appendFileSync(ruta, `${JSON.stringify({ at: new Date().toISOString(), ...nota })}\n`, 'utf8')
  } catch {
    // Un cuaderno que no se puede escribir jamás debe estropear una sesión.
  }
}

/** Apunta por qué se rinde y se aparta, para que el motivo no se pierda. */
function rendirse(motivo, extra = {}) {
  apuntar({ fase: 'se aparta', motivo, ...extra })
  bailOut()
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

/**
 * Manda una petición al receptor local.
 *
 * Usa `node:http` a pelo, y NO `fetch`, por un motivo que costó un fallo:
 *
 * `fetch` reutiliza conexiones (keep-alive). En un evento que hace dos
 * llamadas seguidas —el fin de turno manda el estado y después pregunta si
 * quieres contestar— quedaba una conexión viva en el pozo al llamar a
 * `process.exit()`, y Node se ESTRELLABA al cerrar:
 *
 *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c
 *
 * Un enlace que revienta es lo peor que puede pasarle a este script, porque
 * viola su única regla innegociable: nunca estropear una sesión de Claude Code.
 * Con `agent: false` cada petición abre y cierra su propia conexión, así que al
 * salir no queda nada a medio cerrar.
 *
 * Devuelve algo con la forma mínima de una respuesta de `fetch` —`ok`, `status`
 * y `json()`— para que quien llama no tenga que saber nada de esto.
 */
function post(endpoint, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8')

    const req = httpRequest(
      {
        host: endpoint.host,
        port: endpoint.port,
        path,
        method: 'POST',
        // Nada de reutilizar conexiones: este script vive unos segundos.
        agent: false,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'x-torre-token': endpoint.token,
          Connection: 'close',
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const texto = Buffer.concat(chunks).toString('utf8')
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => JSON.parse(texto),
          })
        })
      },
    )

    req.setTimeout(timeoutMs, () => req.destroy(new Error('Se agotó la espera')))
    req.on('error', reject)
    req.end(payload)
  })
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

/**
 * Traduce tu decisión al formato que espera CADA evento.
 *
 * No son intercambiables, y esto costó un fallo silencioso: contestar a
 * `PermissionRequest` con el formato de `PreToolUse` no da ningún error —
 * Claude Code simplemente ignora la decisión y te vuelve a preguntar en la
 * terminal, como si la Torre no existiera. Desde fuera parece que el enlace
 * está roto cuando lo único mal es el sobre.
 *
 *   PermissionRequest → hookSpecificOutput.decision.behavior  ('allow' | 'deny')
 *   PreToolUse        → hookSpecificOutput.permissionDecision ('allow' | 'deny')
 *
 * En «allow» se devuelve la orden original sin tocar: la Torre aprueba lo que
 * se le enseñó, nunca una versión modificada de ello.
 */
function buildAnswer(event, resolution, payload) {
  const reason = String(resolution.reason ?? 'Decidido en AI Torre de Control')

  if (event === 'PermissionRequest') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision:
          resolution.outcome === 'allow'
            ? { behavior: 'allow', updatedInput: payload.tool_input ?? {} }
            : { behavior: 'deny' },
      },
      systemMessage: reason,
    }
  }

  return {
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: resolution.outcome,
      permissionDecisionReason: reason,
    },
  }
}

/**
 * Al terminar un turno, ofrece a la Torre contestar antes de cerrarlo (D24).
 *
 * Devuelve el objeto que hay que escribir en la salida para que Claude Code
 * NO termine y siga con lo que le hayas dicho, o `null` para terminar como
 * siempre — que es lo que pasa casi todo el rato: función apagada, Torre
 * cerrada, o simplemente no contestaste.
 *
 * El texto que se manda es `last_assistant_message`, que Claude Code entrega ya
 * montado en este evento. **No se lee la transcripción a propósito**: su propia
 * documentación avisa de que se escribe con retraso y puede no tener todavía el
 * último mensaje del turno, que es justo el que hace falta.
 */
async function pedirRespuesta(endpoint, payload) {
  const mensaje = String(payload.last_assistant_message ?? '').trim()
  // Sin nada que enseñar no se retiene un turno. Un aviso vacío es peor que
  // ninguno: cuesta lo mismo y no dice nada.
  if (!mensaje) return null

  let response
  try {
    response = await post(
      endpoint,
      '/handoffs',
      {
        requestId: randomUUID(),
        sessionId: payload.session_id ?? null,
        cwd: payload.cwd ?? process.cwd(),
        message: mensaje.length > DETAIL_MAX ? `${mensaje.slice(0, DETAIL_MAX)}\n…(recortado)` : mensaje,
        timestamp: new Date().toISOString(),
      },
      HANDOFF_TIMEOUT_MS,
    )
  } catch {
    // La Torre no contestó. El turno termina como si esto no existiera.
    apuntar({ fase: 'se aparta', motivo: 'fin de turno: la Torre no contestó' })
    return null
  }

  if (!response.ok) {
    apuntar({ fase: 'se aparta', motivo: 'fin de turno: la Torre dio error', estado: response.status })
    return null
  }

  let resolution
  try {
    resolution = await response.json()
  } catch {
    return null
  }

  if (resolution?.outcome !== 'reply') return null

  const texto = String(resolution.reply ?? '').trim()
  if (!texto) return null

  // Se apunta el TAMAÑO, jamás el texto: por aquí pasa literalmente la
  // conversación, y este cuaderno vive en disco.
  apuntar({ fase: 'contesta', evento: 'Stop', decidido: 'reply', caracteres: texto.length })

  /*
   * Se contesta por los DOS caminos que la documentación reconoce para `Stop`.
   *
   * `decision: "block"` es lo que impide que el turno termine, y `reason` es lo
   * que Claude recibe como motivo. `additionalContext` es el campo que la misma
   * tabla admite para «feedback que continúa la conversación».
   *
   * Mandar ambos es deliberado. Este canal ya ha fallado dos veces en mudo por
   * contestar con el nombre de campo equivocado, y un campo de más se ignora
   * sin consecuencias mientras que uno de menos deja tu respuesta en la nada.
   */
  return {
    decision: 'block',
    reason: texto,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: texto,
    },
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

  /*
   * Toda señal deja rastro, no solo las de permiso.
   *
   * Responde sin adivinar a las dos preguntas que más tiempo cuestan: «¿esto
   * llega siquiera?» y «¿en qué modo está la sesión?». Si el modo aprueba las
   * cosas por su cuenta, no habrá peticiones de permiso que capturar — y eso no
   * es un fallo del enlace, aunque desde fuera lo parezca.
   */
  apuntar({ fase: 'señal', evento: event, modo: payload.permission_mode ?? null })

  // ── Peticiones de permiso: el único caso que espera ────────────────────────
  if (event === 'PermissionRequest' || event === 'PreToolUse') {
    const toolName = String(payload.tool_name ?? 'desconocida')
    const admitidas = payload.permission_suggestions

    // Queda constancia de la FORMA exacta de lo que llega. Es lo que permite
    // ver de un vistazo por qué una decisión no surtió efecto.
    apuntar({
      fase: 'llega',
      evento: event,
      herramienta: toolName,
      admitidas: admitidas ?? null,
      tipoDeAdmitidas: Array.isArray(admitidas)
        ? `lista de [${[...new Set(admitidas.map((v) => typeof v))].join(', ')}]`
        : typeof admitidas,
      modo: payload.permission_mode ?? null,
      traeIdDeLlamada: Boolean(payload.tool_use_id),
      camposDelSobre: Object.keys(payload).sort(),
    })

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
      rendirse('la Torre no contestó (cerrada, o tardó demasiado)')
    }

    if (!response.ok) rendirse('la Torre respondió con error', { estado: response.status })

    let resolution
    try {
      resolution = await response.json()
    } catch {
      rendirse('la respuesta de la Torre no se pudo leer')
    }

    // `timeout` o cualquier cosa rara: no se decide nada y Claude Code pregunta.
    if (resolution?.outcome !== 'allow' && resolution?.outcome !== 'deny') {
      rendirse('nadie decidió a tiempo', { recibido: resolution?.outcome ?? null })
    }

    /*
     * Claude Code PUEDE indicar qué decisiones admite esta petición concreta.
     *
     * Solo se le hace caso si viene como una lista de textos. Cualquier otra
     * forma se ignora a propósito: descartar una decisión humana por no
     * entender un campo es peor que no mirar el campo siquiera. Esa misma
     * comprobación, escrita sin esta cautela, se tragó decisiones reales en
     * silencio el 4/8/2026.
     */
    const listaAdmitidas =
      Array.isArray(admitidas) && admitidas.length > 0 && admitidas.every((v) => typeof v === 'string')
        ? admitidas
        : null

    if (listaAdmitidas && !listaAdmitidas.includes(resolution.outcome)) {
      rendirse('esta petición no admite esa decisión', {
        decidido: resolution.outcome,
        admitidas: listaAdmitidas,
      })
    }

    const answer = buildAnswer(event, resolution, payload)
    const salida = answer.hookSpecificOutput

    /*
     * Se apunta la FORMA del sobre, nunca su carga.
     *
     * `updatedInput` lleva la orden original tal cual: para una escritura, eso
     * es el contenido entero del fichero. Apuntarlo convertiría el cuaderno de
     * diagnóstico en un registro de todo lo que se escribe, que es justo lo que
     * esta aplicación promete no hacer.
     */
    apuntar({
      fase: 'contesta',
      evento: event,
      decidido: resolution.outcome,
      campoUsado: 'decision' in salida ? 'decision.behavior' : 'permissionDecision',
      decisionEnviada: salida.decision?.behavior ?? salida.permissionDecision ?? null,
    })

    process.stdout.write(`${JSON.stringify(answer)}\n`)
    process.exit(0)
  }

  // ── Avisos de estado: se mandan y se sigue ────────────────────────────────
  if (event === 'UserPromptSubmit') await sendStatus(endpoint, payload, 'running')
  else if (event === 'Stop' || event === 'SessionEnd') {
    // Ha entregado trabajo: a la mesa de entregas, pendiente de que lo revises.
    await sendStatus(endpoint, payload, 'completed')

    // Y si es fin de turno —no fin de sesión—, se ofrece contestar desde la
    // Torre antes de dar el turno por cerrado.
    if (event === 'Stop') {
      const respuesta = await pedirRespuesta(endpoint, payload)
      if (respuesta) {
        process.stdout.write(`${JSON.stringify(respuesta)}\n`)
        process.exit(0)
      }
    }
  } else if (event === 'Notification') {
    // Te está pidiendo algo: a tu puerta. Este estado se reserva para eso.
    await sendStatus(endpoint, payload, 'waiting_user')
  }

  process.exit(0)
}

main().catch(bailOut)
