import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DevInfo, StatusConfidence, Task, TaskStatus } from '@torre/contracts'
import { filterTasks, summarise, type TaskFilters } from '@torre/domain'
import { DevPanel } from './components/DevPanel.js'
import { QuickAdd } from './components/QuickAdd.js'
import { Sidebar, type Section } from './components/Sidebar.js'
import { TaskDetail } from './components/TaskDetail.js'
import { Toast } from './components/Toast.js'
import { TopBar, type ViewMode } from './components/TopBar.js'
import { useHotkeys } from './hooks/useHotkeys.js'
import { useSettings } from './hooks/useSettings.js'
import { useRecentActivity, useTaskHistory, useTasks } from './hooks/useTasks.js'
import { AttentionView } from './views/AttentionView.js'
import { HistoryView } from './views/HistoryView.js'
import { OfficeView } from './views/office/OfficeView.js'
import { SettingsView } from './views/SettingsView.js'
import { TasksView } from './views/TasksView.js'
import { TowerView } from './views/TowerView.js'

type Dialog = { kind: 'create' } | { kind: 'edit'; task: Task } | { kind: 'dev' } | null

const TITLES: Record<Section, { title: string; subtitle: string }> = {
  tower: { title: 'Torre de control', subtitle: 'Qué está pasando ahora mismo' },
  attention: { title: 'Centro de atención', subtitle: 'Lo que espera una decisión tuya' },
  tasks: { title: 'Tareas', subtitle: 'Todo lo delegado, agrupado por urgencia' },
  history: { title: 'Historial', subtitle: 'Lo que ya has retirado de la vista activa' },
  settings: { title: 'Ajustes', subtitle: 'Avisos, datos y privacidad' },
}

export function App() {
  const {
    tasks,
    loading,
    error,
    clearError,
    createTask,
    updateTask,
    changeStatus,
    deleteTask,
    openExternal,
  } = useTasks()
  const { settings, loaded: settingsLoaded, update: updateSettings } = useSettings()

  const [section, setSection] = useState<Section>('tower')
  const [view, setView] = useState<ViewMode>('operations')
  const [search, setSearch] = useState('')
  const [confidence, setConfidence] = useState<StatusConfidence | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'error' } | null>(null)
  const [devInfo, setDevInfo] = useState<DevInfo | null>(null)
  const [appliedPreferences, setAppliedPreferences] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // Los ajustes deciden dónde arranca la aplicación, pero solo la primera vez:
  // después manda lo que el usuario esté mirando.
  useEffect(() => {
    if (!settingsLoaded || appliedPreferences) return
    setSection(settings.startSection)
    setView(settings.startView)
    setAppliedPreferences(true)
  }, [settingsLoaded, appliedPreferences, settings.startSection, settings.startView])

  useEffect(() => {
    void window.torre.getDevInfo().then((result) => {
      if (result.ok) setDevInfo(result.data)
    })
  }, [tasks.length])

  const filters: TaskFilters = useMemo(
    () => ({ search, provider: 'all', confidence, showArchived }),
    [search, confidence, showArchived],
  )

  // TODAS las vistas reciben exactamente esta lista. No hay forma de que
  // enseñen conjuntos distintos de tareas (D10).
  const visibleTasks = useMemo(() => filterTasks(tasks, filters), [tasks, filters])
  const summary = useMemo(() => summarise(tasks), [tasks])

  // La ficha se deriva de la lista, no se copia: si la tarea cambia de estado
  // mientras está abierta, la ficha y su historial se actualizan solos.
  const selectedTask = useMemo(
    () => (selectedId ? (tasks.find((task) => task.id === selectedId) ?? null) : null),
    [tasks, selectedId],
  )
  const history = useTaskHistory(selectedId, selectedTask?.updatedAt)
  const activity = useRecentActivity(10, tasks)

  const closeLayers = useCallback(() => {
    setDialog(null)
    setSelectedId(null)
  }, [])

  useHotkeys({
    onNew: useCallback(() => setDialog({ kind: 'create' }), []),
    onEscape: closeLayers,
    onSearch: useCallback(() => {
      setSection('tasks')
      searchRef.current?.focus()
    }, []),
  })

  const handleChangeStatus = useCallback(
    (id: string, status: TaskStatus) => {
      void changeStatus({ id, status, source: 'manual', confidence: 'high' })
    },
    [changeStatus],
  )

  const handleOpenExternal = useCallback((id: string) => void openExternal(id), [openExternal])

  const handleExport = useCallback(async () => {
    const result = await window.torre.exportCsv()
    if (!result.ok) {
      setToast({ message: result.error, tone: 'error' })
      return
    }
    if (result.data.written) {
      setToast({
        message: `${result.data.rows} ${result.data.rows === 1 ? 'tarea exportada' : 'tareas exportadas'} a ${result.data.path}`,
        tone: 'neutral',
      })
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    const result = await window.torre.openDataFolder()
    if (!result.ok) setToast({ message: result.error, tone: 'error' })
  }, [])

  const showSwitch = section === 'tower' || section === 'tasks'
  const officeMode = showSwitch && view === 'office'

  return (
    <div className="app">
      <Sidebar
        section={section}
        onNavigate={setSection}
        onNew={() => setDialog({ kind: 'create' })}
        attentionCount={summary.attention}
        devInfo={devInfo}
      />

      <main className="main">
        <TopBar
          ref={searchRef}
          title={TITLES[section].title}
          subtitle={
            officeMode
              ? 'La planta de la oficina: la posición de cada trabajador es su estado'
              : TITLES[section].subtitle
          }
          showSwitch={showSwitch}
          view={view}
          onView={setView}
          search={search}
          onSearch={setSearch}
        />

        {error && (
          <div className="banner" role="alert" data-testid="error-banner">
            <span>{error}</span>
            <button type="button" className="btn btn--icon" onClick={clearError} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}

        <div className="content">
          {loading ? (
            <div className="skeletons" aria-label="Cargando">
              {[0, 1, 2].map((index) => (
                <span className="skeleton" key={index} />
              ))}
            </div>
          ) : officeMode ? (
            <OfficeView tasks={visibleTasks} onSelect={(task) => setSelectedId(task.id)} />
          ) : section === 'tower' ? (
            <TowerView
              tasks={visibleTasks}
              activity={activity}
              onOpen={(task) => setSelectedId(task.id)}
              onGoAttention={() => setSection('attention')}
              onGoOffice={() => {
                setSection('tower')
                setView('office')
              }}
            />
          ) : section === 'attention' ? (
            <AttentionView
              tasks={visibleTasks}
              onOpen={(task) => setSelectedId(task.id)}
              onOpenExternal={handleOpenExternal}
              onChangeStatus={handleChangeStatus}
            />
          ) : section === 'tasks' ? (
            <TasksView
              tasks={visibleTasks}
              confidence={confidence}
              onConfidence={setConfidence}
              showArchived={showArchived}
              onShowArchived={setShowArchived}
              totalBeforeFilter={tasks.length}
              onOpen={(task) => setSelectedId(task.id)}
              onOpenExternal={handleOpenExternal}
              onNew={() => setDialog({ kind: 'create' })}
            />
          ) : section === 'history' ? (
            <HistoryView
              tasks={tasks}
              onOpen={(task) => setSelectedId(task.id)}
              onOpenExternal={handleOpenExternal}
            />
          ) : (
            <SettingsView
              settings={settings}
              onUpdate={(patch) => void updateSettings(patch)}
              devInfo={devInfo}
              onOpenFolder={() => void handleOpenFolder()}
              onExportCsv={() => void handleExport()}
            />
          )}
        </div>

        {section === 'settings' && (
          <button
            type="button"
            className="devlink"
            data-testid="open-dev-panel"
            onClick={() => setDialog({ kind: 'dev' })}
          >
            Ver el receptor local de eventos
          </button>
        )}
      </main>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          history={history}
          onClose={() => setSelectedId(null)}
          onChangeStatus={handleChangeStatus}
          onOpenExternal={handleOpenExternal}
          onEdit={(task) => {
            setSelectedId(null)
            setDialog({ kind: 'edit', task })
          }}
          onDelete={(id) => {
            void deleteTask(id).then(() => {
              setSelectedId(null)
              setToast({ message: 'Tarea eliminada.', tone: 'neutral' })
            })
          }}
        />
      )}

      {dialog?.kind === 'create' && (
        <QuickAdd
          onSubmit={(values) => void createTask(values).then((task) => task && setDialog(null))}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <QuickAdd
          editing={dialog.task}
          onSubmit={(values) => void updateTask(values).then((task) => task && setDialog(null))}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'dev' && <DevPanel onClose={() => setDialog(null)} />}

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
