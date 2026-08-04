import { buscarTorre, leerClave, nombrePlataforma, registrar } from './torre.js'

const $titulo = document.getElementById('titulo')
const $sitio = document.getElementById('sitio')
const $plataforma = document.getElementById('plataforma')
const $boton = document.getElementById('registrar')
const $aviso = document.getElementById('aviso')

function avisar(tono, mensaje) {
  $aviso.dataset.tono = tono
  $aviso.textContent = mensaje
  $aviso.hidden = false
}

document.getElementById('ir-a-opciones').addEventListener('click', (evento) => {
  evento.preventDefault()
  chrome.runtime.openOptionsPage()
})

/**
 * Arranque.
 *
 * `activeTab` da acceso a la pestaña SOLO porque acabas de pulsar el icono de
 * la extensión, y solo a esa. No es un permiso permanente sobre el sitio: en
 * cuanto cierras esta ventana, se acaba.
 */
async function arrancar() {
  const [pestaña] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = pestaña?.url ?? ''
  const title = (pestaña?.title ?? '').trim()

  if (!/^https?:\/\//i.test(url)) {
    $titulo.textContent = 'Esta pestaña no se puede registrar'
    $sitio.textContent = 'Solo valen páginas web (http o https).'
    return
  }

  $titulo.textContent = title || '(la pestaña no tiene título)'
  $sitio.textContent = new URL(url).host

  const plataforma = nombrePlataforma(url)
  if (plataforma) {
    $plataforma.textContent = plataforma
    $plataforma.hidden = false
  }

  const token = await leerClave()
  if (!token) {
    avisar('atencion', 'Falta la clave local. Ábrela en Ajustes y pégala una sola vez.')
    return
  }

  if (!title) {
    avisar('atencion', 'La pestaña no tiene título, y hace falta uno para registrarla.')
    return
  }

  $boton.disabled = false
  $boton.addEventListener('click', () => void enviar({ token, title, externalUrl: url }))

  await montarDeteccion(url)
}

/* ── Etapa 2: detección automática ─────────────────────────────────────────── */

const $deteccion = document.getElementById('deteccion')
const $punto = document.getElementById('deteccion-punto')
const $estado = document.getElementById('deteccion-estado')
const $botonDeteccion = document.getElementById('deteccion-boton')
const $nota = document.getElementById('deteccion-nota')

/** Sitios donde la detección es posible. Debe coincidir con el manifiesto. */
const VIGILABLES = ['chatgpt.com', 'chat.openai.com', 'claude.ai']

/**
 * Enseña el interruptor de la detección automática.
 *
 * Solo aparece en los sitios donde puede funcionar: ofrecerlo en cualquier
 * página sería pedir un permiso que no serviría de nada.
 *
 * El permiso se concede aquí y se retira aquí. Mientras no lo concedas, la
 * extensión sigue sin poder ver nada de la página, ni siquiera si está
 * generando.
 */
async function montarDeteccion(url) {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  if (!VIGILABLES.includes(host)) return

  const origen = `${new URL(url).origin}/*`
  $deteccion.hidden = false
  await pintarDeteccion(origen)

  $botonDeteccion.addEventListener('click', async () => {
    const concedido = await chrome.permissions.contains({ origins: [origen] })
    if (concedido) {
      await chrome.permissions.remove({ origins: [origen] })
    } else {
      // Chrome enseña su propio cuadro. Si dices que no, no pasa nada más.
      await chrome.permissions.request({ origins: [origen] })
    }
    await pintarDeteccion(origen)
  })
}

async function pintarDeteccion(origen) {
  const activa = await chrome.permissions.contains({ origins: [origen] })

  $punto.dataset.activa = String(activa)
  $estado.textContent = activa ? 'Detección automática activada' : 'Detección automática desactivada'
  $botonDeteccion.textContent = activa ? 'Desactivar' : 'Activar en este sitio'
  $nota.textContent = activa
    ? 'La tarea pasará sola a «trabajando» y a «terminada». La extensión mira solo si hay una respuesta generándose, nunca el texto. Puedes desactivarlo aquí mismo.'
    : 'Si la activas, la tarea se moverá sola. Chrome te pedirá permiso para este sitio: es lo que permite ver si hay una respuesta en marcha. Sigue sin leerse el texto de la conversación.'
}

async function enviar({ token, title, externalUrl }) {
  $boton.disabled = true
  $boton.textContent = 'Registrando…'
  $aviso.hidden = true

  const puerto = await buscarTorre()
  if (!puerto) {
    avisar('fallo', 'No encuentro la Torre. ¿Está abierta la aplicación?')
    $boton.disabled = false
    $boton.textContent = 'Registrar en la Torre'
    return
  }

  let resultado
  try {
    resultado = await registrar({ puerto, token, title, externalUrl })
  } catch {
    avisar('fallo', 'No se pudo hablar con la Torre. Inténtalo otra vez.')
    $boton.disabled = false
    $boton.textContent = 'Registrar en la Torre'
    return
  }

  if (!resultado.ok) {
    avisar('fallo', resultado.mensaje)
    $boton.disabled = false
    $boton.textContent = 'Registrar en la Torre'
    return
  }

  // Se distingue crear de reconocer: pulsar dos veces sobre la misma
  // conversación no crea una tarea gemela, y conviene decirlo en lugar de
  // fingir un alta que no ha ocurrido.
  if (resultado.duplicada) {
    avisar('ok', 'Esta conversación ya estaba en la Torre. No se ha duplicado.')
    $boton.textContent = 'Ya estaba registrada'
  } else {
    avisar('ok', 'Registrada. Ya la tienes en la Torre, en «en cola».')
    $boton.textContent = 'Registrada ✓'
  }
}

void arrancar()
