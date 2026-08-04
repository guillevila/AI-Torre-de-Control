import type { Task } from '@torre/contracts'
import { PROVIDER_LABELS, STATUS_GLYPHS, STATUS_LABELS } from '@torre/domain'
import { WorkPulse } from '../../components/Indicators.js'

/**
 * Color de los muñecos de la oficina.
 *
 * Antes cada uno llevaba el color de su plataforma —verde Claude Code, azul
 * ChatGPT, morado Codex—. El dueño del proyecto los quiso todos azules
 * (4/8/2026), y así están.
 *
 * La plataforma no se pierde: se sigue viendo en la ficha de la tarea, en la
 * barra lateral y en la lista. Solo deja de estar codificada en la figura.
 *
 * Es el azul petróleo de mando del sistema de diseño, no un azul inventado
 * aparte: si algún día se cambia la paleta, esto cambia con ella.
 */
const WORKER_COLOR = 'var(--command)'

interface WorkerProps {
  task: Task
  /** Posición absoluta dentro de la planta, en porcentaje. */
  left: number
  top: number
  onSelect: (task: Task) => void
}

/**
 * Un trabajador = una tarea delegada.
 *
 * Figura geométrica sin rostro (opción A del diseño): legible a 20 px, y
 * trivial de portar a un motor gráfico más adelante porque cada trabajador es
 * solo `{id, plataforma, estado, x, y}`.
 *
 * Todos van del mismo azul (ver `WORKER_COLOR`). Lo que distingue a uno de otro
 * es su ESTADO, y nunca solo por el tono: cada estado lleva además glifo, globo
 * de texto y su sitio en la planta.
 */
export function Worker({ task, left, top, onSelect }: WorkerProps) {
  const color = WORKER_COLOR
  const { status } = task

  return (
    <div
      className="worker"
      data-status={status}
      data-task-id={task.id}
      data-testid="office-worker"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {/* Contrarrotación: la planta está inclinada, las personas no. */}
      <div className="worker__upright">
        {status === 'waiting_user' && (
          <span className="bubble bubble--wait" data-testid="worker-bubble">
            ▲ ?
          </span>
        )}
        {status === 'completed' && <span className="bubble bubble--done">▤ Informe</span>}
        {status === 'failed' && <span className="bubble bubble--fail">✕ Error</span>}
        {status === 'unknown' && <span className="bubble bubble--unknown">? Sin señal</span>}
        {status === 'running' && <WorkPulse />}
        {status === 'queued' && <span className="bubble bubble--queued">◔ En cola</span>}

        <button
          type="button"
          className="worker__figure"
          onClick={() => onSelect(task)}
          title={`${task.title} — ${STATUS_LABELS[status]}`}
          aria-label={`${task.title}. ${PROVIDER_LABELS[task.provider]}. Estado: ${STATUS_LABELS[status]}. Abrir ficha.`}
        >
          <span className="worker__head" style={{ borderColor: color }} />
          <span className="worker__body" style={{ background: color }} />
        </button>

        <button type="button" className="worker__tag" onClick={() => onSelect(task)} tabIndex={-1}>
          <span className="worker__tag-glyph" aria-hidden="true">
            {STATUS_GLYPHS[status]}
          </span>
          <span className="worker__tag-title">{task.title}</span>
        </button>
      </div>
    </div>
  )
}
