import type { Task, TaskStatus } from '@torre/contracts'
import { GROUP_LABELS, GROUP_ORDER, groupTasks, type TaskGroupKey } from '@torre/domain'
import { TaskCard } from '../../components/TaskCard.js'

interface OperationsViewProps {
  tasks: Task[]
  onChangeStatus: (id: string, status: TaskStatus) => void
  onOpenExternal: (id: string) => void
  onArchive: (id: string) => void
  onSelect: (task: Task) => void
}

/**
 * Vista operativa — la fuente funcional de verdad (D10).
 *
 * Las tareas aparecen agrupadas en el orden en que importan: primero las que
 * reclaman al usuario, después las que trabajan, y solo al final lo terminado.
 * Un grupo vacío no se dibuja, para no llenar la pantalla de secciones sin uso.
 */
export function OperationsView({
  tasks,
  onChangeStatus,
  onOpenExternal,
  onArchive,
  onSelect,
}: OperationsViewProps) {
  const groups = groupTasks(tasks)
  const visibleGroups = GROUP_ORDER.filter((group) => groups[group].length > 0)

  if (tasks.length === 0) {
    return (
      <div className="empty" data-testid="empty-state">
        <h2 className="empty__title">Aquí no hay nada todavía</h2>
        <p className="empty__text">
          Registra la primera tarea que hayas dejado trabajando en cualquier herramienta de IA.
          Tardas menos de quince segundos.
        </p>
      </div>
    )
  }

  return (
    <div className="board" data-testid="operations-view">
      {visibleGroups.map((group) => (
        <section
          key={group}
          className="board__group"
          data-group={group}
          data-testid={`group-${group}`}
        >
          <h2 className="board__heading">
            {GROUP_LABELS[group as TaskGroupKey]}
            <span className="board__count">{groups[group].length}</span>
          </h2>
          <div className="board__cards">
            {groups[group].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onChangeStatus={onChangeStatus}
                onOpenExternal={onOpenExternal}
                onArchive={onArchive}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
