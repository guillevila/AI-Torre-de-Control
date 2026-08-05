import { useState } from 'react'
import type { StatusHistoryEntry, Task, TaskStatus } from '@torre/contracts'
import {
  ALLOWED_TRANSITIONS,
  SOURCE_DESCRIPTIONS,
  SOURCE_LABELS,
  STATUS_GLYPHS,
  STATUS_LABELS,
} from '@torre/domain'
import { dayAndClock, elapsed, fullDateTime, relativeTime } from '../utils/format.js'
import { ConfidenceBars, PlatformChip, StatusBadge, StatusPill } from './Indicators.js'
import { CopyableCommand } from './CopyableCommand.js'

interface TaskDetailProps {
  task: Task
  history: StatusHistoryEntry[]
  onClose: () => void
  onChangeStatus: (id: string, status: TaskStatus) => void
  onOpenExternal: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  /** Retomar la conversación de esta tarea con un mensaje nuevo (D25-bis). */
  onReply?: (id: string, text: string) => void
}

/** Correcciones rápidas que se ofrecen siempre que sean transiciones válidas. */
const QUICK_FIXES: readonly TaskStatus[] = [
  'running',
  'waiting_user',
  'completed',
  'reviewed',
  'archived',
]

/**
 * Ficha de la tarea: panel lateral de 480 px sobre la vista actual.
 *
 * Es una capa, no un destino: se abre desde cualquier vista y al cerrarla sigues
 * exactamente donde estabas.
 *
 * En el centro está el historial de estados (D19). Es la prueba de honestidad
 * del sistema: si la aplicación afirma algo, aquí se ve de dónde vino.
 */
export function TaskDetail({
  task,
  history,
  onClose,
  onChangeStatus,
  onOpenExternal,
  onEdit,
  onDelete,
  onReply,
}: TaskDetailProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const allowed = ALLOWED_TRANSITIONS[task.status]
  // Solo se puede retomar una conversación que conocemos: de Claude Code y con
  // identificador de sesión guardado.
  const puedeResponder = Boolean(onReply && task.provider === 'claude_code' && task.externalSessionId && task.projectPath)

  return (
    <div className="overlay overlay--right" role="dialog" aria-modal="true" aria-label="Ficha de la tarea">
      <aside className="detail" data-testid="task-detail">
        <header className="detail__head">
          <div className="detail__heading">
            <StatusBadge status={task.status} />
            <div className="detail__titles">
              <h2 className="detail__title">{task.title}</h2>
              <div className="detail__meta">
                <PlatformChip provider={task.provider} />
              </div>
            </div>
            <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div className="detail__primary">
            <button
              type="button"
              className="btn btn--primary btn--grow"
              disabled={!task.externalUrl}
              data-testid="detail-open-external"
              onClick={() => onOpenExternal(task.id)}
            >
              Abrir conversación ↗
            </button>
            {/*
              Para algo terminado, la acción natural no es archivar —eso es
              retirarlo— sino decir «ya lo he mirado». La tarea se va al backlog
              y vuelve sola en cuanto le mandes algo nuevo.
            */}
            {(task.status === 'completed' || task.status === 'failed') && (
              <button
                type="button"
                className="btn btn--ghost"
                data-testid="detail-review"
                onClick={() => onChangeStatus(task.id, 'reviewed')}
              >
                Ya lo he revisado
              </button>
            )}
            {task.status !== 'archived' && (
              <button
                type="button"
                className="btn btn--ghost"
                data-testid="detail-archive"
                onClick={() => onChangeStatus(task.id, 'archived')}
              >
                Archivar
              </button>
            )}
          </div>
        </header>

        <div className="detail__body">
          {puedeResponder && (
            <section className="card" data-testid="detail-reply">
              <div className="overline">Retomar la conversación</div>
              <textarea
                className="input turn__reply"
                data-testid="detail-reply-text"
                placeholder="Escríbele y la conversación continúa donde estaba…"
                rows={3}
                value={respuesta}
                onChange={(event) => setRespuesta(event.target.value)}
              />
              <div className="card__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="detail-reply-send"
                  disabled={respuesta.trim() === ''}
                  onClick={() => {
                    onReply?.(task.id, respuesta.trim())
                    setRespuesta('')
                  }}
                >
                  Responder
                </button>
              </div>
            </section>
          )}

          <section className="statebox" data-status={task.status}>
            <div className="statebox__top">
              <StatusPill status={task.status} />
              <ConfidenceBars confidence={task.statusConfidence} />
            </div>

            <p className="statebox__source">
              <strong>{SOURCE_LABELS[task.statusSource]}</strong> —{' '}
              {SOURCE_DESCRIPTIONS[task.statusSource]}.
            </p>

            {task.status === 'unknown' && (
              <p className="statebox__warn" data-testid="unknown-explanation">
                No puedo confirmar este estado. La última señal fue{' '}
                {relativeTime(task.lastActivityAt)}. No supongo que siga trabajando.
              </p>
            )}

            <div className="statebox__fix">
              <span className="statebox__fix-label">Corregir a mano:</span>
              {QUICK_FIXES.filter((status) => allowed.includes(status)).map((status) => (
                <button
                  key={status}
                  type="button"
                  className="fix"
                  data-status={status}
                  data-testid={`fix-${status}`}
                  onClick={() => onChangeStatus(task.id, status)}
                >
                  {STATUS_GLYPHS[status]} {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </section>

          <dl className="times">
            <div>
              <dt>Inicio</dt>
              <dd>{fullDateTime(task.startedAt)}</dd>
            </div>
            <div>
              <dt>En marcha</dt>
              <dd className="mono">{elapsed(task.startedAt, task.finishedAt)}</dd>
            </div>
            <div>
              <dt>Última señal</dt>
              <dd>{relativeTime(task.lastActivityAt)}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{fullDateTime(task.finishedAt)}</dd>
            </div>
          </dl>

          <section className="facts">
            <div className="fact fact--wide">
              <span className="overline">Enlace externo</span>
              <span className="fact__value mono fact__url">
                {task.externalUrl ?? '— sin enlace guardado —'}
              </span>
            </div>
            <div className="fact">
              <span className="overline">Sesión</span>
              <span className="fact__value mono">{task.externalSessionId ?? '—'}</span>
            </div>
            <div className="fact">
              <span className="overline">Carpeta</span>
              <span className="fact__value mono fact__url">{task.projectPath ?? '—'}</span>
            </div>
            <div className="fact fact--wide">
              <span className="overline">Notas</span>
              <p className="notes">{task.notes ?? '—'}</p>
            </div>
          </section>

          <section className="history">
            <div className="overline">Historial de estados</div>
            {history.length === 0 ? (
              <p className="history__empty">
                Todavía no hay cambios registrados. La próxima vez que esta tarea cambie de estado,
                quedará aquí anotado de dónde vino.
              </p>
            ) : (
              <ol className="history__list" data-testid="history-list">
                {history.map((entry) => (
                  <li className="history__item" key={entry.id} data-status={entry.toStatus}>
                    <span className="history__time mono">{dayAndClock(entry.at)}</span>
                    <span className="history__track" aria-hidden="true">
                      <span className="history__dot" />
                    </span>
                    <span className="history__text">
                      <span className="history__glyph" aria-hidden="true">
                        {STATUS_GLYPHS[entry.toStatus]}
                      </span>{' '}
                      {STATUS_LABELS[entry.toStatus]}
                      <span className="history__from">
                        {entry.fromStatus
                          ? ` · desde ${STATUS_LABELS[entry.fromStatus]}`
                          : ' · al registrarla'}{' '}
                        · {SOURCE_LABELS[entry.source]}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="dev-hint">
            <div className="overline">Simular un evento para esta tarea</div>
            <p className="dev-hint__text">
              Desde una terminal en la carpeta del proyecto, para comprobar que los avisos
              automáticos funcionan:
            </p>
            <CopyableCommand command={`pnpm evento ${task.id} completed`} />
          </section>
        </div>

        <footer className="detail__foot">
          <button type="button" className="btn btn--ghost" onClick={() => onEdit(task)}>
            Editar
          </button>
          <span className="detail__spacer" />
          {confirmingDelete ? (
            <>
              <span className="detail__confirm">¿Seguro? No se puede deshacer.</span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                No
              </button>
              <button
                type="button"
                className="btn btn--danger"
                data-testid="confirm-delete"
                onClick={() => onDelete(task.id)}
              >
                Eliminar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--danger"
              data-testid="delete-task"
              onClick={() => setConfirmingDelete(true)}
            >
              Eliminar…
            </button>
          )}
        </footer>
      </aside>
    </div>
  )
}
