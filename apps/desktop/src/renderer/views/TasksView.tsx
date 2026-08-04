import { useState } from 'react'
import type { StatusConfidence, Task } from '@torre/contracts'
import { CONFIDENCE_LABELS, groupTasksByStatus, STATUS_GLYPHS, STATUS_LABELS } from '@torre/domain'
import { TaskRow } from '../components/TaskRow.js'

interface TasksViewProps {
  tasks: Task[]
  confidence: StatusConfidence | 'all'
  onConfidence: (value: StatusConfidence | 'all') => void
  showArchived: boolean
  onShowArchived: (value: boolean) => void
  totalBeforeFilter: number
  onOpen: (task: Task) => void
  onOpenExternal: (id: string) => void
  onNew: () => void
}

const CONFIDENCE_FILTERS: readonly (StatusConfidence | 'all')[] = ['all', 'high', 'medium', 'low']

/**
 * Vista Tareas: la lista agrupada.
 *
 * Secciones por estado en orden de urgencia, colapsables. No es un Kanban a
 * propósito: en un Kanban el usuario arrastra las tarjetas, y aquí los estados
 * llegan solos desde las herramientas. Poder arrastrar sugeriría un control que
 * no existe.
 */
export function TasksView({
  tasks,
  confidence,
  onConfidence,
  showArchived,
  onShowArchived,
  totalBeforeFilter,
  onOpen,
  onOpenExternal,
  onNew,
}: TasksViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const sections = groupTasksByStatus(tasks)

  const toggle = (status: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })

  return (
    <div className="tasks" data-testid="tasks-view">
      <div className="filters" data-testid="filters">
        <span className="overline">Confianza</span>
        {CONFIDENCE_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="pillbtn"
            data-active={confidence === value}
            data-testid={`filter-confidence-${value}`}
            onClick={() => onConfidence(value)}
          >
            {value === 'all' ? 'Todas' : CONFIDENCE_LABELS[value]}
          </button>
        ))}

        <span className="filters__divider" aria-hidden="true" />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={showArchived}
            data-testid="filter-archived"
            onChange={(event) => onShowArchived(event.target.checked)}
          />
          Ver archivadas
        </label>

        <span className="filters__result">
          {tasks.length === totalBeforeFilter
            ? `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'}`
            : `${tasks.length} de ${totalBeforeFilter}`}
        </span>

        <span className="filters__note mono">Ordenadas por urgencia · no arrastrables</span>
      </div>

      <div className="tasks__body">
        {sections.length === 0 ? (
          <div className="empty" data-testid="tasks-empty">
            <span className="empty__glyph" aria-hidden="true">
              ⌕
            </span>
            <p className="empty__title">
              {totalBeforeFilter === 0 ? 'La oficina está vacía' : 'Ninguna tarea coincide'}
            </p>
            <p className="empty__text">
              {totalBeforeFilter === 0
                ? 'Registra la primera tarea que hayas dejado trabajando en cualquier herramienta.'
                : 'Prueba con otro término o quita el filtro de confianza.'}
            </p>
            {totalBeforeFilter === 0 && (
              <button type="button" className="btn btn--primary" onClick={onNew}>
                ＋ Nueva tarea <span className="mono">⌘N</span>
              </button>
            )}
          </div>
        ) : (
          sections.map((section) => {
            const isCollapsed = collapsed.has(section.status)
            return (
              <section className="group" key={section.status} data-testid={`group-${section.status}`}>
                <button
                  type="button"
                  className="group__head"
                  data-status={section.status}
                  onClick={() => toggle(section.status)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="group__glyph" aria-hidden="true">
                    {STATUS_GLYPHS[section.status]}
                  </span>
                  <span className="group__label">{STATUS_LABELS[section.status]}</span>
                  <span className="group__count mono">{section.tasks.length}</span>
                  <span className="group__rule" aria-hidden="true" />
                  <span className="group__toggle">{isCollapsed ? 'Mostrar' : 'Ocultar'}</span>
                </button>

                {!isCollapsed && (
                  <div className="group__rows">
                    {section.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onOpen={onOpen}
                        onOpenExternal={onOpenExternal}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
