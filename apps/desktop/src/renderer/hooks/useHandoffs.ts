import { useCallback, useEffect, useState } from 'react'
import type { PendingHandoff } from '@torre/contracts'

/**
 * Finales de turno que esperan tu respuesta (D24).
 *
 * No se guardan en ningún sitio: esta lista es un reflejo de lo que el proceso
 * principal tiene en memoria. Si cierras la aplicación desaparece, y el turno
 * de Claude Code termina con normalidad.
 *
 * Lo que llega aquí es literalmente lo que Claude te ha contestado. Se enseña y
 * no se escribe: ni base de datos, ni historial, ni CSV.
 */
export function useHandoffs() {
  const [pending, setPending] = useState<PendingHandoff[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void window.torre.listHandoffs().then((result) => {
      if (alive && result.ok) setPending(result.data)
    })

    const unsubscribe = window.torre.onHandoffsChanged((next) => {
      if (alive) setPending(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const reply = useCallback(async (requestId: string, text: string) => {
    const result = await window.torre.replyHandoff(requestId, text)
    if (!result.ok) {
      // El error importa de verdad aquí: si esto falla, se ha perdido algo que
      // una persona acababa de escribir. Se enseña, no se traga.
      setError(result.error)
      return false
    }
    setError(null)
    return true
  }, [])

  const release = useCallback(async (requestId: string) => {
    await window.torre.releaseHandoff(requestId)
  }, [])

  return { pending, reply, release, error, clearError: useCallback(() => setError(null), []) }
}
