import type { PendingPermission, PermissionDecision } from '@torre/contracts'

interface PermissionCardProps {
  permission: PendingPermission
  onDecide: (requestId: string, decision: PermissionDecision) => void
  /** Marca de tiempo actual, para que la cuenta atrás avance sola. */
  now: number
}

/**
 * Una herramienta se ha parado a pedir permiso y espera tu decisión.
 *
 * Enseña **el comando entero**, sin recortar. Aprobar un resumen sería peor que
 * no aprobar nada: es la única forma de que el clic signifique algo (ADR-007).
 *
 * La cuenta atrás no es decoración. Avisa de que, si no decides, la herramienta
 * dejará de esperar y te preguntará en su terminal como siempre (D21). No se
 * pierde nada por ignorarla.
 */
export function PermissionCard({ permission, onDecide, now }: PermissionCardProps) {
  const secondsLeft = Math.max(
    0,
    Math.round((Date.parse(permission.expiresAt) - now) / 1000),
  )
  const expiring = secondsLeft <= 15

  return (
    <article className="permission" data-testid="permission-card" data-request-id={permission.requestId}>
      <header className="permission__head">
        <span className="permission__glyph" aria-hidden="true">
          ▲
        </span>
        <div className="permission__titles">
          <h3 className="permission__title">
            Pide permiso para <strong>{permission.toolName}</strong>
          </h3>
          <p className="permission__task">{permission.taskTitle}</p>
        </div>
        <span
          className="permission__countdown mono"
          data-expiring={expiring}
          title="Si no decides, la herramienta te preguntará en su terminal"
        >
          {secondsLeft}s
        </span>
      </header>

      {/* Íntegro y sin recortar: es lo que hace que aprobar signifique algo. */}
      <pre className="permission__detail mono" data-testid="permission-detail">
        {permission.detail}
      </pre>

      <footer className="permission__actions">
        <button
          type="button"
          className="btn btn--danger"
          data-testid="permission-deny"
          onClick={() => onDecide(permission.requestId, 'deny')}
        >
          Rechazar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="permission-allow"
          onClick={() => onDecide(permission.requestId, 'allow')}
        >
          Aceptar
        </button>
      </footer>

      <p className="permission__note">
        Si no decides, en {secondsLeft} s Claude Code te preguntará en su terminal, como siempre.
        No se pierde nada.
      </p>
    </article>
  )
}
