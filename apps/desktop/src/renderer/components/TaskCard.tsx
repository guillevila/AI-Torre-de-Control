import type { Task, TaskStatus } from '@torre/contracts'
import { ALLOWED_TRANSITIONS, PROVIDER_LABELS, STATUS_LABELS } from '@torre/domain'
import { relativeTime } from '../utils/format.js'
import { Provenance, StatusPill } from './StatusPill.js'

interface TaskCardProps {
  task: Task
  onChangeStatus: (id: string, status: TaskStatus) => void
  onOpenExternal: (id: string) => void
  onArchive: (id: string) => void
  onSelect: (task: Task) => void
}

export function TaskCard({
  task,
  onChangeStatus,
  onOpenExternal,
  onArchive,
  onSelect,
}: TaskCardProps) {
  // El desplegable solo ofrece transiciones que la máquina de estados aceptará.
  // Así la interfaz no puede pedir un imposible y luego enseñar un error.
  const nextStatuses = ALLOWED_TRANSITIONS[task.status]

  return (
    <article
      className="card"
      data-status={task.status}
      data-task-id={task.id}
      data-testid="task-card"
    >
      <header className="card__head">
        <button
          type="button"
          className="card__title"
          onClick={() => onSelect(task)}
          title="Ver la ficha completa"
        >
          {task.title}
        </button>
        <StatusPill status={task.status} />
      </header>

      <div className="card__meta">
        <span className="tag">{PROVIDER_LABELS[task.provider]}</span>
        <span className="card__time">{relativeTime(task.lastActivityAt)}</span>
      </div>

      <Provenance source={task.statusSource} confidence={task.statusConfidence} />

      <footer className="card__actions">
        <label className="visually-hidden" htmlFor={`status-${task.id}`}>
          Cambiar estado de {task.title}
        </label>
        <select
          id={`status-${task.id}`}
          className="select select--compact"
          value=""
          data-testid="status-select"
          onChange={(event) => {
            const value = event.target.value as TaskStatus | ''
            if (value) onChangeStatus(task.id, value)
            event.target.value = ''
          }}
        >
          <option value="">Cambiar estado…</option>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn--ghost"
          disabled={!task.externalUrl}
          title={
            task.externalUrl
              ? 'Abrir la conversación en el navegador'
              : 'Esta tarea no tiene enlace guardado'
          }
          data-testid="open-external"
          onClick={() => onOpenExternal(task.id)}
        >
          Abrir conversación
        </button>

        {task.status !== 'archived' && (
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="archive"
            onClick={() => onArchive(task.id)}
          >
            Archivar
          </button>
        )}
      </footer>
    </article>
  )
}
