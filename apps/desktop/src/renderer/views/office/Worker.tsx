import type { Task, TaskStatus } from '@torre/contracts'
import { PROVIDER_LABELS, STATUS_LABELS } from '@torre/domain'
import { relativeTime } from '../../utils/format.js'

/**
 * Glifo corto que acompaña a cada puesto.
 *
 * Se usa junto al color, nunca en su lugar: quien no distinga bien los colores
 * tiene que poder leer el estado igual.
 */
const GLYPHS: Record<TaskStatus, string> = {
  running: '···',
  waiting_user: '!',
  completed: '✓',
  failed: '×',
  unknown: '?',
  queued: '⏱',
  draft: '·',
  archived: '—',
}

interface WorkerProps {
  task: Task
  onSelect: (task: Task) => void
}

/**
 * Un trabajador = una tarea delegada.
 *
 * El dibujo cambia con el estado: quien espera respuesta levanta la mano, quien
 * ha terminado deja el encargo sobre la mesa, y quien ha perdido el contacto
 * aparece desvaído. Es la misma información de la vista operativa contada de
 * otra forma.
 */
export function Worker({ task, onSelect }: WorkerProps) {
  const waving = task.status === 'waiting_user'
  const delivered = task.status === 'completed' || task.status === 'failed'

  return (
    <button
      type="button"
      className="worker"
      data-status={task.status}
      data-testid="office-worker"
      onClick={() => onSelect(task)}
      title={`${task.title} — ${STATUS_LABELS[task.status]}`}
      aria-label={`${task.title}. Estado: ${STATUS_LABELS[task.status]}. Abrir ficha.`}
    >
      <span className="worker__badge" aria-hidden="true">
        {GLYPHS[task.status]}
      </span>

      <svg viewBox="0 0 72 78" className="worker__svg" aria-hidden="true" focusable="false">
        {/* Cabeza */}
        <circle className="worker__head" cx="36" cy="24" r="11" />
        {/* Torso */}
        <path className="worker__body" d="M20 54 q16 -20 32 0 z" />
        {/* Brazo: levantado si la tarea reclama al usuario */}
        <path
          className="worker__arm"
          d={waving ? 'M50 48 L59 22' : 'M50 48 L58 56'}
          strokeLinecap="round"
        />
        {/* Mesa */}
        <rect className="worker__desk" x="6" y="56" width="60" height="7" rx="3" />
        <rect className="worker__desk-leg" x="12" y="63" width="4" height="12" rx="2" />
        <rect className="worker__desk-leg" x="56" y="63" width="4" height="12" rx="2" />
        {/* Encargo entregado sobre la mesa */}
        {delivered && <rect className="worker__parcel" x="44" y="46" width="16" height="10" rx="2" />}
        {/* Pantalla del puesto */}
        {!delivered && <rect className="worker__screen" x="10" y="42" width="18" height="14" rx="2" />}
      </svg>

      <span className="worker__name">{task.title}</span>
      <span className="worker__meta">
        {PROVIDER_LABELS[task.provider]} · {relativeTime(task.lastActivityAt)}
      </span>
    </button>
  )
}
