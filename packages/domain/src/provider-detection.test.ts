import { describe, expect, it } from 'vitest'
import { detectProvider } from './provider-detection.js'

describe('detectar la plataforma desde la URL', () => {
  it('reconoce ChatGPT', () => {
    expect(detectProvider('https://chatgpt.com/c/abc-123')).toBe('chatgpt')
    expect(detectProvider('https://chat.openai.com/c/abc')).toBe('chatgpt')
    expect(detectProvider('https://www.chatgpt.com/c/abc')).toBe('chatgpt')
  })

  it('distingue Claude web de Cowork por la ruta', () => {
    expect(detectProvider('https://claude.ai/chat/abc')).toBe('claude_web')
    expect(detectProvider('https://claude.ai/cowork/proyecto')).toBe('cowork')
  })

  it('reconoce Gemini y Copilot', () => {
    expect(detectProvider('https://gemini.google.com/app/xyz')).toBe('gemini')
    expect(detectProvider('https://github.com/copilot/c/1')).toBe('copilot')
    expect(detectProvider('https://copilot.microsoft.com/')).toBe('copilot')
  })

  it('no inventa nada si no reconoce el dominio', () => {
    expect(detectProvider('https://example.test/lo-que-sea')).toBeNull()
    expect(detectProvider('https://github.com/guillevila/repo')).toBeNull()
  })

  it('rechaza lo que no es una URL http o https', () => {
    expect(detectProvider('javascript:alert(1)')).toBeNull()
    expect(detectProvider('file:///C:/Windows')).toBeNull()
    expect(detectProvider('no soy una url')).toBeNull()
    expect(detectProvider('')).toBeNull()
  })

  it('tolera espacios alrededor', () => {
    expect(detectProvider('  https://chatgpt.com/c/1  ')).toBe('chatgpt')
  })
})
