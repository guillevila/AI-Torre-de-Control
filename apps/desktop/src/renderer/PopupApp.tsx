import { useEffect, useState } from 'react'
import { folderName } from '@torre/domain'
import { TurnCard } from './components/TurnCard.js'
import { useTurns } from './hooks/useTurns.js'

/**
 * La ventanita que sale junto al puntero cuando una conversación termina su
 * turno (D26).
 *
 * Es la MISMA interfaz de la Torre, no una copia: reutiliza `useTurns` y
 * `TurnCard`, así que lo que se responde aquí y lo que se responde en la
 * ventana grande recorren exactamente el mismo camino. Si un día cambia la
 * tarjeta, cambia en los dos sitios a la vez.
 *
 * Enseña **una** tarjeta —la más reciente— aunque haya varias pendientes. Una
 * ventanita emergente con una lista dejaría de ser un aviso para convertirse en
 * otro panel que gestionar; el resto sigue esperando en la Torre, y aquí se
 * dice cuántas quedan.
 */
export function PopupApp() {
  const { pending, decide, error, clearError } = useTurns()
  const [now, setNow] = useState(() => Date.now())

  // El reloj solo corre mientras alguna tarjeta sigue sostenida: cuando todas
  // están en reposo no hay cuenta atrás que refrescar.
  const hayCuentaAtras = pending.some((turn) => turn.holdUntil !== null)
  useEffect(() => {
    if (!hayCuentaAtras) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hayCuentaAtras])

  // Sin nada que enseñar la ventana se esconde sola. Así, al responder o dar
  // por vista la última tarjeta, desaparece sin tener que cerrarla a mano.
  useEffect(() => {
    if (pending.length === 0) void window.torre.hideTurnPopup()
  }, [pending.length])

  const turno = pending[pending.length - 1]
  const restantes = pending.length - 1

  return (
    <div className="popup">
      <header className="popup__bar">
        <span className="popup__repo" title={turno?.cwd ?? ''}>
          {turno ? folderName(turno.cwd) : 'Torre de Control'}
        </span>
        {restantes > 0 ? (
          <span className="popup__more" title="Las demás te esperan en la Torre">
            +{restantes} más
          </span>
        ) : null}
        <button
          type="button"
          className="popup__close"
          data-testid="popup-close"
          title="Ahora no. La tarjeta sigue esperándote en la Torre."
          onClick={() => void window.torre.hideTurnPopup()}
        >
          ✕
        </button>
      </header>

      {error ? (
        <p className="popup__error" role="alert" onClick={clearError}>
          {error}
        </p>
      ) : null}

      <main className="popup__body">
        {turno ? (
          <TurnCard
            turn={turno}
            now={now}
            onDecide={(requestId, action, text) => {
              void decide(requestId, action, text)
            }}
          />
        ) : (
          <p className="popup__empty">No hay ningún turno esperando.</p>
        )}
      </main>
    </div>
  )
}
