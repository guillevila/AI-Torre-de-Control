/**
 * Analizador de Markdown para la respuesta del asistente (D26-bis).
 *
 * Claude escribe en Markdown: bloques de código, listas, negritas. Enseñarlo
 * como texto plano obliga a leer el ruido de los asteriscos y las comillas, y
 * pierde justo lo importante — dónde empieza y acaba el código.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEVUELVE DATOS, NUNCA HTML
 *
 * Esta función no produce ni una etiqueta. Devuelve una estructura que el
 * componente convierte en elementos de React uno a uno. Es lo que hace que un
 * mensaje que contenga `<script>` se vea COMO TEXTO en lugar de ejecutarse: no
 * hay ningún punto del camino donde una cadena se interprete como marcado.
 *
 * No es una precaución teórica: el texto viene de una conversación, y una
 * conversación puede contener cualquier cosa, incluido lo que otra persona
 * metió en un fichero del proyecto.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Es deliberadamente incompleto. Cubre lo que Claude usa a diario; lo que no
 * reconoce se enseña tal cual, que siempre es legible.
 */

export type Fragmento =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'fuerte'; texto: string }
  | { tipo: 'enfasis'; texto: string }

export type Bloque =
  | { tipo: 'codigo'; lenguaje: string | null; texto: string; abierto: boolean }
  | { tipo: 'parrafo'; partes: Fragmento[] }
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; partes: Fragmento[] }
  | { tipo: 'lista'; ordenada: boolean; puntos: Fragmento[][] }
  | { tipo: 'cita'; partes: Fragmento[] }

const VALLA = /^\s*```+\s*([\w+#.-]*)\s*$/
const TITULO = /^(#{1,3})\s+(.*)$/
const PUNTO = /^\s*[-*+]\s+(.*)$/
const NUMERO = /^\s*\d+[.)]\s+(.*)$/
const CITA = /^\s*>\s?(.*)$/

/** Trocea el texto en bloques. Nunca lanza: ante la duda, párrafo. */
export function analizarMarkdown(fuente: string): Bloque[] {
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n')
  const bloques: Bloque[] = []
  let sueltas: string[] = []

  const cerrarParrafo = (): void => {
    const texto = sueltas.join('\n').trim()
    sueltas = []
    if (texto) bloques.push({ tipo: 'parrafo', partes: analizarFragmentos(texto) })
  }

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i] ?? ''

    // ── Bloque de código ─────────────────────────────────────────────────────
    const valla = VALLA.exec(linea)
    if (valla) {
      cerrarParrafo()
      const lenguaje = valla[1] ? valla[1] : null
      const dentro: string[] = []
      let cerrado = false
      i += 1
      for (; i < lineas.length; i += 1) {
        if (VALLA.test(lineas[i] ?? '')) {
          cerrado = true
          break
        }
        dentro.push(lineas[i] ?? '')
      }
      // `abierto` importa: mientras la respuesta llega, el último bloque puede
      // no tener cierre todavía. Se enseña como código igualmente en vez de
      // desmaquetarse entero en el último instante.
      bloques.push({ tipo: 'codigo', lenguaje, texto: dentro.join('\n'), abierto: !cerrado })
      continue
    }

    // ── Título ───────────────────────────────────────────────────────────────
    const titulo = TITULO.exec(linea)
    if (titulo) {
      cerrarParrafo()
      const nivel = Math.min(3, (titulo[1] ?? '#').length) as 1 | 2 | 3
      bloques.push({ tipo: 'titulo', nivel, partes: analizarFragmentos(titulo[2] ?? '') })
      continue
    }

    // ── Lista ────────────────────────────────────────────────────────────────
    const punto = PUNTO.exec(linea)
    const numero = NUMERO.exec(linea)
    if (punto || numero) {
      cerrarParrafo()
      const ordenada = Boolean(numero)
      const puntos: Fragmento[][] = []
      for (; i < lineas.length; i += 1) {
        const actual = lineas[i] ?? ''
        const siguiente = ordenada ? NUMERO.exec(actual) : PUNTO.exec(actual)
        if (!siguiente) break
        puntos.push(analizarFragmentos(siguiente[1] ?? ''))
      }
      i -= 1
      bloques.push({ tipo: 'lista', ordenada, puntos })
      continue
    }

    // ── Cita ─────────────────────────────────────────────────────────────────
    const cita = CITA.exec(linea)
    if (cita) {
      cerrarParrafo()
      const dentro: string[] = []
      for (; i < lineas.length; i += 1) {
        const siguiente = CITA.exec(lineas[i] ?? '')
        if (!siguiente) break
        dentro.push(siguiente[1] ?? '')
      }
      i -= 1
      bloques.push({ tipo: 'cita', partes: analizarFragmentos(dentro.join('\n')) })
      continue
    }

    if (linea.trim() === '') cerrarParrafo()
    else sueltas.push(linea)
  }

  cerrarParrafo()
  return bloques
}

/**
 * Trocea una línea en fragmentos: código, negrita, cursiva y texto.
 *
 * El código va PRIMERO a propósito: dentro de comillas invertidas, un `**` es
 * parte del código y no una negrita. Al revés se destrozarían los ejemplos de
 * código, que es justo lo que más importa enseñar bien.
 */
export function analizarFragmentos(fuente: string): Fragmento[] {
  const fragmentos: Fragmento[] = []
  const patron = /(`+)([\s\S]*?)\1|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_/g
  let ultimo = 0
  let encontrado: RegExpExecArray | null

  const empujarTexto = (texto: string): void => {
    if (texto) fragmentos.push({ tipo: 'texto', texto })
  }

  while ((encontrado = patron.exec(fuente)) !== null) {
    empujarTexto(fuente.slice(ultimo, encontrado.index))
    if (encontrado[2] !== undefined) fragmentos.push({ tipo: 'codigo', texto: encontrado[2] })
    else if (encontrado[3] !== undefined) fragmentos.push({ tipo: 'fuerte', texto: encontrado[3] })
    else if (encontrado[4] !== undefined) fragmentos.push({ tipo: 'fuerte', texto: encontrado[4] })
    else if (encontrado[5] !== undefined) fragmentos.push({ tipo: 'enfasis', texto: encontrado[5] })
    else if (encontrado[6] !== undefined) fragmentos.push({ tipo: 'enfasis', texto: encontrado[6] })
    ultimo = patron.lastIndex
  }

  empujarTexto(fuente.slice(ultimo))
  return fragmentos.length > 0 ? fragmentos : [{ tipo: 'texto', texto: fuente }]
}
