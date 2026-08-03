import type { Task, TaskStatus } from '@torre/contracts'
import { ATTENTION_REASONS, attentionQueue } from '@torre/domain'
import { ConfidenceBars, PlatformChip, StatusBadge } from '../components/Indicators.js'
import { relativeTime } from '../utils/format.js'

interface AttentionViewProps {
  tasks: Task[]
  onOpen: (task: Task) => void
  onOpenExternal: (id: string) => void
  onChangeStatus: (id: string, status: TaskStatus) => void
}

/**
 * Centro de atención: la cola de decisión.
 *
 * Ordenada por lo que cuesta más caro ignorar: primero quien está parado
 * esperándote, luego lo que no se puede confirmar, después los errores, y por
 * último lo terminado sin revisar.
 *
 * Cada fila trae la salida más probable a un clic, para que atender la cola sea
 * rápido de verdad.
 */
export function AttentionView({
  tasks,
  onOpen,
  onOpenExternal,
  onChangeStatus,
}: AttentionViewProps) {
  const queue = attentionQueue(tasks)

  if (queue.length === 0) {
    return (
      <div className="calm calm--full" data-testid="attention-empty">
        <p className="calm__title">Nada te espera</p>
        <p className="calm__text">
          Todo lo activo está trabajando por su cuenta. Te avisaré cuando alguien necesite algo.
        </p>
      </div>
    )
  }

  return (
    <div className="attention" data-testid="attention-view">
      <header className="attention__head">
        <span className="attention__count">{queue.length}</span>
        <div>
          <h2 className="attention__title">
            {queue.length === 1 ? 'tarea requiere tu atención' : 'tareas requieren tu atención'}
          </h2>
          <p className="attention__sub">
            Ordenadas por lo que cuesta más caro ignorar: primero quien está parado esperándote,
            luego lo que no se puede confirmar, después los errores y por último lo terminado sin
            revisar.
          </p>
        </div>
      </header>

      <ul className="attention__list">
        {queue.map((task) => (
          <li key={task.id}>
            <div className="attention-row" data-status={task.status} data-task-id={task.id} data-testid="attention-row">
              <StatusBadge status={task.status} />

              <button type="button" className="attention-row__main" onClick={() => onOpen(task)}>
                <span className="attention-row__title">{task.title}</span>
                <span className="attention-row__reason">
                  {ATTENTION_REASONS[task.status] ?? ''} Última señal {relativeTime(task.lastActivityAt)}.
                </span>
              </button>

              <span className="attention-row__meta">
                <PlatformChip provider={task.provider} />
                <ConfidenceBars confidence={task.statusConfidence} />
              </span>

              <button
                type="button"
                className="btn btn--primary"
                disabled={!task.externalUrl}
                data-testid="attention-open"
                onClick={() => onOpenExternal(task.id)}
              >
                Abrir conversación ↗
              </button>

              {task.status !== 'running' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="attention-resume"
                  onClick={() => onChangeStatus(task.id, 'running')}
                >
                  Volver a trabajando
                </button>
              )}

              <button
                type="button"
                className="btn btn--quiet"
                data-testid="attention-archive"
                onClick={() => onChangeStatus(task.id, 'archived')}
              >
                Archivar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
