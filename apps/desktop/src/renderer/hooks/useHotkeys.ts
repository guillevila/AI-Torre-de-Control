import { useEffect } from 'react'

interface Hotkeys {
  /** ⌘N o Ctrl+N — registrar una tarea desde cualquier sitio. */
  onNew: () => void
  /** Esc — cerrar la capa que esté abierta. */
  onEscape: () => void
  /** ⌘K o Ctrl+K — saltar al buscador. */
  onSearch: () => void
}

/**
 * Atajos globales.
 *
 * Registrar tiene que costar menos que recordar: un atajo, un campo, Enter.
 * Se ignoran mientras se escribe en un campo, salvo Escape.
 */
export function useHotkeys({ onNew, onEscape, onSearch }: Hotkeys): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape()
        return
      }

      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true
      if (typing) return

      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onNew()
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onSearch()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNew, onEscape, onSearch])
}
