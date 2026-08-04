/**
 * Genera los iconos de la extensión.
 *
 * Existe para que los iconos no sean tres ficheros binarios llegados de ningún
 * sitio: se pueden regenerar, y se ve exactamente qué dibujan. Chrome exige PNG
 * para el icono de la barra, así que se escribe un PNG a mano —cabecera, datos
 * comprimidos y cierre— con lo que trae Node y nada más.
 *
 * El dibujo es el mismo muñeco de la oficina: cabeza y cuerpo sobre el azul
 * petróleo de mando. A 16 px no se lee el detalle, pero sí la silueta.
 *
 *   node apps/extension/scripts/generar-iconos.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DESTINO = join(dirname(fileURLToPath(import.meta.url)), '..', 'iconos')
const TAMAÑOS = [16, 48, 128]

/** Azul petróleo de mando y crema del papel: los mismos que la aplicación. */
const FONDO = [31, 74, 95]
const FIGURA = [245, 241, 234]

const tabla = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = tabla[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, datos) {
  const longitud = Buffer.alloc(4)
  longitud.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([longitud, cuerpo, crc])
}

/** Suaviza el borde de una forma promediando varias muestras por píxel. */
function cobertura(x, y, dentro) {
  const MUESTRAS = 4
  let sumas = 0
  for (let sy = 0; sy < MUESTRAS; sy += 1) {
    for (let sx = 0; sx < MUESTRAS; sx += 1) {
      if (dentro(x + (sx + 0.5) / MUESTRAS, y + (sy + 0.5) / MUESTRAS)) sumas += 1
    }
  }
  return sumas / (MUESTRAS * MUESTRAS)
}

function mezclar(fondo, frente, alfa) {
  return fondo.map((canal, i) => Math.round(canal * (1 - alfa) + frente[i] * alfa))
}

function dibujar(tamaño) {
  const s = tamaño
  const radio = s * 0.22

  // Cuadrado redondeado que hace de fondo.
  const enFondo = (x, y) => {
    const dx = Math.max(radio - x, 0, x - (s - radio))
    const dy = Math.max(radio - y, 0, y - (s - radio))
    return dx * dx + dy * dy <= radio * radio
  }

  // Cabeza: círculo centrado en el tercio superior.
  const cabezaR = s * 0.15
  const cabezaY = s * 0.34
  const enCabeza = (x, y) => (x - s / 2) ** 2 + (y - cabezaY) ** 2 <= cabezaR * cabezaR

  // Cuerpo: rectángulo redondeado por arriba, bajo la cabeza.
  const cuerpoAncho = s * 0.42
  const cuerpoArriba = s * 0.55
  const cuerpoAbajo = s * 0.8
  const cuerpoR = cuerpoAncho / 2
  const enCuerpo = (x, y) => {
    if (y > cuerpoAbajo || y < cuerpoArriba) return false
    const izq = (s - cuerpoAncho) / 2
    const der = izq + cuerpoAncho
    if (x < izq || x > der) return false
    // Hombros redondeados.
    if (y < cuerpoArriba + cuerpoR) {
      const cy = cuerpoArriba + cuerpoR
      return (x - s / 2) ** 2 + (y - cy) ** 2 <= cuerpoR * cuerpoR
    }
    return true
  }

  const filas = []
  for (let y = 0; y < s; y += 1) {
    // Byte de filtro «ninguno» al principio de cada línea.
    const fila = Buffer.alloc(1 + s * 4)
    for (let x = 0; x < s; x += 1) {
      const alfaFondo = cobertura(x, y, enFondo)
      const alfaFigura = Math.min(
        1,
        cobertura(x, y, enCabeza) + cobertura(x, y, enCuerpo),
      )

      const color = mezclar(FONDO, FIGURA, alfaFigura)
      const posicion = 1 + x * 4
      fila[posicion] = color[0]
      fila[posicion + 1] = color[1]
      fila[posicion + 2] = color[2]
      fila[posicion + 3] = Math.round(alfaFondo * 255)
    }
    filas.push(fila)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(s, 0)
  ihdr.writeUInt32BE(s, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // color con transparencia (RGBA)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(DESTINO, { recursive: true })
for (const tamaño of TAMAÑOS) {
  const ruta = join(DESTINO, `${tamaño}.png`)
  writeFileSync(ruta, dibujar(tamaño))
  console.log(`  ${tamaño}×${tamaño} → ${ruta}`)
}
console.log('\nIconos generados.')
