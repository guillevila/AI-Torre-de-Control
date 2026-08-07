import type { Task } from '@torre/contracts'
import { officeLabel, PROVIDER_LABELS, STATUS_LABELS } from '@torre/domain'
import { Robot, type RobotSize } from './Robot.js'

interface WorkerProps {
  task: Task
  /** Nave donde está. Decide el tamaño de la celda y qué adornos lleva. */
  bay: RobotSize
  /** Puesto dentro de la nave, empezando en 0. Se enseña como 01, 02, 03… */
  slot: number
  onSelect: (task: Task) => void
}

/** Puestos numerados como en el diseño: 01, 02… 10. */
const numero = (slot: number) => String(slot + 1).padStart(2, '0')

/**
 * Una celda de la fábrica: un puesto con su robot.
 *
 * Un robot = una tarea delegada.
 *
 * **La celda entera se puede pulsar**, no solo el robot. Es deliberado y costó
 * encontrarlo: la planta anterior iba inclinada en 3D, y el clic caía donde
 * decía la caja del botón y no donde se veía la figura. Ningún muñeco se podía
 * pulsar con el ratón durante semanas, con los tests en verde. Aquí no hay
 * inclinación, pero la lección se queda: el manejador va en el contenedor.
 */
export function Worker({ task, bay, slot, onSelect }: WorkerProps) {
  const { status } = task
  const etiqueta = officeLabel(task)

  return (
    <div
      className={`bay bay--${bay}`}
      data-status={status}
      data-task-id={task.id}
      data-testid="office-worker"
      onClick={() => onSelect(task)}
    >
      {/* Chapa del puesto: número y el color de la herramienta. */}
      <span className="bay__plate">
        <span className="bay__plate-dot" />
        <span className="bay__plate-num">{numero(slot)}</span>
      </span>

      {bay === 'work' && (
        <>
          <span className="bay__bolt bay__bolt--tl" />
          <span className="bay__bolt bay__bolt--tr" />
          <span className="bay__bolt bay__bolt--bl" />
          <span className="bay__bolt bay__bolt--br" />
        </>
      )}

      {bay === 'delivery' && <span className="bay__check">✓</span>}

      <span className="bay__stage">
        {bay === 'backlog' && <span className="bay__pod" />}
        <span className="bay__floor" />
        <span className="bay__halo" />

        {/*
          El globo de estado. Solo sale cuando hay algo que decir, y dice el
          estado de verdad —nunca lo que la herramienta está «pensando»: eso no
          lo sabemos ni lo queremos saber.
        */}
        {(status === 'waiting_user' || status === 'failed' || status === 'unknown') && (
          <span className="bay__bubble" data-testid="worker-bubble">
            {status === 'waiting_user' ? '⧗' : status === 'failed' ? '⚠' : '?'}
          </span>
        )}

        <button
          type="button"
          className="worker__figure"
          title={`${task.title} — ${STATUS_LABELS[status]}`}
          aria-label={`${task.title}. ${PROVIDER_LABELS[task.provider]}${
            task.account ? `, cuenta ${task.account}` : ''
          }. Estado: ${STATUS_LABELS[status]}. Abrir ficha.`}
          onClick={(evento) => {
            // El contenedor ya lo abre. Se corta aquí para no llamar dos veces.
            evento.stopPropagation()
            onSelect(task)
          }}
        >
          <Robot task={task} size={bay} phase={slot % 5} />
        </button>
      </span>

      {/*
        En la nave de trabajo, bajo cada robot va el NOMBRE DEL PROYECTO.
        El diseño ponía ahí una frase del tipo «Analizando requisitos», pero eso
        exigiría saber qué está haciendo la herramienta por dentro, y esta
        aplicación no lee conversaciones. El proyecto sí lo sabemos, y además es
        lo que distingue un robot de otro.
      */}
      {bay === 'work' && (
        <span className="bay__label" title={task.title}>
          {etiqueta}
          {task.account && <span className="bay__account">{task.account}</span>}
        </span>
      )}
    </div>
  )
}
