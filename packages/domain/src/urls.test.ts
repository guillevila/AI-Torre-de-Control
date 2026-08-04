import { describe, expect, it } from 'vitest'
import { canonicalConversationUrl, sameConversation } from './urls.js'

const CHAT = 'https://chatgpt.com/c/abc-123'

describe('la misma conversación, escrita de varias formas', () => {
  it('la barra final no la cambia', () => {
    expect(sameConversation(CHAT, `${CHAT}/`)).toBe(true)
  })

  it('el fragmento tras la almohadilla tampoco', () => {
    expect(sameConversation(CHAT, `${CHAT}#mensaje-4`)).toBe(true)
  })

  it('ni el servidor en mayúsculas', () => {
    expect(sameConversation(CHAT, 'https://ChatGPT.com/c/abc-123')).toBe(true)
  })

  it('las dos cosas a la vez', () => {
    expect(sameConversation(CHAT, `${CHAT}/#arriba`)).toBe(true)
  })
})

describe('conversaciones distintas siguen siendo distintas', () => {
  it('otra conversación del mismo sitio', () => {
    expect(sameConversation(CHAT, 'https://chatgpt.com/c/otra')).toBe(false)
  })

  it('los parámetros SÍ distinguen', () => {
    // Hay herramientas que identifican la conversación ahí. Unirlas sería peor
    // que separarlas: acabarías moviendo el estado de la tarea equivocada.
    expect(sameConversation('https://una.test/chat?id=1', 'https://una.test/chat?id=2')).toBe(false)
  })

  it('la ruta distingue mayúsculas, porque hay sitios donde importan', () => {
    expect(sameConversation('https://una.test/C/Abc', 'https://una.test/c/abc')).toBe(false)
  })

  it('el mismo camino en otro servidor no es lo mismo', () => {
    expect(sameConversation(CHAT, 'https://otra.test/c/abc-123')).toBe(false)
  })
})

describe('nada que comparar', () => {
  it('sin dirección, no hay coincidencia', () => {
    expect(sameConversation(null, CHAT)).toBe(false)
    expect(sameConversation(CHAT, null)).toBe(false)
    expect(sameConversation(undefined, undefined)).toBe(false)
    expect(sameConversation('', CHAT)).toBe(false)
  })

  it('lo que no es una dirección se compara tal cual, sin reventar', () => {
    expect(canonicalConversationUrl('no soy una url')).toBe('no soy una url')
    expect(sameConversation('no soy una url', 'no soy una url')).toBe(true)
    expect(sameConversation('no soy una url', 'otra cosa')).toBe(false)
  })

  it('tolera espacios alrededor', () => {
    expect(sameConversation(`  ${CHAT}  `, CHAT)).toBe(true)
  })
})
