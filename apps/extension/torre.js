/**
 * Lo que la extensión sabe hacer con la Torre.
 *
 * Vive aparte de la ventana para poder leerse de un tirón: aquí está TODO lo
 * que sale del navegador, y no es mucho.
 */

/** Los mismos puertos que intenta abrir la aplicación, en el mismo orden. */
const PUERTOS = [4319, 4320, 4321, 4322, 4323]

/** Si la Torre no contesta en esto, es que no está abierta. */
const ESPERA_MS = 1500

/**
 * Nombre legible de cada plataforma, para enseñar lo que se va a registrar.
 *
 * Se deduce del dominio, igual que en la aplicación. Es una ayuda visual: quien
 * decide de verdad es la Torre, con la dirección que recibe.
 */
const PLATAFORMAS = [
  [/(^|\.)chatgpt\.com$/, 'ChatGPT'],
  [/(^|\.)chat\.openai\.com$/, 'ChatGPT'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)gemini\.google\.com$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
]

/**
 * ¿Esta pestaña es ya una conversación, o todavía un chat en blanco?
 *
 * Importa más de lo que parece. Un chat sin empezar vive en una dirección
 * genérica —`chatgpt.com/`—, y en cuanto escribes el primer mensaje la
 * herramienta la cambia por la de la conversación. Registrar antes de escribir
 * ata la tarea a una dirección que la conversación abandona al instante: el
 * vigilante avisará sobre la nueva, no coincidirá con nada, y ese muñeco no se
 * moverá nunca. Un icono muerto desde que nace.
 *
 * Ante un sitio que no conocemos se contesta que sí: no nos corresponde impedir
 * registrar algo que no sabemos leer.
 */
const CONVERSACION_EMPEZADA = [
  // ChatGPT: /c/<id>, y también los GPT personalizados y los proyectos.
  [/(^|\.)chatgpt\.com$/, (ruta) => /^\/(c|g|project|codex|gpts)\//i.test(ruta)],
  [/(^|\.)chat\.openai\.com$/, (ruta) => /^\/(c|g)\//i.test(ruta)],
  // Claude: /chat/<id> y /cowork/<id>. `/new` es el chat en blanco.
  [/(^|\.)claude\.ai$/, (ruta) => /^\/(chat|cowork|project)\/[^/]+/i.test(ruta)],
]

export function conversacionEmpezada(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    for (const [patron, empezada] of CONVERSACION_EMPEZADA) {
      if (patron.test(host)) return empezada(parsed.pathname)
    }
    return true
  } catch {
    return true
  }
}

export function nombrePlataforma(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const [patron, nombre] of PLATAFORMAS) if (patron.test(host)) return nombre
    return null
  } catch {
    return null
  }
}

/** La clave local, que pegas una sola vez en los ajustes de la extensión. */
export async function leerClave() {
  const guardado = await chrome.storage.local.get('token')
  const token = typeof guardado.token === 'string' ? guardado.token.trim() : ''
  return token || null
}

export async function guardarClave(token) {
  await chrome.storage.local.set({ token: String(token ?? '').trim() })
}

/**
 * Nombre de la cuenta de este perfil de navegador.
 *
 * Cada perfil de Chrome guarda lo suyo, así que basta con escribirlo una vez
 * por perfil y todas las conversaciones que registres desde ahí lo llevan.
 *
 * Existe porque tener tres chats de una cuenta y dos de otra abiertos a la vez
 * es normal, y sin esto los cinco muñecos se ven exactamente igual.
 *
 * Lo escribes tú: la extensión **no sabe** con qué cuenta de ChatGPT estás
 * —tendría que leer la página para averiguarlo, y no lo hace—.
 */
export async function leerCuenta() {
  const guardado = await chrome.storage.local.get('cuenta')
  const cuenta = typeof guardado.cuenta === 'string' ? guardado.cuenta.trim() : ''
  return cuenta || null
}

export async function guardarCuenta(cuenta) {
  // 40 es el tope que acepta la Torre. Recortar aquí evita que un nombre largo
  // se traduzca en un rechazo incomprensible al registrar.
  await chrome.storage.local.set({ cuenta: String(cuenta ?? '').trim().slice(0, 40) })
}

/* ── Cuaderno de bitácora ──────────────────────────────────────────────────── */

/** Cuántos apuntes se guardan. Interesa lo reciente, no el archivo histórico. */
const BITACORA_MAX = 40

/**
 * Apunta lo que va pasando, para poder mirarlo en los Ajustes de la extensión.
 *
 * Existe por la misma razón que el cuaderno del enlace con Claude Code: dentro
 * del navegador no se ve nada, y un fallo mudo sin rastro se convierte en una
 * tarde de adivinar. Esto lo convierte en dos minutos de mirar.
 *
 * **Nunca apunta texto de la conversación.** Solo qué ocurrió, en qué sitio y
 * con qué resultado. Ni siquiera guarda la dirección completa: solo el servidor,
 * porque la dirección de una conversación ya es un dato de más para un registro
 * de diagnóstico.
 */
export async function apuntar(entrada) {
  try {
    const { bitacora } = await chrome.storage.local.get('bitacora')
    const lista = Array.isArray(bitacora) ? bitacora : []
    lista.unshift({ at: new Date().toISOString(), ...entrada })
    await chrome.storage.local.set({ bitacora: lista.slice(0, BITACORA_MAX) })
  } catch {
    // Un cuaderno que no se puede escribir no puede estropear nada.
  }
}

export async function leerBitacora() {
  try {
    const { bitacora } = await chrome.storage.local.get('bitacora')
    return Array.isArray(bitacora) ? bitacora : []
  } catch {
    return []
  }
}

export async function borrarBitacora() {
  try {
    await chrome.storage.local.remove('bitacora')
  } catch {
    // Da igual.
  }
}

/**
 * Busca en qué puerto está escuchando la Torre.
 *
 * Se prueba `/health`, que no pide clave y no revela ningún dato: solo dice si
 * la aplicación está abierta. El puerto que responde se recuerda y se prueba
 * primero la próxima vez, para no barrer los cinco cada vez.
 */
export async function buscarTorre() {
  const { puertoRecordado } = await chrome.storage.local.get('puertoRecordado')
  const orden = [puertoRecordado, ...PUERTOS].filter(
    (puerto, indice, lista) => typeof puerto === 'number' && lista.indexOf(puerto) === indice,
  )

  for (const puerto of orden) {
    if (await respondeEn(puerto)) {
      await chrome.storage.local.set({ puertoRecordado: puerto })
      return puerto
    }
  }
  return null
}

async function respondeEn(puerto) {
  try {
    const respuesta = await fetch(`http://127.0.0.1:${puerto}/health`, {
      signal: AbortSignal.timeout(ESPERA_MS),
    })
    if (!respuesta.ok) return false
    const cuerpo = await respuesta.json()
    return cuerpo?.status === 'ok'
  } catch {
    return false
  }
}

/**
 * Registra la pestaña en la Torre.
 *
 * Lo que se envía es exactamente esto y nada más: un título y una dirección. Si
 * algún día alguien añadiera un campo aquí, la Torre rechazaría la petición
 * entera —su contrato es estricto—, así que este archivo no puede filtrar nada
 * por descuido.
 */
export async function registrar({ puerto, token, title, externalUrl, cuenta }) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': token },
    // La cuenta solo viaja si la has escrito. Sin ella el paquete sigue siendo
    // exactamente el de antes: título y dirección.
    body: JSON.stringify(cuenta ? { title, externalUrl, account: cuenta } : { title, externalUrl }),
    signal: AbortSignal.timeout(ESPERA_MS * 4),
  })

  let cuerpo = null
  try {
    cuerpo = await respuesta.json()
  } catch {
    // Sin cuerpo legible, manda el código.
  }

  if (respuesta.status === 401) {
    return { ok: false, motivo: 'clave', mensaje: 'La clave local no es correcta.' }
  }
  if (!respuesta.ok || !cuerpo?.accepted) {
    return {
      ok: false,
      motivo: 'rechazo',
      mensaje: cuerpo?.reason ?? `La Torre rechazó el registro (código ${respuesta.status}).`,
    }
  }

  return {
    ok: true,
    duplicada: Boolean(cuerpo.duplicate),
    // Estaba archivada y la Torre la ha traído de vuelta. Merece decirse aparte:
    // «ya estaba» a secas dejaría al usuario buscando algo que no veía.
    recuperada: Boolean(cuerpo.revived),
    titulo: cuerpo.title,
  }
}

/**
 * Avisa de que una conversación empieza o termina (etapa 2).
 *
 * Igual que el alta: lo que sale de aquí son la dirección, una de dos palabras
 * y la hora. La Torre rechazaría la petición entera si llevara algo más.
 *
 * Si esa conversación no está registrada, la Torre contesta que no la conoce y
 * aquí se acepta sin más. No es un fallo: registrar sigue siendo decisión tuya.
 */
export async function avisarActividad({ puerto, token, externalUrl, status }) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/web-activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': token },
    body: JSON.stringify({ externalUrl, status, timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(ESPERA_MS * 2),
  })

  let cuerpo = null
  try {
    cuerpo = await respuesta.json()
  } catch {
    // Sin cuerpo legible, manda el código.
  }

  if (!respuesta.ok || !cuerpo?.accepted) {
    return { ok: false, mensaje: cuerpo?.reason ?? `código ${respuesta.status}` }
  }

  return { ok: true, emparejada: Boolean(cuerpo.matched), estado: cuerpo.status ?? null }
}
