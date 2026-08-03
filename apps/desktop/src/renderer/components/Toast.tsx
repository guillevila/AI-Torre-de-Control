import { useEffect } from 'react'

interface ToastProps {
  message: string
  tone?: 'neutral' | 'error'
  onDismiss: () => void
}

/**
 * Aviso breve al pie de la pantalla.
 *
 * Se usa para confirmar acciones que no dejan rastro visible (exportar, copiar)
 * y para los errores que no pertenecen a ningún campo concreto. Nunca sustituye
 * a un mensaje junto al control que falló.
 */
export function Toast({ message, tone = 'neutral', onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, tone === 'error' ? 9000 : 5000)
    return () => clearTimeout(timer)
  }, [message, tone, onDismiss])

  return (
    <div className="toast" data-tone={tone} role="status" data-testid="toast">
      <span>{message}</span>
      <button type="button" className="toast__close" onClick={onDismiss}>
        Cerrar
      </button>
    </div>
  )
}
