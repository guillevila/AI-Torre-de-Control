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

/**
 * Sitios donde la detección es posible, y el permiso EXACTO que hay que pedir
 * para cada uno.
 *
 * Se guarda el permiso escrito, no se construye a partir de la pestaña: Chrome
 * solo concede permisos que estén declarados palabra por palabra en el
 * manifiesto. Entrando por `www.chatgpt.com` se pediría `https://www.chatgpt.com/*`,
 * que no está declarado, y la petición fallaría sin más explicación.
 */
const VIGILABLES = {
  'chatgpt.com': 'https://chatgpt.com/*',
  'chat.openai.com': 'https://chat.openai.com/*',
  'claude.ai': 'https://claude.ai/*',
}

/**
 * Si la detección está activa, sabido ANTES de que pulses.
 *
 * No es un capricho de eficiencia. Chrome exige que pedir un permiso sea lo
 * primero que ocurra tras tu clic: cualquier consulta previa —aunque tarde un
 * milisegundo— «gasta» el gesto, y para cuando llega la petición Chrome ya la
 * rechaza por no venir de una acción tuya.
 *
 * Es exactamente lo que rompió el botón la primera vez: no hacía nada, y no
 * había ningún error a la vista. Por eso el estado se recuerda de antemano y el
 * clic va directo a pedir.
 */
let deteccionActiva = false
let origenVigilado = null

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
  const permiso = VIGILABLES[host]
  if (!permiso) return

  origenVigilado = permiso
  $deteccion.hidden = false
  await pintarDeteccion()

  $botonDeteccion.addEventListener('click', () => {
    // NADA de `await` antes de esta línea. Ver el comentario de arriba.
    const peticion = deteccionActiva
      ? chrome.permissions.remove({ origins: [origenVigilado] })
      : chrome.permissions.request({ origins: [origenVigilado] })

    peticion
      .then(() => pintarDeteccion())
      .catch((error) => {
        // Si algún día vuelve a fallar, que se vea el motivo en lugar de que el
        // botón se quede mudo.
        avisar('fallo', `Chrome no dejó cambiar el permiso: ${error?.message ?? 'motivo desconocido'}`)
      })
  })
}

async function pintarDeteccion() {
  if (!origenVigilado) return
  const activa = await chrome.permissions.contains({ origins: [origenVigilado] })
  deteccionActiva = activa

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
  if (resultado.recuperada) {
    avisar('ok', 'Estaba archivada y la he traído de vuelta. Ya la ves en la Torre, en «en cola».')
    $boton.textContent = 'Recuperada ✓'
  } else if (resultado.duplicada) {
    avisar('ok', 'Esta conversación ya estaba en la Torre. No se ha duplicado.')
    $boton.textContent = 'Ya estaba registrada'
  } else {
    avisar('ok', 'Registrada. Ya la tienes en la Torre, en «en cola».')
    $boton.textContent = 'Registrada ✓'
  }
}

void arrancar()
