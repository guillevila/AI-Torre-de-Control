import { useState } from 'react'
import type { PendingTurn } from '@torre/contracts'

interface TurnCardProps {
  turn: PendingTurn
  now: number
  onDecide: (requestId: string, action: 'reply' | 'review', text?: string) => void
}

/**
 * La tarjeta de fin de turno (D25): la respuesta del asistente y un sitio donde
 * contestar sin buscar la ventana.
 *
 * Lo que se enseña aquí NO está guardado en ningún sitio (D5-ter): vive en la
 * memoria del proceso principal y desaparece al decidir o al cerrar la Torre.
 * «Cerrar» no descarta nada: el turno termina como siempre y la entrega queda
 * en la mesa.
 */
export function TurnCard({ turn, now, onDecide }: TurnCardProps) {
  const [texto, setTexto] = useState('')
  // Con `holdUntil` la sesión sigue sostenida (respuesta por la misma sesión);
  // sin él, la tarjeta espera SIN caducidad y responder relanza la conversación.
  const sostenida = turn.holdUntil !== null && Date.parse(turn.holdUntil) - now > 0
  const restante = turn.holdUntil ? Math.max(0, Math.round((Date.parse(turn.holdUntil) - now) / 1000)) : null

  const responder = () => {
    const limpio = texto.trim()
    if (!limpio) return
    onDecide(turn.requestId, 'reply', limpio)
  }

  return (
    <article className="permission turn" data-testid="turn-card">
      <header className="permission__head">
        <span className="permission__glyph" aria-hidden="true">
          ✉
        </span>
        <div className="permission__titles">
          <p className="permission__title">
            Turno terminado · <strong>{turn.sessionTitle ?? turn.taskTitle}</strong>
          </p>
          <p className="permission__task">{turn.taskTitle}</p>
        </div>
        {sostenida && restante !== null ? (
          <span
            className="permission__countdown mono"
            data-expiring={restante <= 10}
            title="Segundos en los que la respuesta entra por la misma sesión"
          >
            {restante}s
          </span>
        ) : (
          <span className="permission__countdown mono" title="El turno terminó; responder retoma la conversación">
            ⏸
          </span>
        )}
      </header>

      <pre className="permission__detail mono turn__output" data-testid="turn-output">
        {turn.output || '(no se pudo leer la respuesta de este turno; está en su ventana)'}
      </pre>

      <textarea
        className="input turn__reply"
        data-testid="turn-reply"
        placeholder="Tu respuesta… (se envía a la conversación y esta continúa)"
        value={texto}
        rows={3}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) responder()
        }}
      />

      <footer className="permission__actions">
        <button
          type="button"
          className="btn"
          data-testid="turn-review"
          title="La tarea pasa a «revisada»; podrás retomarla desde su ficha"
          onClick={() => onDecide(turn.requestId, 'review')}
        >
          Dar por vista
        </button>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="turn-send"
          disabled={texto.trim() === ''}
          onClick={responder}
        >
          Responder
        </button>
      </footer>
    </article>
  )
}
