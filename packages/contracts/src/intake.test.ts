import { describe, expect, it } from 'vitest'
import { taskIntakeSchema } from './intake.js'

const valida = {
  title: 'Presupuesto obra Sagasta — ChatGPT',
  externalUrl: 'https://chatgpt.com/c/abc-123',
}

describe('alta de una tarea desde el navegador', () => {
  it('acepta un título y un enlace', () => {
    expect(taskIntakeSchema.safeParse(valida).success).toBe(true)
  })

  it('recorta los espacios del título', () => {
    const parsed = taskIntakeSchema.parse({ ...valida, title: '   Informe   ' })
    expect(parsed.title).toBe('Informe')
  })
})

/**
 * La promesa del producto, escrita como prueba.
 *
 * Esta aplicación no guarda el contenido de las conversaciones. La forma de que
 * eso siga siendo cierto dentro de un año no es acordarse: es que el contrato
 * rechace de plano cualquier intento de colarlo.
 */
describe('no cabe el contenido de la conversación', () => {
  const intentos: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['el texto que preguntaste', { prompt: '¿cuánto cuesta una obra de 200 m²?' }],
    ['lo que te contestaron', { response: 'Depende de los acabados…' }],
    ['la conversación entera', { messages: [{ role: 'user', content: 'hola' }] }],
    ['una transcripción', { transcript: 'usuario: hola\nasistente: buenas' }],
    ['notas libres', { notes: 'lo que sea' }],
    ['un resumen', { summary: 'hablamos de precios' }],
  ]

  for (const [descripcion, extra] of intentos) {
    it(`rechaza la petición ENTERA si trae ${descripcion}`, () => {
      const resultado = taskIntakeSchema.safeParse({ ...valida, ...extra })
      expect(resultado.success).toBe(false)
    })
  }

  it('el rechazo es completo, no un filtrado silencioso', () => {
    // Importa la diferencia: filtrar en silencio dejaría creer que se envió algo
    // que no se envió. Rechazar deja el fallo a la vista de quien lo provocó.
    const resultado = taskIntakeSchema.safeParse({ ...valida, prompt: 'texto' })
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(JSON.stringify(resultado.error.issues)).toContain('prompt')
    }
  })
})

describe('la plataforma no se acepta de fuera', () => {
  it('rechaza que quien envía diga qué plataforma es', () => {
    // Se deduce del enlace en la Torre. Si viniera de fuera, cualquiera podría
    // decir que su página es ChatGPT.
    expect(taskIntakeSchema.safeParse({ ...valida, provider: 'chatgpt' }).success).toBe(false)
  })
})

describe('enlaces', () => {
  it('rechaza esquemas peligrosos', () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///C:/Windows/System32',
      'data:text/html,<script>alert(1)</script>',
    ]) {
      expect(taskIntakeSchema.safeParse({ ...valida, externalUrl: url }).success).toBe(false)
    }
  })

  it('exige un enlace: sin él no se puede volver a la conversación', () => {
    expect(taskIntakeSchema.safeParse({ title: 'Algo' }).success).toBe(false)
    expect(taskIntakeSchema.safeParse({ ...valida, externalUrl: '' }).success).toBe(false)
  })
})

describe('límites', () => {
  it('rechaza un título vacío', () => {
    expect(taskIntakeSchema.safeParse({ ...valida, title: '   ' }).success).toBe(false)
  })

  it('rechaza un título desmedido', () => {
    expect(taskIntakeSchema.safeParse({ ...valida, title: 'x'.repeat(201) }).success).toBe(false)
  })

  it('rechaza un enlace desmedido', () => {
    const largo = `https://chatgpt.com/c/${'x'.repeat(2100)}`
    expect(taskIntakeSchema.safeParse({ ...valida, externalUrl: largo }).success).toBe(false)
  })
})
