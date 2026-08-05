import { borrarBitacora, buscarTorre, guardarClave, leerBitacora, leerClave } from './torre.js'

const $token = document.getElementById('token')
const $guardar = document.getElementById('guardar')
const $aviso = document.getElementById('aviso')

function avisar(tono, mensaje) {
  $aviso.dataset.tono = tono
  $aviso.textContent = mensaje
  $aviso.hidden = false
}

leerClave().then((token) => {
  if (token) $token.value = token
})

/**
 * Guardar comprueba de verdad.
 *
 * Decir «guardado» sin haber hablado con la Torre dejaría el fallo para más
 * tarde, cuando ya no recuerdas qué pegaste. Se busca la Torre y se prueba la
 * clave con una petición vacía a propósito: la Torre la rechaza por contenido
 * (422) si la clave es buena, y con 401 si no lo es. Esa diferencia es
 * exactamente lo que hace falta saber, y no crea ninguna tarea.
 */
$guardar.addEventListener('click', async () => {
  const token = $token.value.trim()
  if (!token) {
    avisar('fallo', 'Pega la clave antes de guardar.')
    return
  }

  await guardarClave(token)

  $guardar.disabled = true
  $guardar.textContent = 'Comprobando…'

  try {
    const puerto = await buscarTorre()
    if (!puerto) {
      avisar('fallo', 'Clave guardada, pero no encuentro la Torre. ¿Está abierta la aplicación?')
      return
    }

    const respuesta = await fetch(`http://127.0.0.1:${puerto}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': token },
      body: JSON.stringify({}),
    })

    if (respuesta.status === 401) {
      avisar('fallo', 'La Torre no reconoce esa clave. Cópiala otra vez desde la aplicación.')
      return
    }

    // Cualquier otra respuesta significa que la clave pasó la puerta.
    avisar('ok', `Clave correcta. La Torre responde en el puerto ${puerto}.`)
  } catch {
    avisar('fallo', 'Clave guardada, pero no se pudo hablar con la Torre.')
  } finally {
    $guardar.disabled = false
    $guardar.textContent = 'Guardar y comprobar'
  }
})

/* ── Diagnóstico de la detección automática ────────────────────────────────── */

const SITIOS = [
  ['ChatGPT', 'https://chatgpt.com/*'],
  ['ChatGPT (openai.com)', 'https://chat.openai.com/*'],
  ['Claude', 'https://claude.ai/*'],
]

const $estado = document.getElementById('estado-deteccion')
const $bitacora = document.getElementById('bitacora')

const linea = (texto, ok) => {
  const li = document.createElement('li')
  if (ok !== undefined) li.dataset.ok = String(ok)
  li.textContent = texto
  return li
}

/**
 * Enseña en qué punto se corta la cadena.
 *
 * Son cuatro cosas que tienen que cumplirse a la vez, y desde fuera todas
 * fallan igual: la tarea no se mueve. Verlas por separado convierte «no
 * funciona» en «falta esto».
 */
async function pintarEstado() {
  $estado.replaceChildren()

  // 1. ¿Hay permiso en algún sitio?
  const conPermiso = []
  for (const [nombre, patron] of SITIOS) {
    const concedido = await chrome.permissions.contains({ origins: [patron] }).catch(() => false)
    if (concedido) conPermiso.push(nombre)
  }

  $estado.append(
    linea(
      conPermiso.length
        ? `Permiso concedido en: ${conPermiso.join(', ')}`
        : 'Sin permiso en ningún sitio. Actívalo desde la ventana de la extensión, estando en ChatGPT.',
      conPermiso.length > 0,
    ),
  )

  // 2. ¿Está puesto el vigilante?
  const registrados = await chrome.scripting.getRegisteredContentScripts().catch(() => [])
  const vigilante = registrados.find((s) => s.id === 'vigilante-torre')
  $estado.append(
    linea(
      vigilante
        ? `Vigilante puesto en: ${(vigilante.matches ?? []).join(', ')}`
        : 'El vigilante no está puesto. Sin permiso no puede ponerse.',
      Boolean(vigilante),
    ),
  )

  // 3. ¿Hay clave local?
  const token = await leerClave()
  $estado.append(linea(token ? 'Clave local guardada' : 'Falta la clave local', Boolean(token)))

  // 4. ¿Está la Torre abierta?
  const puerto = await buscarTorre()
  $estado.append(
    linea(
      puerto ? `Torre abierta en el puerto ${puerto}` : 'No encuentro la Torre. ¿Está abierta?',
      Boolean(puerto),
    ),
  )
}

async function pintarBitacora() {
  const apuntes = await leerBitacora()
  $bitacora.replaceChildren()

  if (apuntes.length === 0) {
    const vacio = document.createElement('li')
    vacio.className = 'bitacora__vacio'
    vacio.textContent =
      'Todavía no ha pasado nada. Escribe algo en ChatGPT y debería aparecer aquí en segundos.'
    $bitacora.append(vacio)
    return
  }

  for (const apunte of apuntes) {
    const li = document.createElement('li')
    if (apunte.mal) li.dataset.mal = 'true'

    const hora = document.createElement('span')
    hora.className = 'bitacora__hora'
    hora.textContent = String(apunte.at ?? '').slice(11, 19)

    const que = document.createElement('span')
    que.className = 'bitacora__que'
    que.textContent = apunte.que ?? ''

    if (apunte.detalle) {
      const detalle = document.createElement('span')
      detalle.className = 'bitacora__detalle'
      detalle.textContent = apunte.detalle
      que.append(detalle)
    }

    li.append(hora, que)
    $bitacora.append(li)
  }
}

document.getElementById('limpiar').addEventListener('click', async () => {
  await borrarBitacora()
  await pintarBitacora()
})

// Se refresca solo: puedes dejar esta pantalla abierta al lado de ChatGPT y ver
// aparecer las señales según escribes.
void pintarEstado()
void pintarBitacora()
setInterval(() => {
  void pintarBitacora()
}, 2000)
setInterval(() => {
  void pintarEstado()
}, 5000)
