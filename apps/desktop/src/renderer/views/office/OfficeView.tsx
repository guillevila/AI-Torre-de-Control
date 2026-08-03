import type { Task } from '@torre/contracts'
import { officeWorkers, summarise } from '@torre/domain'
import { Worker } from './Worker.js'

interface OfficeViewProps {
  tasks: Task[]
  onSelect: (task: Task) => void
}

/**
 * Vista oficina — una proyección de los mismos datos (D10, D11).
 *
 * No tiene estado propio ni lógica propia: recibe el mismo array de tareas que
 * la vista operativa y usa los mismos selectores del dominio. Si las dos
 * pantallas mostraran cosas distintas sería un fallo del dominio, no de aquí.
 *
 * Deliberadamente sencilla: React, CSS y SVG. Nada de motores de juego ni
 * isometría, que llegarán —si llegan— cuando el control de tareas esté validado.
 */
export function OfficeView({ tasks, onSelect }: OfficeViewProps) {
  const workers = officeWorkers(tasks)
  const summary = summarise(tasks)

  return (
    <div className="office" data-testid="office-view">
      <section className="office__ceo" aria-label="Tu despacho">
        <div className="ceo-desk">
          <svg viewBox="0 0 72 78" className="worker__svg" aria-hidden="true" focusable="false">
            <circle className="worker__head" cx="36" cy="24" r="12" />
            <path className="worker__body" d="M18 56 q18 -22 36 0 z" />
            <rect className="worker__desk" x="4" y="58" width="64" height="8" rx="3" />
          </svg>
          <h2 className="ceo-desk__title">Tu despacho</h2>
          <p className="ceo-desk__line">
            {summary.attention > 0 ? (
              <strong className="ceo-desk__alert">
                {summary.attention}{' '}
                {summary.attention === 1 ? 'persona te espera' : 'personas te esperan'}
              </strong>
            ) : (
              <span className="muted">Nadie te está esperando</span>
            )}
          </p>
          <p className="ceo-desk__line muted">
            {summary.active} trabajando · {summary.completed} terminadas · {summary.unknown} sin
            contacto
          </p>
        </div>
      </section>

      <section className="office__floor" aria-label="Puestos de trabajo">
        {workers.length === 0 ? (
          <p className="office__empty" data-testid="office-empty">
            La oficina está vacía. Cuando delegues una tarea aparecerá aquí alguien trabajando en
            ella.
          </p>
        ) : (
          <div className="office__desks">
            {workers.map((task) => (
              <Worker key={task.id} task={task} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>

      <footer className="office__legend" aria-label="Leyenda">
        <span className="legend" data-status="running">
          Trabajando
        </span>
        <span className="legend" data-status="waiting_user">
          Te espera
        </span>
        <span className="legend" data-status="completed">
          Terminada
        </span>
        <span className="legend" data-status="failed">
          Ha fallado
        </span>
        <span className="legend" data-status="unknown">
          Sin contacto
        </span>
        <span className="legend" data-status="queued">
          En cola
        </span>
      </footer>
    </div>
  )
}
