import type { Task } from '@torre/contracts'
import {
  officeLabel,
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  STATUS_GLYPHS,
  STATUS_LABELS,
} from '@torre/domain'
import { WorkPulse } from '../../components/Indicators.js'

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
 * **La ropa es la herramienta**: naranja Claude, verde ChatGPT. Con dos
 * herramientas funcionando de verdad, el color por fin separa algo que importa
 * —de un vistazo sabes quién lleva cada trabajo—.
 *
 * El ESTADO va por otro camino y nunca depende solo del tono: cada uno lleva
 * glifo, globo de texto y su sitio en la planta. Así los dos datos conviven sin
 * pisarse, y quitando el color la pantalla sigue leyéndose entera.
 */
export function Worker({ task, left, top, onSelect }: WorkerProps) {
  const color = PROVIDER_COLORS[task.provider]
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
          aria-label={`${task.title}. ${PROVIDER_LABELS[task.provider]}${
            task.account ? `, cuenta ${task.account}` : ''
          }. Estado: ${STATUS_LABELS[status]}. Abrir ficha.`}
        >
          <span className="worker__head" style={{ borderColor: color }} />
          <span className="worker__body" style={{ background: color }} />
        </button>

        {/*
          La etiqueta lleva el PROYECTO, no el título entero: es lo que
          distingue a un muñeco de otro. El título completo sigue estando en el
          texto emergente y en la ficha, así que no se pierde nada.
        */}
        <button
          type="button"
          className="worker__tag"
          onClick={() => onSelect(task)}
          title={task.title}
          tabIndex={-1}
        >
          <span className="worker__tag-glyph" aria-hidden="true">
            {STATUS_GLYPHS[status]}
          </span>
          <span className="worker__tag-title">{officeLabel(task)}</span>
        </button>

        {/*
          La cuenta, cuando la hay. Va en su propia línea y en pequeño: con
          varios chats de cuentas distintas abiertos a la vez, es lo único que
          distingue un muñeco de otro. Sin cuenta no se dibuja nada, para no
          dejar un hueco en quien no la usa.
        */}
        {task.account && (
          <span className="worker__cuenta" title={`Cuenta: ${task.account}`}>
            {task.account}
          </span>
        )}
      </div>
    </div>
  )
}
