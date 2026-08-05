import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { posicionJuntoAlPuntero } from './popup-position.js'

const ANCHO = 440
const ALTO = 520

/**
 * La ventanita que te sale al paso cuando una conversación termina su turno
 * (D26).
 *
 * El dueño trabaja en sus repos y abre las conversaciones desde ahí, como
 * siempre. Lo que le faltaba era el camino de vuelta: enterarse y **contestar**
 * sin ir a buscar ni la ventana de VSCode ni la propia Torre. Por eso esta
 * ventana:
 *
 *  - aparece **junto al puntero**, que es el único sitio de la pantalla donde
 *    se sabe seguro que está mirando;
 *  - se pone **encima de todo**, incluso de una aplicación a pantalla completa;
 *  - **no roba el foco** (`showInactive`), para no tragarse lo que estuviera
 *    tecleando en otro sitio. Un clic y ya escribe en ella.
 *
 * No tiene estado propio: enseña los mismos turnos que la Torre, leídos del
 * mismo sitio. Cerrarla no descarta nada.
 */
export class TurnPopup {
  private ventana: BrowserWindow | null = null

  /**
   * Enseña la ventanita junto al puntero. Si ya estaba abierta **no la
   * recoloca**: moverla bajo el ratón mientras el dueño escribe en ella sería
   * exactamente lo contrario de lo que se busca.
   */
  show(): void {
    if (this.ventana && !this.ventana.isDestroyed()) {
      if (!this.ventana.isVisible()) {
        this.colocar(this.ventana)
        this.ventana.showInactive()
      }
      return
    }

    const ventana = this.crear()
    this.ventana = ventana
    ventana.once('ready-to-show', () => {
      if (ventana.isDestroyed()) return
      this.colocar(ventana)
      // Visible pero inactiva: sale al paso sin interrumpir lo que se escribe.
      ventana.showInactive()
    })
  }

  /** La esconde. No descarta ningún turno: es un «ahora no». */
  hide(): void {
    if (this.ventana && !this.ventana.isDestroyed()) this.ventana.hide()
  }

  /**
   * Le pasa a la ventanita el mismo aviso que recibe la Torre.
   *
   * No hay una segunda fuente de verdad: las dos ventanas escuchan la misma
   * lista de turnos del proceso principal.
   */
  send(channel: string, payload: unknown): void {
    if (this.ventana && !this.ventana.isDestroyed()) {
      this.ventana.webContents.send(channel, payload)
    }
  }

  isVisible(): boolean {
    return Boolean(this.ventana && !this.ventana.isDestroyed() && this.ventana.isVisible())
  }

  /** Al cerrar la aplicación. Que no quede una ventana suelta manteniéndola viva. */
  destroy(): void {
    if (this.ventana && !this.ventana.isDestroyed()) this.ventana.destroy()
    this.ventana = null
  }

  private crear(): BrowserWindow {
    const ventana = new BrowserWindow({
      width: ANCHO,
      height: ALTO,
      minWidth: 360,
      minHeight: 300,
      show: false,
      frame: false,
      // Fuera de la barra de tareas y del Alt+Tab: es un aviso, no una ventana
      // más que gestionar.
      skipTaskbar: true,
      alwaysOnTop: true,
      // No entra en la lista de ventanas del sistema al hacer capturas ni
      // aparece al minimizar todo.
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      backgroundColor: '#F5F1EA',
      title: 'Torre de Control · turno',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        // Las mismas tres líneas que la ventana principal: la interfaz no toca
        // el sistema, ni siquiera en una ventana auxiliar.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // IMPRESCINDIBLE aquí. Electron ralentiza el refresco de las ventanas
        // que no tienen el foco, y esta nace SIN foco a propósito: con el
        // estrangulamiento puesto, la cuenta atrás se congelaría y la ventanita
        // parecería muerta hasta que la pincharas. Es decir, justo lo contrario
        // de lo que tiene que hacer un aviso.
        backgroundThrottling: false,
      },
    })

    // `screen-saver` es el nivel que además queda por encima de aplicaciones a
    // pantalla completa. Sin esto, el aviso se perdería justo cuando más falta
    // hace: programando a pantalla completa.
    ventana.setAlwaysOnTop(true, 'screen-saver')
    ventana.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Se esconde en vez de destruirse: reaparecer es instantáneo y no se pierde
    // lo que hubiera escrito a medias en el cuadro de respuesta.
    ventana.on('close', (evento) => {
      if (ventana.isDestroyed()) return
      evento.preventDefault()
      ventana.hide()
    })

    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) void ventana.loadURL(`${rendererUrl}?ventana=aviso`)
    else void ventana.loadFile(join(__dirname, '../renderer/index.html'), { query: { ventana: 'aviso' } })

    return ventana
  }

  private colocar(ventana: BrowserWindow): void {
    try {
      const puntero = screen.getCursorScreenPoint()
      // El área de trabajo de LA pantalla donde está el ratón, no la principal:
      // con dos monitores, el aviso sale en el que estás mirando.
      const { workArea } = screen.getDisplayNearestPoint(puntero)
      const { x, y } = posicionJuntoAlPuntero(puntero, workArea, { width: ANCHO, height: ALTO })
      ventana.setPosition(x, y)
    } catch {
      // Si el sistema no da la posición del puntero, la ventana sale donde
      // Electron decida. Preferible a no avisar.
    }
  }
}
