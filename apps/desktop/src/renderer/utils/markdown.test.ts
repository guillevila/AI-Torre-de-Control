import { describe, expect, it } from 'vitest'
import { analizarFragmentos, analizarMarkdown } from './markdown.js'

/**
 * El analizador de la respuesta del asistente (D26-bis).
 *
 * Lo que más se vigila aquí no es que quede bonito, sino dos cosas que sí
 * pueden hacer daño: que **nunca** salga marcado ejecutable, y que un bloque de
 * código llegue entero y sin tocar — copiar un comando mal recortado es peor
 * que no poder copiarlo.
 */

describe('bloques de código', () => {
  it('reconoce el bloque y guarda el lenguaje', () => {
    const [bloque] = analizarMarkdown('```ts\nconst a = 1\n```')

    expect(bloque).toEqual({ tipo: 'codigo', lenguaje: 'ts', texto: 'const a = 1', abierto: false })
  })

  it('deja el código intacto: ni recorta, ni interpreta lo de dentro', () => {
    // Dentro del código, `**esto**` es código, no una negrita.
    const fuente = '```\n  if (a && b) { **x** }\n\n  return `${y}`\n```'
    const [bloque] = analizarMarkdown(fuente)

    expect(bloque).toMatchObject({
      tipo: 'codigo',
      texto: '  if (a && b) { **x** }\n\n  return `${y}`',
    })
  })

  it('un bloque sin cerrar sigue siendo código', () => {
    // Pasa de verdad: la respuesta puede llegar cortada por el límite de 4000
    // caracteres. Desmaquetar todo el final sería lo peor posible.
    const [bloque] = analizarMarkdown('```py\nprint("hola")')

    expect(bloque).toMatchObject({ tipo: 'codigo', lenguaje: 'py', abierto: true })
  })

  it('sin lenguaje declarado lo deja en nulo', () => {
    expect(analizarMarkdown('```\nx\n```')[0]).toMatchObject({ lenguaje: null })
  })
})

describe('nada de lo que llega se interpreta como marcado', () => {
  it('el HTML de la respuesta viaja como TEXTO', () => {
    const bloques = analizarMarkdown('Mira esto: <script>alert(1)</script> y ya')

    // Sale en un fragmento de texto; el componente lo pinta con React, así que
    // no hay forma de que llegue a ejecutarse.
    const plano = JSON.stringify(bloques)
    expect(plano).toContain('<script>alert(1)</script>')
    expect(bloques[0]?.tipo).toBe('parrafo')
  })

  it('devuelve datos, nunca cadenas de marcado', () => {
    for (const bloque of analizarMarkdown('# T\n\n- uno\n\n> cita\n\n```\nx\n```')) {
      expect(['codigo', 'parrafo', 'titulo', 'lista', 'cita']).toContain(bloque.tipo)
    }
  })
})

describe('fragmentos en línea', () => {
  it('el código gana a la negrita', () => {
    expect(analizarFragmentos('usa `a ** b` aquí')).toEqual([
      { tipo: 'texto', texto: 'usa ' },
      { tipo: 'codigo', texto: 'a ** b' },
      { tipo: 'texto', texto: ' aquí' },
    ])
  })

  it('reconoce negrita y cursiva', () => {
    expect(analizarFragmentos('**fuerte** y *suave*')).toEqual([
      { tipo: 'fuerte', texto: 'fuerte' },
      { tipo: 'texto', texto: ' y ' },
      { tipo: 'enfasis', texto: 'suave' },
    ])
  })

  it('un asterisco suelto no rompe nada', () => {
    expect(analizarFragmentos('2 * 3 = 6')).toEqual([{ tipo: 'texto', texto: '2 * 3 = 6' }])
  })
})

describe('el resto de bloques', () => {
  it('títulos, listas y citas', () => {
    const bloques = analizarMarkdown('## Cambios\n\n- uno\n- dos\n\n> ojo con esto')

    expect(bloques[0]).toMatchObject({ tipo: 'titulo', nivel: 2 })
    expect(bloques[1]).toMatchObject({ tipo: 'lista', ordenada: false })
    expect((bloques[1] as { puntos: unknown[] }).puntos).toHaveLength(2)
    expect(bloques[2]).toMatchObject({ tipo: 'cita' })
  })

  it('distingue la lista numerada', () => {
    expect(analizarMarkdown('1. uno\n2. dos')[0]).toMatchObject({ tipo: 'lista', ordenada: true })
  })

  it('un texto normal es un solo párrafo', () => {
    const bloques = analizarMarkdown('He migrado la tabla.\n¿Sigo con la siguiente?')

    expect(bloques).toHaveLength(1)
    expect(bloques[0]?.tipo).toBe('parrafo')
  })

  it('no se atraganta con texto vacío', () => {
    expect(analizarMarkdown('')).toEqual([])
    expect(analizarMarkdown('\n\n  \n')).toEqual([])
  })
})
