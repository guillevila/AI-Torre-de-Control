/**
 * El fondo de la extensión.
 *
 * Existe por una razón técnica concreta: un script metido en una página web
 * está sujeto a las reglas de ESA página, y ChatGPT no permite llamar a tu
 * ordenador. El fondo sí puede, porque usa los permisos de la extensión.
 *
 * Hace dos cosas y ninguna más:
 *
 *  1. Da de alta el vigilante en los sitios donde TÚ has concedido permiso, y
 *     lo retira en cuanto se lo quitas.
 *  2. Reenvía a la Torre las dos palabras que el vigilante manda.
 *
 * No mira páginas, no guarda nada de lo que pasa por él y no se despierta solo:
 * Chrome lo arranca cuando hace falta y lo apaga cuando no.
 */

import { apuntar, avisarActividad, buscarTorre, leerClave } from './torre.js'

/** Dónde puede vigilar, si le das permiso. Lista cerrada a propósito. */
const SITIOS_VIGILABLES = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://claude.ai/*',
]

const ID_VIGILANTE = 'vigilante-torre'

/**
 * Pone el vigilante donde haya permiso, y lo quita donde no.
 *
 * Se recalcula entero en lugar de ir sumando: así retirar un permiso desde
 * Chrome lo retira de verdad, sin depender de que alguien avise.
 */
async function sincronizarVigilante() {
  const registrados = await chrome.scripting.getRegisteredContentScripts().catch(() => [])
  const yaEstaba = registrados.some((script) => script.id === ID_VIGILANTE)

  const permitidos = []
  for (const sitio of SITIOS_VIGILABLES) {
    if (await chrome.permissions.contains({ origins: [sitio] }).catch(() => false)) {
      permitidos.push(sitio)
    }
  }

  if (permitidos.length === 0) {
    if (yaEstaba) await chrome.scripting.unregisterContentScripts({ ids: [ID_VIGILANTE] })
    await apuntar({ que: 'vigilante retirado', detalle: 'no hay ningún sitio con permiso' })
    return
  }

  const definicion = {
    id: ID_VIGILANTE,
    js: ['vigilante.js'],
    matches: permitidos,
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }

  try {
    if (yaEstaba) await chrome.scripting.updateContentScripts([definicion])
    else await chrome.scripting.registerContentScripts([definicion])
    await apuntar({ que: 'vigilante puesto', detalle: permitidos.join(', ') })
  } catch (error) {
    // Que Chrome no deje poner el vigilante es exactamente el tipo de fallo que
    // desde fuera se ve como «no funciona» sin más. Queda escrito.
    await apuntar({
      que: 'NO se pudo poner el vigilante',
      detalle: error?.message ?? 'motivo desconocido',
      mal: true,
    })
  }
}

// Los tres momentos en que puede haber cambiado algo.
chrome.runtime.onInstalled.addListener(() => void sincronizarVigilante())
chrome.runtime.onStartup.addListener(() => void sincronizarVigilante())
chrome.permissions.onAdded.addListener(() => void sincronizarVigilante())
chrome.permissions.onRemoved.addListener(() => void sincronizarVigilante())

/**
 * Reenvía a la Torre lo que ve el vigilante.
 *
 * Se descarta cualquier mensaje que no sea exactamente lo esperado. El
 * vigilante corre dentro de una página web, así que se le trata como a
 * cualquier otra cosa que venga de fuera: no se da nada por bueno.
 */
chrome.runtime.onMessage.addListener((mensaje, remitente) => {
  // El saludo del vigilante. Sirve para distinguir «no está puesto» de «está
  // puesto pero no reconoce nada», que desde fuera se ven exactamente igual.
  if (mensaje?.tipo === 'vigilante-vivo') {
    void apuntar({
      que: 'vigilante en marcha',
      detalle: `en ${mensaje.host}${
        mensaje.reconoce?.length ? ` · reconoce: ${mensaje.reconoce.join(', ')}` : ' · ahora mismo no ve nada generándose (normal si no has pedido nada)'
      }`,
    })
    return
  }

  if (mensaje?.tipo !== 'actividad') return
  if (mensaje.estado !== 'running' && mensaje.estado !== 'completed') return
  // Solo se acepta la dirección que Chrome dice que tiene esa pestaña, no la
  // que diga el mensaje: una página no puede hablar por otra.
  const url = remitente?.tab?.url
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return

  void enviar(mensaje.estado, url, mensaje.reconoce)
  // Sin respuesta: al vigilante no le hace falta saber cómo acabó.
})

async function enviar(estado, url, reconoce) {
  const sitio = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return '—'
    }
  })()

  await apuntar({
    que: `detectado: ${estado}`,
    detalle: `en ${sitio}${reconoce?.length ? ` · por ${reconoce.join(', ')}` : ''}`,
  })

  try {
    const token = await leerClave()
    if (!token) {
      await apuntar({ que: 'no se envió', detalle: 'falta la clave local', mal: true })
      return
    }

    const puerto = await buscarTorre()
    if (!puerto) {
      await apuntar({ que: 'no se envió', detalle: 'la Torre no está abierta', mal: true })
      return
    }

    const resultado = await avisarActividad({ puerto, token, externalUrl: url, status: estado })

    if (!resultado.ok) {
      await apuntar({ que: 'la Torre lo rechazó', detalle: resultado.mensaje, mal: true })
    } else if (!resultado.emparejada) {
      await apuntar({
        que: 'conversación sin registrar',
        detalle: 'la Torre no tiene ninguna tarea con esta dirección; regístrala primero',
        mal: true,
      })
    } else {
      await apuntar({ que: `la Torre la puso en «${resultado.estado ?? estado}»`, detalle: sitio })
    }
  } catch (error) {
    await apuntar({
      que: 'no se pudo hablar con la Torre',
      detalle: error?.message ?? 'motivo desconocido',
      mal: true,
    })
  }
}
