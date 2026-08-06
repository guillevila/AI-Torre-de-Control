import { useEffect, useMemo, useRef, useState } from 'react'
import type { PendingHandoff } from '@torre/contracts'

interface HandoffDialogProps {
  handoff: PendingHandoff
  /** Reloj de la aplicación, para que la cuenta atrás se vea moverse. */
  now: number
  onReply: (requestId: string, text: string) => void
  onRelease: (requestId: string) => void
}

/**
 * Lo que Claude Code acaba de contestarte, y una caja para seguir hablándole
 * sin abrir la terminal (D24).
 *
 * Tres cosas que esta ventana hace a propósito:
 *
 *  - **Enseña el texto entero.** Resumirlo sería obligarte a ir a la terminal
 *    igualmente, que es justo lo que esto viene a evitar.
 *  - **La cuenta atrás se ve.** No es un aviso que puedas mirar luego: mientras
 *    está abierta, Claude está parado esperándote. Ocultar ese coste sería
 *    mentir sobre lo que está pasando.
 *  - **Nada de esto se guarda.** Ni lo que te dijo ni lo que escribas. Cuando
 *    esta ventana se cierra, el texto deja de existir en la Torre.
 */
export function HandoffDialog({ handoff, now, onReply, onRelease }: HandoffDialogProps) {
  const [text, setText] = useState('')
  const boxRef = useRef<HTMLTextAreaElement>(null)

  // El foco entra en la caja al abrirse: si has venido a contestar, escribe.
  useEffect(() => boxRef.current?.focus(), [handoff.requestId])

  const secondsLeft = useMemo(() => {
    const left = Math.ceil((new Date(handoff.expiresAt).getTime() - now) / 1000)
    return left > 0 ? left : 0
  }, [handoff.expiresAt, now])

  // Por debajo de un cuarto de minuto el número deja de ser información y pasa
  // a ser una advertencia: si estabas escribiendo, te queda poco.
  const urgente = secondsLeft <= 15

  const enviar = () => {
    const limpio = text.trim()
    if (!limpio) return
    onReply(handoff.requestId, limpio)
  }

  return (
    <div
      className="handoff-overlay"
      data-testid="handoff-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Claude Code ha terminado su turno"
    >
      <div className="handoff">
        <header className="handoff__head">
          <div className="handoff__titles">
            <h2 className="handoff__title">{handoff.taskTitle}</h2>
            <p className="handoff__sub">
              Claude Code ha terminado su turno · contéstale desde aquí
            </p>
          </div>
          <span
            className="handoff__clock"
            data-urgent={urgente}
            data-testid="handoff-countdown"
            title="Claude está esperando tu respuesta"
          >
            {secondsLeft}s
          </span>
        </header>

        {/*
          `pre` y no `p`: una respuesta de Claude viene con saltos de línea,
          listas y a menudo código. Aplanarla la haría ilegible justo cuando lo
          que se quiere es no tener que ir a la terminal a leerla bien.
        */}
        <pre className="handoff__message" data-testid="handoff-message">
          {handoff.message}
        </pre>

        <div className="handoff__reply">
          <textarea
            ref={boxRef}
            className="handoff__box"
            data-testid="handoff-input"
            rows={3}
            value={text}
            placeholder="Escríbele y seguirá trabajando. Enter para enviar."
            aria-label="Tu respuesta para Claude Code"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter envía; Mayúsculas+Enter hace un salto de línea. Es lo que
              // hace la propia terminal, y aquí se viene con prisa.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                enviar()
              }
            }}
          />

          <div className="handoff__actions">
            <button
              type="button"
              className="btn btn--ghost"
              data-testid="handoff-release"
              onClick={() => onRelease(handoff.requestId)}
            >
              Dejar que termine
            </button>
            <button
              type="button"
              className="btn btn--primary"
              data-testid="handoff-send"
              disabled={text.trim().length === 0}
              onClick={enviar}
            >
              Responder
            </button>
          </div>
        </div>

        <p className="handoff__note">
          Esto no se guarda en ningún sitio: ni lo que te ha dicho ni lo que escribas. Si no
          contestas, el turno termina como siempre.
        </p>
      </div>
    </div>
  )
}
