import { useMemo, useState } from 'react'
import type { Task, TaskStatus } from '@torre/contracts'
import { EMPTY_FILTERS, filterTasks, summarise, type TaskFilters } from '@torre/domain'
import { DevPanel } from './components/DevPanel.js'
import { Filters } from './components/Filters.js'
import { TaskDetail } from './components/TaskDetail.js'
import { TaskForm } from './components/TaskForm.js'
import { useTasks } from './hooks/useTasks.js'
import { OfficeView } from './views/office/OfficeView.js'
import { OperationsView } from './views/operations/OperationsView.js'

type ViewMode = 'operations' | 'office'
type Dialog = { kind: 'create' } | { kind: 'edit'; task: Task } | { kind: 'dev' } | null

export function App() {
  const {
    tasks,
    loading,
    error,
    clearError,
    createTask,
    updateTask,
    changeStatus,
    archiveTask,
    openExternal,
  } = useTasks()

  const [view, setView] = useState<ViewMode>('operations')
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)

  // Las DOS vistas reciben exactamente esta lista. No hay forma de que enseñen
  // conjuntos distintos de tareas (D10).
  const visibleTasks = useMemo(() => filterTasks(tasks, filters), [tasks, filters])

  // La ficha se deriva de la lista, no se copia: si la tarea cambia de estado
  // mientras está abierta, la ficha se actualiza sola.
  const selectedTask = useMemo(
    () => (selectedId ? (tasks.find((task) => task.id === selectedId) ?? null) : null),
    [tasks, selectedId],
  )

  const summary = useMemo(() => summarise(tasks), [tasks])

  const handleChangeStatus = (id: string, status: TaskStatus) => {
    void changeStatus({ id, status, source: 'manual', confidence: 'high' })
  }

  const handleCreate = (values: Record<string, unknown>) => {
    void createTask(values).then((task) => {
      if (task) setDialog(null)
    })
  }

  const handleUpdate = (values: Record<string, unknown>) => {
    void updateTask(values).then((task) => {
      if (task) setDialog(null)
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark" aria-hidden="true" />
          <h1 className="topbar__title">AI Torre de Control</h1>
        </div>

        <div className="summary" data-testid="summary">
          <SummaryChip
            label="te esperan"
            value={summary.attention}
            tone="attention"
            testId="summary-attention"
          />
          <SummaryChip label="trabajando" value={summary.active} tone="active" testId="summary-active" />
          <SummaryChip
            label="sin contacto"
            value={summary.unknown}
            tone="unknown"
            testId="summary-unknown"
          />
          <SummaryChip
            label="terminadas"
            value={summary.completed}
            tone="completed"
            testId="summary-completed"
          />
        </div>

        <div className="topbar__actions">
          <div className="switch" role="tablist" aria-label="Cambiar de vista">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'operations'}
              className="switch__option"
              data-active={view === 'operations'}
              data-testid="view-operations"
              onClick={() => setView('operations')}
            >
              Operativa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'office'}
              className="switch__option"
              data-active={view === 'office'}
              data-testid="view-office"
              onClick={() => setView('office')}
            >
              Oficina
            </button>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            data-testid="new-task"
            onClick={() => setDialog({ kind: 'create' })}
          >
            Nueva tarea
          </button>

          <button
            type="button"
            className="btn btn--ghost"
            data-testid="open-dev-panel"
            onClick={() => setDialog({ kind: 'dev' })}
            title="Ver dónde escucha el receptor local de eventos"
          >
            Eventos
          </button>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert" data-testid="error-banner">
          <span>{error}</span>
          <button type="button" className="btn btn--icon" onClick={clearError} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}

      <Filters filters={filters} onChange={setFilters} />

      <main className="main">
        {loading ? (
          <p className="muted">Cargando tus tareas…</p>
        ) : view === 'operations' ? (
          <OperationsView
            tasks={visibleTasks}
            onChangeStatus={handleChangeStatus}
            onOpenExternal={(id) => void openExternal(id)}
            onArchive={(id) => void archiveTask(id)}
            onSelect={(task) => setSelectedId(task.id)}
          />
        ) : (
          <OfficeView tasks={visibleTasks} onSelect={(task) => setSelectedId(task.id)} />
        )}
      </main>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onChangeStatus={handleChangeStatus}
          onOpenExternal={(id) => void openExternal(id)}
          onArchive={(id) => void archiveTask(id)}
          onEdit={(task) => {
            setSelectedId(null)
            setDialog({ kind: 'edit', task })
          }}
        />
      )}

      {dialog?.kind === 'create' && (
        <TaskForm onSubmit={handleCreate} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <TaskForm task={dialog.task} onSubmit={handleUpdate} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === 'dev' && <DevPanel onClose={() => setDialog(null)} />}
    </div>
  )
}

interface SummaryChipProps {
  label: string
  value: number
  tone: string
  testId: string
}

function SummaryChip({ label, value, tone, testId }: SummaryChipProps) {
  return (
    <span className="summary__chip" data-tone={tone} data-testid={testId}>
      <strong className="summary__value">{value}</strong>
      <span className="summary__label">{label}</span>
    </span>
  )
}
