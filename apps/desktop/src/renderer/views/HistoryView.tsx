import type { Task } from '@torre/contracts'
import { PlatformChip, StatusBadge } from '../components/Indicators.js'
import { SourceLabel } from '../components/Indicators.js'
import { elapsed, fullDateTime } from '../utils/format.js'

interface HistoryViewProps {
  tasks: Task[]
  onOpen: (task: Task) => void
  onOpenExternal: (id: string) => void
}

/**
 * Historial: solo lo cerrado.
 *
 * Responde «¿qué hice y cuánto tardó?». No guarda documentos ni resultados —
 * eso sigue viviendo en la plataforma original (D3).
 */
export function HistoryView({ tasks, onOpen, onOpenExternal }: HistoryViewProps) {
  const archived = tasks
    .filter((task) => task.status === 'archived')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="history-view" data-testid="history-view">
      <p className="history-view__note">
        Solo lo que ya has retirado de la vista activa. Nada se borra solo: no hay caducidad ni
        limpieza automática, así que este historial es completo hasta que tú elimines algo a mano.
      </p>

      {archived.length === 0 ? (
        <div className="empty" data-testid="history-empty">
          <p className="empty__title">Todavía no has archivado nada</p>
          <p className="empty__text">
            Cuando revises una tarea terminada y la archives, aparecerá aquí con su duración.
          </p>
        </div>
      ) : (
        <div className="table">
          <div className="table__head">
            <span className="table__cell table__cell--grow">Tarea</span>
            <span className="table__cell table__cell--platform">Plataforma</span>
            <span className="table__cell table__cell--duration">Duración</span>
            <span className="table__cell table__cell--closed">Cerrada</span>
            <span className="table__cell table__cell--source">Fuente final</span>
            <span className="table__cell table__cell--actions" />
          </div>

          {archived.map((task) => (
            <div className="table__row" key={task.id} data-task-id={task.id} data-testid="history-row">
              <span className="table__cell table__cell--grow">
                <StatusBadge status={task.status} />
                <button type="button" className="table__link" onClick={() => onOpen(task)}>
                  {task.title}
                </button>
              </span>
              <span className="table__cell table__cell--platform">
                <PlatformChip provider={task.provider} />
              </span>
              <span className="table__cell table__cell--duration mono">
                {elapsed(task.startedAt, task.finishedAt ?? task.updatedAt)}
              </span>
              <span className="table__cell table__cell--closed">{fullDateTime(task.updatedAt)}</span>
              <span className="table__cell table__cell--source">
                <SourceLabel source={task.statusSource} />
              </span>
              <span className="table__cell table__cell--actions">
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={!task.externalUrl}
                  onClick={() => onOpenExternal(task.id)}
                >
                  Abrir ↗
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
