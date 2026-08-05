import { describe, expect, it } from 'vitest'
import { posicionJuntoAlPuntero, SEPARACION, type Rectangulo } from './popup-position.js'

/**
 * La ventanita del turno (D26) tiene una obligación por encima de todas: **no
 * salirse de la pantalla**. Sin marco del sistema, una ventana medio fuera no
 * se puede ni mover ni cerrar, y encima estaría tapando trabajo. Estas pruebas
 * la empujan contra las cuatro esquinas y contra un monitor secundario.
 */

const PANTALLA: Rectangulo = { x: 0, y: 0, width: 1920, height: 1040 }
const TAMAÑO = { width: 440, height: 520 }

const dentro = (p: { x: number; y: number }, area: Rectangulo) =>
  p.x >= area.x &&
  p.y >= area.y &&
  p.x + TAMAÑO.width <= area.x + area.width &&
  p.y + TAMAÑO.height <= area.y + area.height

describe('posicionJuntoAlPuntero', () => {
  it('con sitio de sobra, sale abajo-derecha y separada del puntero', () => {
    const posicion = posicionJuntoAlPuntero({ x: 600, y: 300 }, PANTALLA, TAMAÑO)

    expect(posicion).toEqual({ x: 600 + SEPARACION, y: 300 + SEPARACION })
  })

  it('nunca aparece justo debajo del puntero', () => {
    // Si apareciera bajo el ratón, un clic que ya ibas a dar caería dentro.
    const posicion = posicionJuntoAlPuntero({ x: 600, y: 300 }, PANTALLA, TAMAÑO)

    expect(posicion.x).not.toBe(600)
    expect(posicion.y).not.toBe(300)
  })

  it('se pasa al otro lado cuando no cabe por la derecha ni por abajo', () => {
    const posicion = posicionJuntoAlPuntero({ x: 1900, y: 1030 }, PANTALLA, TAMAÑO)

    expect(posicion).toEqual({
      x: 1900 - SEPARACION - TAMAÑO.width,
      y: 1030 - SEPARACION - TAMAÑO.height,
    })
    expect(dentro(posicion, PANTALLA)).toBe(true)
  })

  it.each([
    ['esquina superior izquierda', { x: 0, y: 0 }],
    ['esquina superior derecha', { x: 1920, y: 0 }],
    ['esquina inferior izquierda', { x: 0, y: 1040 }],
    ['esquina inferior derecha', { x: 1920, y: 1040 }],
    ['centro', { x: 960, y: 520 }],
  ])('se queda dentro de la pantalla con el puntero en %s', (_caso, puntero) => {
    expect(dentro(posicionJuntoAlPuntero(puntero, PANTALLA, TAMAÑO), PANTALLA)).toBe(true)
  })

  it('respeta el área de trabajo, no la pantalla entera', () => {
    // La barra de tareas de Windows arriba: el área empieza en y=48.
    const conBarra: Rectangulo = { x: 0, y: 48, width: 1920, height: 992 }
    const posicion = posicionJuntoAlPuntero({ x: 100, y: 50 }, conBarra, TAMAÑO)

    expect(posicion.y).toBeGreaterThanOrEqual(48)
    expect(dentro(posicion, conBarra)).toBe(true)
  })

  it('funciona en un monitor a la izquierda del principal (coordenadas negativas)', () => {
    // Con dos pantallas, la secundaria puede tener x negativa. Acotar contra
    // 0 en vez de contra el borde real dejaría la ventana en el otro monitor.
    const secundaria: Rectangulo = { x: -1280, y: 0, width: 1280, height: 1024 }
    const posicion = posicionJuntoAlPuntero({ x: -1270, y: 20 }, secundaria, TAMAÑO)

    expect(posicion.x).toBeGreaterThanOrEqual(-1280)
    expect(dentro(posicion, secundaria)).toBe(true)
  })

  it('en una pantalla más pequeña que la ventana, se pega al borde en vez de salirse', () => {
    const diminuta: Rectangulo = { x: 0, y: 0, width: 300, height: 300 }
    const posicion = posicionJuntoAlPuntero({ x: 150, y: 150 }, diminuta, TAMAÑO)

    expect(posicion).toEqual({ x: 0, y: 0 })
  })

  it('devuelve coordenadas enteras', () => {
    // `setPosition` de Electron espera enteros; un decimal se redondea solo y
    // produce ventanas borrosas en pantallas con escalado.
    const posicion = posicionJuntoAlPuntero({ x: 100.4, y: 200.7 }, PANTALLA, TAMAÑO)

    expect(Number.isInteger(posicion.x)).toBe(true)
    expect(Number.isInteger(posicion.y)).toBe(true)
  })
})
