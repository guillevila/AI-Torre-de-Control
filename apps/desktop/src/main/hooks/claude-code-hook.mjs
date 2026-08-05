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
 *                       que la revises.
 *   Notification      → te está PIDIENDO algo: la tarea pasa a «te espera».
 *                       Excepto las de tipo `permission_prompt`, que se ignoran:
 *                       ese permiso ya llega por `PermissionRequest`, y atenderlo
 *                       dos veces te haría llegar un aviso incluso cuando la
 *                       Torre lo aprueba sola (D24).
 *   SessionEnd        → la sesión ha acabado: «terminada» también.
 *
 * La distinción entre las dos de en medio es deliberada y la marcó el dueño del
 * proyecto: «te espera» está reservado a cuando el agente te pide que aceptes
 * algo. Terminar un turno no es pedirte permiso, es entregarte trabajo. Si todo
 * acabara en «te espera», la puerta del despacho estaría siempre llena y dejaría
 * de significar nada.
 */

import { appendFileSync, closeSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Nunca se espera más que esto. Un poco por encima del tope de la Torre. */
const REQUEST_TIMEOUT_MS = 100_000
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
 * Salida ordenada tras haber usado la red.
 *
 * Un respiro mínimo antes de `process.exit` para que los manejadores de red
 * terminen de cerrarse. Sin él, en Windows la salida compite con el cierre de
 * los sockets de fetch y el proceso muere con una aserción de libuv
 * (`async.c: UV_HANDLE_CLOSING`) — con código de error, lo que Claude Code
 * interpretaría como un hook roto.
 */
async function salir() {
  await new Promise((resolve) => setTimeout(resolve, 25))
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

/** Dónde guarda Claude Code su registro de sesiones vivas. Sobrescribible en tests. */
function sessionsRegistryDir() {
  if (process.env.TORRE_CLAUDE_SESSIONS) return process.env.TORRE_CLAUDE_SESSIONS
  return join(homedir(), '.claude', 'sessions')
}

/**
 * El NOMBRE de la conversación, desde el registro de sesiones de Claude Code.
 *
 * Ese registro es un fichero de METADATOS por sesión viva (identificador,
 * carpeta, nombre). Aquí no se abre jamás la transcripción: el nombre es lo
 * único de la conversación que viaja a la Torre, y acotado (D5-bis). Puede ser
 * el automático («mi-app-a3») o el que el dueño puso con /rename.
 *
 * Si no se encuentra —versión antigua, registro limpio— se devuelve null y el
 * aviso viaja sin nombre, como siempre. Ninguna razón para fallar por esto.
 */
function readSessionTitle(sessionId) {
  if (!sessionId) return null
  try {
    const dir = sessionsRegistryDir()
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      try {
        const registro = JSON.parse(readFileSync(join(dir, file), 'utf8'))
        if (registro?.sessionId === sessionId && typeof registro.name === 'string') {
          const nombre = registro.name.trim()
          if (nombre) return nombre.slice(0, 200)
        }
      } catch {
        /* un registro corrupto no invalida los demás */
      }
    }
  } catch {
    /* sin carpeta de registro no hay nombre, y no pasa nada */
  }
  return null
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
    // `Connection: close`: el socket se cierra con la respuesta. Sin esto, el
    // keep-alive de fetch deja un manejador vivo que compite con process.exit
    // y en Windows tumba el proceso con una aserción de libuv (async.c).
    headers: { 'Content-Type': 'application/json', 'x-torre-token': endpoint.token, Connection: 'close' },
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

/** Tope de lo que se lee y se envía de la respuesta del turno (D5-ter). */
const TURN_OUTPUT_MAX = 4000
/** Tope de un diff suelto. Uno enorme no se lee: se abre el editor. */
const TURN_DIFF_MAX = 2000
/** Tope de pasos. Un turno con cientos de herramientas no cabe en una tarjeta. */
const TURN_STEPS_MAX = 60
/**
 * Sitio total para los diffs de un turno.
 *
 * Reparte por orden de llegada: los primeros cambios traen su diff y, al
 * agotarse, los siguientes aparecen igual con sus cuentas pero sin detalle.
 * Es lo que impide que un turno que reescribe medio proyecto mande un envío
 * gigante — y lo que hace que el receptor pueda mantener un límite estricto.
 */
const PRESUPUESTO_DIFFS = 60_000
/** Cuánto se espera como máximo la respuesta del dueño (ventana máx. + margen). */
const TURN_REPLY_TIMEOUT_MS = 310_000

/**
 * El TURNO ENTERO del asistente, leído del final de la transcripción (D26-ter).
 *
 * Es la única lectura de contenido de conversación de todo el enlace, existe
 * porque el dueño la pidió expresamente (D5-ter), y su destino es una tarjeta
 * en memoria: la Torre la enseña y no la guarda. Se lee solo la cola del
 * fichero —las transcripciones crecen mucho— y se recorta al tope.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL TURNO ENTERO Y NO EL ÚLTIMO MENSAJE
 *
 * Un turno no es un mensaje: es varios. El asistente narra lo que va a hacer,
 * usa una herramienta, cuenta lo que encontró, usa otra, y concluye. Leer solo
 * la última entrada tenía dos fallos, y el segundo es el grave:
 *
 *  1. Si el turno acaba con un «Listo», eso es TODO lo que se veía. La
 *     explicación —lo que hace falta para poder contestar— se quedaba fuera.
 *  2. Si el turno terminaba justo después de una frase intermedia («ahora edito
 *     el fichero…»), esa frase se enseñaba COMO SI FUERA la respuesta final.
 *
 * Así que se recoge todo el texto del asistente desde el último mensaje del
 * dueño. Eso es exactamente lo que se vería en la ventana de VSCode.
 *
 * Lo que NO cambia: esto sigue leyéndose solo cuando Claude Code emite `Stop`,
 * es decir, cuando ha terminado de responder y se queda esperando. Nunca
 * mientras trabaja.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function leerRespuestaDelTurno(transcriptPath) {
  const vacio = { output: '', steps: [] }
  try {
    if (!transcriptPath || !statSync(transcriptPath).isFile()) return vacio
    const tam = statSync(transcriptPath).size
    const COLA = 262_144
    const desde = Math.max(0, tam - COLA)
    const fd = openSync(transcriptPath, 'r')
    const buffer = Buffer.alloc(tam - desde)
    readSync(fd, buffer, 0, buffer.length, desde)
    closeSync(fd)

    const lineas = buffer.toString('utf8').split('\n')
    const delTurno = []

    // De atrás hacia delante hasta TU último mensaje: eso delimita el turno.
    for (let i = lineas.length - 1; i >= 0; i -= 1) {
      let entrada
      try {
        entrada = JSON.parse(lineas[i])
      } catch {
        continue // una línea partida por el corte de la cola no es un error
      }
      // Los subagentes van marcados como sidechain: su charla no es el turno.
      if (!entrada || entrada.isSidechain) continue

      // Aquí empezó el turno. Lo anterior es la conversación de antes.
      if (entrada.type === 'user' && !entrada.isMeta && esMensajeDelDueño(entrada)) break

      if (entrada.type === 'assistant') delTurno.push(entrada)
    }

    delTurno.reverse()

    const piezas = []
    const steps = []
    let presupuesto = PRESUPUESTO_DIFFS

    for (const entrada of delTurno) {
      const contenido = entrada.message?.content
      if (!Array.isArray(contenido)) continue

      // En ORDEN: así el paso a paso se lee como ocurrió, igual que en VSCode.
      for (const parte of contenido) {
        if (parte?.type === 'text' && typeof parte.text === 'string' && parte.text.trim()) {
          piezas.push(parte.text.trim())
          if (steps.length < TURN_STEPS_MAX) {
            steps.push({ kind: 'text', text: recortarFinal(parte.text.trim(), TURN_OUTPUT_MAX) })
          }
          continue
        }
        if (parte?.type !== 'tool_use' || steps.length >= TURN_STEPS_MAX) continue

        const paso = describirHerramienta(parte)
        // El presupuesto reparte el sitio entre todos los diffs del turno. Al
        // agotarse, la herramienta SIGUE apareciendo con sus cuentas: saber qué
        // se tocó importa más que ver cada línea.
        if (paso.diff) {
          if (paso.diff.length > presupuesto) paso.diff = null
          else presupuesto -= paso.diff.length
        }
        steps.push(paso)
      }
    }

    const texto = piezas.join('\n\n').trim()
    return { output: recortarFinal(texto, TURN_OUTPUT_MAX), steps }
  } catch {
    /* sin transcripción no hay texto, y la tarjeta lo dice */
  }
  return vacio
}

/**
 * Recorta conservando el FINAL.
 *
 * La conclusión es lo que hay que leer para decidir; la narración de por medio
 * es contexto que se puede perder sin quedarse sin saber qué contestar.
 */
function recortarFinal(texto, tope) {
  if (texto.length <= tope) return texto
  return `…${texto.slice(texto.length - (tope - 1))}`
}

/**
 * Una llamada a herramienta, resumida como la enseña el chat del editor: qué
 * herramienta, sobre qué, y —si edita— cuánto cambia y en qué consiste.
 *
 * Lo que va en `target` es deliberadamente corto: es el renglón que se lee de
 * un vistazo. El detalle, si lo hay, va en el diff.
 */
function describirHerramienta(parte) {
  const nombre = typeof parte.name === 'string' && parte.name.trim() ? parte.name.trim() : 'herramienta'
  const entrada = parte.input && typeof parte.input === 'object' ? parte.input : {}
  const paso = { kind: 'tool', name: nombre.slice(0, 60), target: '', added: null, removed: null, diff: null }

  const ruta = typeof entrada.file_path === 'string' ? entrada.file_path : ''

  if (nombre === 'Edit' && typeof entrada.old_string === 'string' && typeof entrada.new_string === 'string') {
    const cambio = calcularDiff(entrada.old_string, entrada.new_string)
    paso.target = ruta
    paso.added = cambio.added
    paso.removed = cambio.removed
    paso.diff = cambio.diff
    return paso
  }

  if (nombre === 'Write' && typeof entrada.content === 'string') {
    const lineas = entrada.content === '' ? [] : entrada.content.split('\n')
    paso.target = ruta
    paso.added = lineas.length
    paso.removed = 0
    paso.diff = recortar(lineas.map((linea) => `+ ${linea}`).join('\n'), TURN_DIFF_MAX)
    return paso
  }

  if (typeof entrada.command === 'string') {
    paso.target = recortar(entrada.command, 400)
    return paso
  }

  if (ruta) {
    paso.target = ruta.slice(0, 400)
    return paso
  }

  const suelto = [entrada.pattern, entrada.description, entrada.prompt, entrada.url, entrada.query].find(
    (valor) => typeof valor === 'string' && valor.trim(),
  )
  paso.target = suelto ? recortar(suelto.trim(), 400) : ''
  return paso
}

/**
 * El cambio entre dos textos, en formato diff.
 *
 * No es un algoritmo de comparación completo y no pretende serlo: quita lo que
 * ambos lados tienen igual al principio y al final, y enseña el resto como
 * quitado y puesto. Para lo que hace una edición —sustituir un trozo concreto—
 * da exactamente lo que se ve en el editor, y cabe en un fichero sin
 * dependencias, que es la condición del enlace.
 */
function calcularDiff(viejo, nuevo) {
  const a = viejo === '' ? [] : viejo.split('\n')
  const b = nuevo === '' ? [] : nuevo.split('\n')

  let inicio = 0
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio += 1

  let fin = 0
  while (fin < a.length - inicio && fin < b.length - inicio && a[a.length - 1 - fin] === b[b.length - 1 - fin]) {
    fin += 1
  }

  const quitadas = a.slice(inicio, a.length - fin)
  const puestas = b.slice(inicio, b.length - fin)
  if (quitadas.length === 0 && puestas.length === 0) return { diff: null, added: 0, removed: 0 }

  // Dos líneas de contexto a cada lado: lo justo para ubicarse sin llenar la
  // tarjeta de código que no ha cambiado.
  const CONTEXTO = 2
  const antes = a.slice(Math.max(0, inicio - CONTEXTO), inicio)
  const despues = a.slice(a.length - fin, Math.min(a.length, a.length - fin + CONTEXTO))

  const lineas = [
    ...antes.map((linea) => `  ${linea}`),
    ...quitadas.map((linea) => `- ${linea}`),
    ...puestas.map((linea) => `+ ${linea}`),
    ...despues.map((linea) => `  ${linea}`),
  ]

  return { diff: recortar(lineas.join('\n'), TURN_DIFF_MAX), added: puestas.length, removed: quitadas.length }
}

/** Recorta por el principio, que es donde está lo que identifica al cambio. */
function recortar(texto, tope) {
  return texto.length <= tope ? texto : `${texto.slice(0, tope - 1)}…`
}

/**
 * ¿Es esto un mensaje TUYO, de los que empiezan un turno?
 *
 * Ojo: los resultados de las herramientas también viajan como mensajes de
 * «user». No son tuyos y no separan turnos — si se contaran, el turno se
 * cortaría en la primera herramienta y volveríamos a enseñar solo el último
 * trozo.
 */
function esMensajeDelDueño(entrada) {
  const contenido = entrada?.message?.content
  if (typeof contenido === 'string') return contenido.trim() !== ''
  if (!Array.isArray(contenido)) return false
  return contenido.some(
    (parte) => parte?.type === 'text' && typeof parte.text === 'string' && parte.text.trim() !== '',
  )
}

/**
 * Pregunta a la Torre si el dueño contesta este turno. Devuelve su texto, o
 * null si nadie contestó, la función está apagada o la Torre no está.
 */
async function askTurnReply(endpoint, payload) {
  try {
    const turno = leerRespuestaDelTurno(payload?.transcript_path)
    const res = await post(
      endpoint,
      '/turns',
      {
        requestId: randomUUID(),
        sessionId: payload?.session_id ?? null,
        cwd: payload?.cwd ?? process.cwd(),
        output: turno.output,
        steps: turno.steps,
        timestamp: new Date().toISOString(),
      },
      TURN_REPLY_TIMEOUT_MS,
    )
    if (!res.ok) return null
    const respuesta = await res.json()
    if (respuesta?.action === 'reply' && typeof respuesta.text === 'string' && respuesta.text.trim()) {
      return respuesta.text.trim()
    }
  } catch {
    // Torre cerrada o sin la ruta: el turno termina como siempre.
  }
  return null
}

/**
 * Manda un aviso de estado y sigue. No espera nada útil de vuelta.
 *
 * `sessionEnded` va SOLO cuando la sesión se ha cerrado (evento SessionEnd) —
 * no cuando termina un turno—. Es lo que permite a la Torre reciclar el muñeco
 * cuando abres otra conversación en la misma carpeta, en vez de acumular uno
 * por reinicio. Se omite en el resto de avisos para que una Torre anterior a
 * este campo (contrato estricto) siga aceptándolos.
 */
async function sendStatus(endpoint, payload, status, { sessionEnded = false } = {}) {
  try {
    const sessionTitle = readSessionTitle(payload?.session_id ?? null)
    await post(
      endpoint,
      '/sessions',
      {
        sessionId: payload?.session_id ?? null,
        cwd: payload?.cwd ?? process.cwd(),
        status,
        ...(sessionEnded ? { sessionEnded: true } : {}),
        ...(sessionTitle ? { sessionTitle } : {}),
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
  else if (event === 'Stop') {
    /*
     * Antes de dar el turno por cerrado, se le pregunta a la Torre si el dueño
     * quiere contestar desde allí (D25). La Torre responde al instante si la
     * función está apagada; si está encendida, esta llamada espera la ventana
     * configurada — igual que la de permisos.
     *
     * Si el dueño contesta, el turno NO termina: se devuelve `decision: block`
     * con su texto como `reason`, que es el mecanismo oficial de Claude Code
     * para continuar una conversación desde un hook de Stop. La sesión sigue en
     * su ventana de siempre, con la respuesta del dueño como siguiente entrada.
     */
    const respuesta = await askTurnReply(endpoint, payload)
    if (respuesta) {
      apuntar({ fase: 'turno-respondido', evento: event })
      process.stdout.write(`${JSON.stringify({ decision: 'block', reason: respuesta })}\n`)
      await salir()
    }
    // Nadie contestó (o la función está apagada): entrega normal, a la mesa.
    await sendStatus(endpoint, payload, 'completed')
  } else if (event === 'SessionEnd') {
    // Entrega igual, pero además la conversación se ha CERRADO: la tarea queda
    // libre para que la recicle la siguiente que se abra en esta carpeta.
    await sendStatus(endpoint, payload, 'completed', { sessionEnded: true })
  } else if (event === 'Notification') {
    /*
     * Te está pidiendo algo: a tu puerta. Este estado se reserva para eso.
     *
     * PERO no todas las notificaciones valen. Claude Code emite `Notification`
     * con un `notification_type`, y una de ellas —`permission_prompt`— es el
     * mismo permiso que ya llega por `PermissionRequest`, solo por otra puerta.
     *
     * Atenderla sería contarlo dos veces, y con el modo desatendido (D24) tiene
     * una consecuencia que rompe la función entera: la Torre aprueba el permiso
     * en silencio, pero este aviso pondría la tarea en «te espera» y te llegaría
     * la notificación de Windows igualmente. Es decir: el modo desatendido
     * dejaría de no interrumpir, que es lo único que se le pide.
     *
     * Así que los permisos se atienden SOLO por `PermissionRequest`, que además
     * lo hace mejor: enseña el comando entero y espera una decisión.
     */
    if (payload.notification_type === 'permission_prompt') {
      apuntar({ fase: 'ignorado', evento: event, motivo: 'permiso; ya llega por PermissionRequest' })
      process.exit(0)
    }
    await sendStatus(endpoint, payload, 'waiting_user')
  }

  await salir()
}

main().catch(bailOut)
