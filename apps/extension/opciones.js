import { buscarTorre, guardarClave, leerClave } from './torre.js'

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
