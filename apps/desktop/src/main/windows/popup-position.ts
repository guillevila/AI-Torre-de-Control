/**
 * Dónde colocar la ventanita del turno respecto al puntero (D26).
 *
 * Vive aparte de Electron a propósito: es aritmética pura, así que se puede
 * probar de verdad —con puntero en esquinas, pantallas pequeñas, monitores a la
 * izquierda del principal (coordenadas negativas)— sin abrir ninguna ventana.
 */

export interface Rectangulo {
  x: number
  y: number
  width: number
  height: number
}

export interface Punto {
  x: number
  y: number
}

/**
 * Cuánto se separa la ventana del puntero.
 *
 * No es estética: si apareciera justo debajo del ratón, un clic que ya ibas a
 * dar caería dentro de ella. Se desplaza abajo-derecha, que es hacia donde
 * suele haber sitio y hacia donde no se mira al hacer clic.
 */
export const SEPARACION = 18

/**
 * Coloca un rectángulo de `tamaño` junto a `puntero`, siempre **dentro** del
 * área utilizable de la pantalla (`area`, que ya excluye la barra de tareas).
 *
 * Si no cabe abajo-derecha se prueba al otro lado, y si tampoco —pantalla
 * pequeña— se pega al borde. Nunca devuelve una posición fuera del área: una
 * ventana sin marco medio salida de la pantalla es una ventana que no se puede
 * ni mover ni cerrar.
 */
export function posicionJuntoAlPuntero(
  puntero: Punto,
  area: Rectangulo,
  tamaño: { width: number; height: number },
): Punto {
  const derechaX = puntero.x + SEPARACION
  const izquierdaX = puntero.x - SEPARACION - tamaño.width
  const abajoY = puntero.y + SEPARACION
  const arribaY = puntero.y - SEPARACION - tamaño.height

  // Se prefiere abajo-derecha; se cambia de lado solo si por ese lado se sale.
  const cabeDerecha = derechaX + tamaño.width <= area.x + area.width
  const cabeAbajo = abajoY + tamaño.height <= area.y + area.height

  const x = cabeDerecha ? derechaX : izquierdaX
  const y = cabeAbajo ? abajoY : arribaY

  return {
    x: acotar(x, area.x, area.x + area.width - tamaño.width),
    y: acotar(y, area.y, area.y + area.height - tamaño.height),
  }
}

/**
 * Encaja un valor entre dos límites.
 *
 * `minimo` gana si el área es más pequeña que la ventana (pantallas diminutas o
 * escalados raros): antes pegada al borde superior-izquierdo, donde se ve y se
 * puede cerrar, que centrada fuera de la pantalla.
 */
function acotar(valor: number, minimo: number, maximo: number): number {
  if (maximo < minimo) return minimo
  return Math.round(Math.min(Math.max(valor, minimo), maximo))
}
