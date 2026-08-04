import { useCallback, useEffect, useState } from 'react'
import type { PendingPermission, PermissionDecision } from '@torre/contracts'

/**
 * Permisos que ahora mismo esperan una decisión tuya (D18-bis).
 *
 * No se guardan en ningún sitio (D20): esta lista es un reflejo de lo que el
 * proceso principal tiene en memoria. Si cierras la aplicación, desaparece —y
 * la herramienta que preguntaba vuelve a preguntar por su cuenta.
 */
export function usePermissions() {
  const [pending, setPending] = useState<PendingPermission[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void window.torre.listPermissions().then((result) => {
      if (alive && result.ok) setPending(result.data)
    })

    const unsubscribe = window.torre.onPermissionsChanged((next) => {
      if (alive) setPending(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const decide = useCallback(async (requestId: string, decision: PermissionDecision) => {
    const result = await window.torre.decidePermission(requestId, decision)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setError(null)
    return true
  }, [])

  return { pending, decide, error, clearError: useCallback(() => setError(null), []) }
}
