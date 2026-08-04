import type { Task } from '@torre/contracts'
import { elapsed, relativeTime } from '../utils/format.js'
import {
  ConfidenceBars,
  PlatformChip,
  SourceLabel,
  StatusBadge,
  WorkPulse,
} from './Indicators.js'

interface TaskRowProps {
  task: Task
  onOpen: (task: Task) => void
  onOpenExternal: (id: string) => void
  /** Fila compacta para la Torre; completa para la vista Tareas. */
  dense?: boolean
}

/**
 * Fila de tarea.
 *
 * Jerarquía deliberada: el único botón sólido es «Abrir conversación». Todo lo
 * demás es secundario o discreto — es la promesa de D4 convertida en jerarquía
 * visual.
 */
export function TaskRow({ task, onOpen, onOpenExternal, dense = false }: TaskRowProps) {
  const working = task.status === 'running'
  const stalled = task.status === 'unknown'

  return (
    <div className="row" data-status={task.status} data-task-id={task.id} data-testid="task-row">
      <StatusBadge status={task.status} />

      <button type="button" className="row__main" onClick={() => onOpen(task)}>
        <span className="row__title">{task.title}</span>
        <span className="row__meta">
          <PlatformChip provider={task.provider} />
          <span aria-hidden="true">·</span>
          <span>{relativeTime(task.lastActivityAt)}</span>
        </span>
      </button>

      {!dense && (
        <>
          <span className="row__elapsed">
            {(working || stalled) && <WorkPulse frozen={stalled} />}
            <span className="mono">{elapsed(task.startedAt, task.finishedAt)}</span>
          </span>
          <span className="row__source">
            <SourceLabel source={task.statusSource} />
          </span>
        </>
      )}

      <span className="row__confidence">
        <ConfidenceBars confidence={task.statusConfidence} showLabel={!dense} />
      </span>

      <button
        type="button"
        className="btn btn--quiet"
        disabled={!task.externalUrl}
        title={
          task.externalUrl
            ? 'Abrir la conversación en el navegador'
            : 'Esta tarea no tiene enlace guardado'
        }
        data-testid="open-external"
        onClick={() => onOpenExternal(task.id)}
      >
        Abrir ↗
      </button>

      <button
        type="button"
        className="btn btn--icon"
        aria-label={`Ver la ficha de ${task.title}`}
        data-testid="open-detail"
        onClick={() => onOpen(task)}
      >
        ⋯
      </button>
    </div>
  )
}
