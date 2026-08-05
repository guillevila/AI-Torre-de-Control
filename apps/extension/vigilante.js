/**
 * Vigilante de la página — etapa 2.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ MIRA, Y QUÉ NO
 *
 * Mira **una sola cosa**: si existe en la página el botón de detener la
 * respuesta. Mientras está, la herramienta está generando; cuando desaparece,
 * ha terminado. Es como mirar si la luz del despacho está encendida: te dice
 * que hay alguien trabajando, no lo que está escribiendo.
 *
 * **Nunca lee texto de la conversación.** No accede al contenido de los
 * mensajes, ni lo guarda, ni lo envía. Lo único que sale de aquí son dos
 * palabras —`running` o `completed`— y la dirección de la pestaña. Ese es
 * literalmente todo el mensaje.
 *
 * Este fichero solo se ejecuta si TÚ has concedido el permiso desde la ventana
 * de la extensión, y puedes retirarlo cuando quieras desde Chrome.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sobre lo frágil que es esto: ChatGPT cambia su interfaz cada pocas semanas.
 * Cuando lo haga, dejaremos de reconocer el botón. Por eso hay varias formas de
 * reconocerlo y, si ninguna funciona, **el vigilante calla**: nunca inventa un
 * estado. Una Torre que no se entera es un incordio; una que miente es un
 * problema de verdad.
 */

/*
 * Puede entrar dos veces en la misma página: una porque está dado de alta para
 * las páginas nuevas, y otra porque se metió a mano en las que ya estaban
 * abiertas. Dos vigilantes mirando lo mismo mandarían todo por duplicado.
 *
 * Esta marca vive en el mundo aislado de la extensión, no en el de la página:
 * ni la página la ve, ni puede tocarla.
 */
if (window.__torreVigilanteEnMarcha) {
  // Ya hay uno trabajando aquí. Este se retira sin hacer nada.
} else {
  window.__torreVigilanteEnMarcha = true
  arrancarVigilante()
}

function arrancarVigilante() {
/**
 * Formas de reconocer «se está generando una respuesta», de más a menos fiable.
 *
 * Se prueban todas y basta con que una acierte. Están escritas por separado
 * para que, cuando una deje de valer, se vea cuál hay que cambiar.
 */
const SEÑALES_GENERANDO = [
  // La más estable históricamente: el botón de parar lleva su propia marca.
  '[data-testid="stop-button"]',
  '[data-testid="composer-stop-button"]',
  // Algunas versiones marcan el compositor entero mientras responde.
  'form [data-state="generating"]',
  '[data-state="generating"]',

  /*
   * Por etiqueta accesible, para cuando cambien las marcas anteriores.
   *
   * Se exige que la etiqueta hable de GENERAR o de la RESPUESTA, no un «Stop» a
   * secas: ChatGPT tiene otros botones de parar —el dictado por voz, el de leer
   * en voz alta— y un patrón amplio los confundiría con una respuesta en curso.
   * Ese error es especialmente feo porque deja la tarea trabajando para siempre.
   */
  'button[aria-label*="stop generating" i]',
  'button[aria-label*="stop streaming" i]',
  'button[aria-label*="detener generación" i]',
  'button[aria-label*="detener la generación" i]',
  'button[aria-label*="detener respuesta" i]',
  'button[aria-label*="parar generación" i]',
]

/** Cada cuánto se mira, como mucho. Suficiente para no perder el cambio. */
const INTERVALO_MS = 700

/** Antes de dar por terminada una respuesta se espera a que se asiente. */
const ESPERA_FIN_MS = 1200

let generando = false
let ultimoEnviado = null
let temporizadorFin = null

/**
 * La Torre no conocía la última conversación de la que avisamos.
 *
 * Pasa siempre que registras una conversación **mientras ya está respondiendo**:
 * el aviso de «ha empezado» ocurrió antes de que la tarea existiera, se
 * descartó, y como solo se avisa de los CAMBIOS, nadie vuelve a decirlo. La
 * tarea se quedaba en «en cola» hasta el siguiente cambio, que podía tardar.
 *
 * Con esto se repite el aviso hasta que la Torre lo reconozca.
 */
let reanunciar = false
let ultimoReintento = 0

/** Entre reintentos, para no machacar a la Torre con algo que no conoce. */
const ESPERA_REINTENTO_MS = 4000

/**
 * A partir de aquí, «sigue generando» deja de ser creíble.
 *
 * Ninguna respuesta tarda cinco minutos. Si el vigilante lleva tanto viendo la
 * señal, lo más probable es que esté reconociendo mal algo —un botón oculto,
 * otro botón de parar que no es el de la respuesta— y la tarea se quede en
 * «trabajando» para siempre.
 *
 * No se inventa un estado por eso: se APUNTA en el cuaderno. Callarse sería
 * repetir el fallo que costó encontrar esto.
 */
const DEMASIADO_GENERANDO_MS = 5 * 60 * 1000
let generandoDesde = 0
let sospechaAvisada = false

/**
 * ¿Este elemento se VE de verdad?
 *
 * Es la comprobación que faltaba, y explicaba el fallo entero: `querySelector`
 * encuentra también lo que está oculto. ChatGPT tiene el botón de parar
 * permanentemente en la página y solo lo muestra o lo esconde, así que el
 * vigilante veía «está generando» para siempre: la tarea entraba en
 * «trabajando» y no salía nunca, ni al terminar ni al pedirle algo nuevo.
 *
 * `offsetParent` es nulo cuando el elemento o alguno de sus padres está oculto
 * con `display:none`. Se comprueban además el tamaño y `visibility`, que
 * `offsetParent` no cubre.
 */
function esVisible(el) {
  if (!el) return false
  if (el.hasAttribute?.('hidden')) return false
  if (el.getAttribute?.('aria-hidden') === 'true') return false
  if (el.offsetParent === null) return false

  const caja = el.getBoundingClientRect?.()
  if (caja && (caja.width === 0 || caja.height === 0)) return false

  const estilo = el.ownerDocument?.defaultView?.getComputedStyle?.(el)
  if (estilo && (estilo.visibility === 'hidden' || estilo.display === 'none')) return false

  return true
}

/** Qué señales reconoce ahora mismo. Vacío = no ve nada generándose. */
function señalesQueCoinciden() {
  const vistas = []
  for (const señal of SEÑALES_GENERANDO) {
    try {
      // `querySelectorAll` y no `querySelector`: puede haber un botón oculto
      // antes que el bueno, y quedarse con el primero daría un falso negativo.
      for (const el of document.querySelectorAll(señal)) {
        if (esVisible(el)) {
          vistas.push(señal)
          break
        }
      }
    } catch {
      // Un selector que este navegador no entiende no puede tumbar al resto.
    }
  }
  return vistas
}

function estaGenerando() {
  return señalesQueCoinciden().length > 0
}

/**
 * Avisa de que el vigilante está en marcha.
 *
 * Es lo que permite distinguir «no está puesto» de «está puesto pero no
 * reconoce nada», que son dos problemas completamente distintos y desde fuera
 * se ven igual: la tarea no se mueve.
 */
function saludar() {
  try {
    chrome.runtime.sendMessage({
      tipo: 'vigilante-vivo',
      host: location.hostname,
      reconoce: señalesQueCoinciden(),
    })
  } catch {
    // La extensión se ha recargado. No es asunto de la página.
  }
}

/**
 * Manda el estado al fondo de la extensión, que es quien habla con la Torre.
 *
 * Desde aquí no se puede llamar a la Torre directamente: un script metido en
 * una página web está sujeto a las reglas de esa página, y ChatGPT no permite
 * llamar a tu ordenador. Va por el fondo, que sí puede.
 */
function avisar(estado, reconocidas = []) {
  const url = location.href
  const huella = `${estado}·${url}`
  // Ni repetir el mismo aviso, ni marear a la Torre con lo que ya sabe. Salvo
  // que el anterior no llegara a ninguna tarea: entonces sí hay que insistir.
  if (huella === ultimoEnviado && !reanunciar) return
  ultimoEnviado = huella
  reanunciar = false
  ultimoReintento = Date.now()

  try {
    // `reconoce` viaja solo para el cuaderno: dice QUÉ señal acertó, que es lo
    // que hará falta el día que ChatGPT cambie su interfaz.
    chrome.runtime.sendMessage(
      { tipo: 'actividad', estado, url, reconoce: reconocidas },
      (respuesta) => {
        // Sin `lastError` consultado, Chrome se queja por consola cuando no hay
        // nadie escuchando. No es un problema: solo hay que mirarlo.
        if (chrome.runtime.lastError) return
        // La Torre no conocía esta conversación: seguramente aún no la habías
        // registrado. Se repetirá hasta que la reconozca.
        reanunciar = respuesta?.emparejada === false
      },
    )
  } catch {
    // La extensión se ha recargado o desactivado. No es asunto de la página.
  }
}

function revisar() {
  const coinciden = señalesQueCoinciden()
  const ahora = coinciden.length > 0

  if (ahora && !generando) {
    generando = true
    generandoDesde = Date.now()
    sospechaAvisada = false
    if (temporizadorFin) {
      clearTimeout(temporizadorFin)
      temporizadorFin = null
    }
    avisar('running', coinciden)
    return
  }

  // Lleva demasiado «generando» para ser verdad. Se apunta, no se inventa nada.
  if (ahora && generando && !sospechaAvisada && Date.now() - generandoDesde > DEMASIADO_GENERANDO_MS) {
    sospechaAvisada = true
    try {
      chrome.runtime.sendMessage({
        tipo: 'sospecha',
        host: location.hostname,
        minutos: Math.round((Date.now() - generandoDesde) / 60000),
        reconoce: coinciden,
      })
    } catch {
      // La extensión se ha recargado. No es asunto de la página.
    }
  }

  /*
   * Sin cambio, pero la Torre no reconoció el último aviso.
   *
   * Es el caso de registrar una conversación que YA estaba respondiendo: se
   * repite «trabajando» hasta que exista la tarea a la que aplicarlo.
   *
   * Solo se repite `running`, nunca `completed`: es el único estado que se
   * puede ver ahora mismo. Anunciar que algo terminó sin haberlo visto empezar
   * sería inventarse un dato.
   */
  if (ahora && reanunciar && Date.now() - ultimoReintento > ESPERA_REINTENTO_MS) {
    avisar('running', coinciden)
    return
  }

  if (!ahora && generando) {
    // No se avisa en cuanto desaparece: el botón parpadea entre bloques de una
    // misma respuesta, y avisar ahí encadenaría «terminada / trabajando /
    // terminada» sin que haya pasado nada. Se espera a que se asiente.
    if (temporizadorFin) return
    temporizadorFin = setTimeout(() => {
      temporizadorFin = null
      if (estaGenerando()) return
      generando = false
      avisar('completed')
    }, ESPERA_FIN_MS)
  }
}

// Dos vigilancias que se complementan: el observador reacciona al instante a
// los cambios de la página, y el intervalo cubre lo que el observador no vea
// (cambios dentro de componentes que se reescriben enteros).
const observador = new MutationObserver(revisar)
observador.observe(document.documentElement, { childList: true, subtree: true })
setInterval(revisar, INTERVALO_MS)

// Se saluda al arrancar y otra vez un poco después: ChatGPT tarda en pintar su
// interfaz, y el primer vistazo puede llegar a una página todavía vacía.
saludar()
setTimeout(saludar, 4000)

// Al cambiar de conversación, lo anterior deja de valer.
let ultimaUrl = location.href
setInterval(() => {
  if (location.href === ultimaUrl) return
  ultimaUrl = location.href
  generando = false
  ultimoEnviado = null
  if (temporizadorFin) {
    clearTimeout(temporizadorFin)
    temporizadorFin = null
  }
}, INTERVALO_MS)

revisar()
}
