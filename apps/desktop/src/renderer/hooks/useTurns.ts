import { useCallback, useEffect, useState } from 'react'
import type { PendingTurn } from '@torre/contracts'

/**
 * Turnos terminados que esperan tu respuesta desde la Torre (D25).
 *
 * Como los permisos: reflejo de la memoria del proceso principal, nada en
 * disco (D5-ter). Si cierras la aplicación, el turno termina como siempre.
 */
export function useTurns() {
  const [pending, setPending] = useState<PendingTurn[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void window.torre.listTurns().then((result) => {
      if (alive && result.ok) setPending(result.data)
    })

    const unsubscribe = window.torre.onTurnsChanged((next) => {
      if (alive) setPending(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const decide = useCallback(async (requestId: string, action: 'reply' | 'pass', text?: string) => {
    const result = await window.torre.decideTurn(requestId, action, text)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setError(null)
    return true
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { pending, decide, error, clearError }
}
