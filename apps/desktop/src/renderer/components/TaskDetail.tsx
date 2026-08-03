import type { Task, TaskStatus } from '@torre/contracts'
import { ALLOWED_TRANSITIONS, PROVIDER_LABELS, STATUS_LABELS } from '@torre/domain'
import { duration, fullDateTime } from '../utils/format.js'
import { Provenance, StatusPill } from './StatusPill.js'
import { CopyableCommand } from './CopyableCommand.js'

interface TaskDetailProps {
  task: Task
  onClose: () => void
  onChangeStatus: (id: string, status: TaskStatus) => void
  onOpenExternal: (id: string) => void
  onArchive: (id: string) => void
  onEdit: (task: Task) => void
}

/**
 * Ficha completa de una tarea.
 *
 * Es lo que se abre al pulsar un trabajador en la oficina y al pulsar el título
 * en la vista operativa: la misma ficha desde los dos sitios.
 */
export function TaskDetail({
  task,
  onClose,
  onChangeStatus,
  onOpenExternal,
  onArchive,
  onEdit,
}: TaskDetailProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Ficha de la tarea">
      <aside className="panel panel--detail" data-testid="task-detail">
        <header className="panel__head">
          <div>
            <h2 className="panel__title">{task.title}</h2>
            <div className="panel__subtitle">
              <StatusPill status={task.status} />
              <span className="tag">{PROVIDER_LABELS[task.provider]}</span>
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <Provenance source={task.statusSource} confidence={task.statusConfidence} />

        <dl className="datalist">
          <div>
            <dt>Creada</dt>
            <dd>{fullDateTime(task.createdAt)}</dd>
          </div>
          <div>
            <dt>Empezó</dt>
            <dd>{fullDateTime(task.startedAt)}</dd>
          </div>
          <div>
            <dt>Última señal</dt>
            <dd>{fullDateTime(task.lastActivityAt)}</dd>
          </div>
          <div>
            <dt>Terminó</dt>
            <dd>{fullDateTime(task.finishedAt)}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{duration(task.startedAt, task.finishedAt ?? task.lastActivityAt)}</dd>
          </div>
          <div>
            <dt>Sesión externa</dt>
            <dd>{task.externalSessionId ?? '—'}</dd>
          </div>
          <div className="datalist__wide">
            <dt>Carpeta</dt>
            <dd>{task.projectPath ?? '—'}</dd>
          </div>
          <div className="datalist__wide">
            <dt>Enlace</dt>
            <dd className="datalist__url">{task.externalUrl ?? '— sin enlace guardado —'}</dd>
          </div>
        </dl>

        {task.notes && (
          <section className="notes">
            <h3 className="notes__title">Tus notas</h3>
            <p className="notes__body">{task.notes}</p>
          </section>
        )}

        <section className="detail-actions">
          <label className="field">
            <span className="field__label">Cambiar estado a mano</span>
            <select
              className="select"
              value=""
              data-testid="detail-status-select"
              onChange={(event) => {
                const value = event.target.value as TaskStatus | ''
                if (value) onChangeStatus(task.id, value)
              }}
            >
              <option value="">Elige un estado nuevo…</option>
              {ALLOWED_TRANSITIONS[task.status].map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <div className="detail-actions__buttons">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!task.externalUrl}
              onClick={() => onOpenExternal(task.id)}
              data-testid="detail-open-external"
            >
              Abrir conversación
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onEdit(task)}>
              Editar
            </button>
            {task.status !== 'archived' && (
              <button type="button" className="btn btn--ghost" onClick={() => onArchive(task.id)}>
                Archivar
              </button>
            )}
          </div>
        </section>

        <section className="dev-hint">
          <h3 className="notes__title">Simular un evento para esta tarea</h3>
          <p className="dev-hint__text">
            Desde una terminal en la carpeta del proyecto, para comprobar que los avisos
            automáticos funcionan:
          </p>
          <CopyableCommand command={`pnpm evento ${task.id} completed`} />
        </section>
      </aside>
    </div>
  )
}
