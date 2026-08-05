import { useState } from 'react'
import type { PendingTurn } from '@torre/contracts'

interface TurnCardProps {
  turn: PendingTurn
  now: number
  onDecide: (requestId: string, action: 'reply' | 'pass', text?: string) => void
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
  const restante = Math.max(0, Math.round((Date.parse(turn.expiresAt) - now) / 1000))

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
        <span
          className="permission__countdown mono"
          data-expiring={restante <= 10}
          title="Segundos para contestar desde aquí"
        >
          {restante}s
        </span>
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
          data-testid="turn-pass"
          onClick={() => onDecide(turn.requestId, 'pass')}
        >
          Cerrar
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
