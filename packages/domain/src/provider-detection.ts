import type { Provider } from '@torre/contracts'

/**
 * Deduce la plataforma a partir de la URL de la conversación.
 *
 * Sirve para que registrar una tarea cueste menos: pegas el enlace y la
 * plataforma se rellena sola. Es una ayuda, nunca una imposición — el usuario
 * puede cambiarla siempre, y si no se reconoce el dominio no se inventa nada.
 *
 * Función pura y sin dependencias: se prueba en milisegundos y podrá
 * reutilizarse tal cual desde la futura extensión de navegador.
 */
export function detectProvider(rawUrl: string): Provider | null {
  let host: string
  let path: string
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    path = parsed.pathname.toLowerCase()
  } catch {
    return null
  }

  // Claude: la web de conversaciones y Cowork comparten dominio, así que hay
  // que mirar la ruta para distinguirlos.
  if (host === 'claude.ai' || host.endsWith('.claude.ai')) {
    return path.startsWith('/cowork') ? 'cowork' : 'claude_web'
  }

  if (host === 'chatgpt.com' || host === 'chat.openai.com' || host.endsWith('.chatgpt.com')) {
    return 'chatgpt'
  }

  if (host === 'gemini.google.com' || host === 'aistudio.google.com') return 'gemini'

  if (host === 'github.com' && path.startsWith('/copilot')) return 'copilot'
  if (host === 'copilot.microsoft.com') return 'copilot'

  if (host.includes('codex')) return 'codex'

  return null
}
