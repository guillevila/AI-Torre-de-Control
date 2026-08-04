import type { Task } from '@torre/contracts'
import { officeWorkers, summarise, type OfficeZone } from '@torre/domain'
import { Worker } from './Worker.js'

interface OfficeViewProps {
  tasks: Task[]
  onSelect: (task: Task) => void
}

/**
 * Distribución de cada zona dentro de la planta, en porcentaje.
 *
 * La geografía ES la regla: tu despacho arriba a la derecha y fijo, la mesa de
 * entregas pegada a él, los puestos a la izquierda e incidencias abajo del todo.
 * La distancia a tu puerta es la urgencia.
 */
const ZONE_LAYOUT: Record<
  OfficeZone,
  { left: number; top: number; colStep: number; rowStep: number; cols: number }
> = {
  // De pie en tu puerta: pegados al borde izquierdo del despacho.
  office: { left: 57, top: 10, colStep: 8, rowStep: 13, cols: 1 },
  // Junto a la mesa de entregas.
  delivery: { left: 69, top: 49, colStep: 9, rowStep: 11, cols: 3 },
  // Sentados en sus puestos.
  work: { left: 7, top: 14, colStep: 15, rowStep: 25, cols: 3 },
  // Lo más lejos de tu puerta: un error no es urgente para ahora, pero no se esconde.
  incidents: { left: 6, top: 79, colStep: 10, rowStep: 10, cols: 2 },
  // Dentro, pero todavía sin trabajar.
  reception: { left: 35, top: 79, colStep: 9, rowStep: 10, cols: 3 },
  // El estante del fondo: revisado y sin nada pendiente. No se ha ido, solo
  // se ha apartado — y vuelve a su puesto en cuanto le mandes algo.
  backlog: { left: 69, top: 79, colStep: 8, rowStep: 10, cols: 3 },
}

/** Máximo de figuras por zona. Por encima se agrupan, para no animar de más. */
const MAX_PER_ZONE = 12

/**
 * Vista oficina — una proyección de los mismos datos (D10, D11).
 *
 * No tiene estado propio ni lógica propia: recibe el mismo array de tareas que
 * la lista y usa los mismos selectores del dominio. Si las dos pantallas
 * mostraran cosas distintas sería un fallo del dominio, no de aquí.
 *
 * Reglas de movimiento: solo se mueve lo que cambia de estado. Nada de
 * deambular decorativo — si alguien camina, algo ha pasado de verdad. Y la
 * información nunca viaja con la animación: los contadores y la lista se
 * actualizan en el instante cero; la caminata es la explicación posterior.
 */
export function OfficeView({ tasks, onSelect }: OfficeViewProps) {
  const workers = officeWorkers(tasks)
  const summary = summarise(tasks)

  // Índice de cada trabajador dentro de su zona, para colocarlo.
  const seen: Partial<Record<OfficeZone, number>> = {}
  const placed = workers.map(({ task, zone }) => {
    const index = seen[zone] ?? 0
    seen[zone] = index + 1
    const layout = ZONE_LAYOUT[zone]
    return {
      task,
      zone,
      index,
      left: layout.left + (index % layout.cols) * layout.colStep,
      top: layout.top + Math.floor(index / layout.cols) * layout.rowStep,
    }
  })

  const visible = placed.filter((worker) => worker.index < MAX_PER_ZONE)
  const overflow = placed.length - visible.length

  return (
    <div className="office" data-testid="office-view">
      <div className="office__legend" aria-label="Cómo leer la oficina">
        <span className="legend legend--run">En su puesto = trabajando</span>
        <span className="legend legend--wait">En tu puerta = te espera</span>
        <span className="legend legend--done">En la mesa de entregas = terminada</span>
        <span className="legend legend--fail">En incidencias = error</span>
        <span className="legend legend--unknown">Contorno discontinuo = sin confirmar</span>
        <span className="legend legend--reviewed">En el backlog = revisada, nada pendiente</span>
      </div>

      <div className="office__stage">
        <div className="floor">
          <div className="zone zone--office">
            <span className="zone__door" aria-hidden="true" />
            <span className="zone__desk" aria-hidden="true" />
            <span className="zone__seat" aria-hidden="true" />
            <span className="zone__label">Tu despacho</span>
          </div>

          <div className="zone zone--delivery">
            <span className="zone__table" aria-hidden="true" />
            <span className="zone__label zone__label--top">
              Mesa de entregas · {summary.completed} sin revisar
            </span>
          </div>

          <div className="zone zone--work">
            <span className="zone__label zone__label--top">Zona de trabajo</span>
          </div>

          <div className="zone zone--incidents">
            <span className="zone__label">Incidencias</span>
          </div>

          <div className="zone zone--reception">
            <span className="zone__label">Recepción · en cola y borradores</span>
          </div>

          <div className="zone zone--backlog">
            <span className="zone__label">
              Backlog · revisadas{summary.reviewed > 0 ? ` · ${summary.reviewed}` : ''}
            </span>
          </div>

          {visible.map((worker) => (
            <Worker
              key={worker.task.id}
              task={worker.task}
              left={worker.left}
              top={worker.top}
              onSelect={onSelect}
              todas={tasks}
            />
          ))}

          {workers.length === 0 && (
            <p className="office__empty" data-testid="office-empty">
              La oficina está vacía. Cuando delegues una tarea aparecerá aquí alguien trabajando en
              ella.
            </p>
          )}
        </div>
      </div>

      {overflow > 0 && (
        <p className="office__overflow">
          Se muestran los primeros {MAX_PER_ZONE} puestos de cada zona. Hay {overflow} tarea
          {overflow === 1 ? '' : 's'} más — están todas en la vista Operativa.
        </p>
      )}
    </div>
  )
}
