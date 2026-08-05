import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DevInfo, StatusConfidence, Task, TaskStatus } from '@torre/contracts'
import { filterTasks, summarise, type TaskFilters } from '@torre/domain'
import { DevPanel } from './components/DevPanel.js'
import { PermissionCard } from './components/PermissionCard.js'
import { QuickAdd } from './components/QuickAdd.js'
import { Sidebar, type Section } from './components/Sidebar.js'
import { SettingsDialog } from './components/SettingsDialog.js'
import { TaskDetail } from './components/TaskDetail.js'
import { Toast } from './components/Toast.js'
import { TopBar, type ViewMode } from './components/TopBar.js'
import { useClock } from './hooks/useClock.js'
import { useHotkeys } from './hooks/useHotkeys.js'
import { usePermissions } from './hooks/usePermissions.js'
import { useSettings } from './hooks/useSettings.js'
import { useRecentActivity, useTaskHistory, useTasks } from './hooks/useTasks.js'
import { AttentionView } from './views/AttentionView.js'
import { HistoryView } from './views/HistoryView.js'
import { OfficeView } from './views/office/OfficeView.js'
import { TasksView } from './views/TasksView.js'
import { TowerView } from './views/TowerView.js'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; task: Task }
  | { kind: 'dev' }
  | { kind: 'settings' }
  | null

/**
 * Ajustes no está aquí a propósito: ya no es una sección, es una ventana
 * flotante. Estas cabeceras describen sitios a los que la aplicación te LLEVA;
 * un panel que se abre encima y se cierra no te lleva a ninguna parte.
 */
const TITLES: Record<Exclude<Section, 'settings'>, { title: string; subtitle: string }> = {
  tower: { title: 'Torre de control', subtitle: 'Qué está pasando ahora mismo' },
  attention: { title: 'Centro de atención', subtitle: 'Lo que espera una decisión tuya' },
  tasks: { title: 'Tareas', subtitle: 'Todo lo delegado, agrupado por urgencia' },
  history: { title: 'Historial', subtitle: 'Lo que ya has retirado de la vista activa' },
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
  const {
    pending: permissions,
    decide: decidePermission,
    error: permissionError,
    clearError: clearPermissionError,
  } = usePermissions()

  // El tipo dice que Ajustes no cabe aquí, así que ninguna ruta futura puede
  // volver a convertirlo en pantalla completa sin que el compilador lo pare.
  const [section, setSection] = useState<Exclude<Section, 'settings'>>('tower')
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

  // Hace avanzar los cronómetros y los «hace 3 min» sin esperar a que cambie
  // ninguna tarea. Cuando hay un permiso esperando late cada segundo, porque su
  // cuenta atrás tiene que verse moverse; el resto del tiempo, cada 30.
  const now = useClock(permissions.length > 0 ? 1_000 : 30_000)

  // Los ajustes deciden dónde arranca la aplicación, pero solo la primera vez:
  // después manda lo que el usuario esté mirando.
  //
  // «Ajustes» sigue cabiendo en el dato guardado —hubo un tiempo en que era una
  // sección— y hoy ya no es un sitio donde se pueda estar. Se traduce a la
  // Torre al aplicarlo, en lugar de estrechar el contrato: un ajuste guardado
  // que de pronto deja de validar es una aplicación que no abre.
  useEffect(() => {
    if (!settingsLoaded || appliedPreferences) return
    setSection(settings.startSection === 'settings' ? 'tower' : settings.startSection)
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
    /*
     * La fábrica ocupa la pantalla entera.
     *
     * Sin barra lateral y sin cabecera: es una sala de control, y una sala de
     * control se mira de lejos. Los menús alrededor competían con lo único que
     * hay que ver —quién trabaja y quién te espera— y además chocaban con el
     * tema oscuro.
     *
     * Desde ahí solo hay dos salidas, y están dentro de la propia fábrica: la
     * rueda lleva a Ajustes, y la consola de mando al detalle de todo. En el
     * resto de secciones la barra lateral vuelve, así que nunca se queda uno
     * encerrado.
     */
    <div className={officeMode ? 'app app--fabrica' : 'app'}>
      {!officeMode && (
        <Sidebar
          section={section}
          onNavigate={(next) =>
            next === 'settings' ? setDialog({ kind: 'settings' }) : setSection(next)
          }
          onNew={() => setDialog({ kind: 'create' })}
          attentionCount={summary.attention}
          devInfo={devInfo}
        />
      )}

      <main className="main">
        {!officeMode && (
          <TopBar
            ref={searchRef}
            title={TITLES[section].title}
            subtitle={TITLES[section].subtitle}
            showSwitch={showSwitch}
            view={view}
            onView={setView}
            search={search}
            onSearch={setSearch}
          />
        )}

        {error && (
          <div className="banner" role="alert" data-testid="error-banner">
            <span>{error}</span>
            <button type="button" className="btn btn--icon" onClick={clearError} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}

        {permissionError && (
          <div className="banner" role="alert" data-testid="permission-error">
            <span>{permissionError}</span>
            <button
              type="button"
              className="btn btn--icon"
              onClick={clearPermissionError}
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/*
          Los permisos van por encima del contenido y se ven desde CUALQUIER
          sección. Algo que tiene una herramienta parada esperándote no puede
          depender de en qué pantalla estés mirando.
        */}
        {permissions.length > 0 && (
          <div className="permissions" data-testid="permissions">
            {permissions.map((permission) => (
              <PermissionCard
                key={permission.requestId}
                permission={permission}
                now={now}
                onDecide={(requestId, decision) => void decidePermission(requestId, decision)}
              />
            ))}
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
            <OfficeView
              tasks={visibleTasks}
              activity={activity}
              onSelect={(task) => setSelectedId(task.id)}
              // La rueda abre los ajustes ENCIMA de la nave. Antes te sacaba de
              // ella, y volver costaba dos pasos para tocar un interruptor.
              onOpenSettings={() => setDialog({ kind: 'settings' })}
              onOpenTower={() => {
                setView('operations')
                setSection('tower')
              }}
            />
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
          ) : (
            <HistoryView
              tasks={tasks}
              onOpen={(task) => setSelectedId(task.id)}
              onOpenExternal={handleOpenExternal}
            />
          )}
        </div>
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
      {dialog?.kind === 'settings' && (
        <SettingsDialog
          settings={settings}
          onUpdate={(patch) => void updateSettings(patch)}
          devInfo={devInfo}
          onOpenFolder={() => void handleOpenFolder()}
          onExportCsv={() => void handleExport()}
          onOpenDevPanel={() => setDialog({ kind: 'dev' })}
          onClose={() => setDialog(null)}
        />
      )}
      {/*
        El receptor solo se abre desde dentro de Ajustes, así que al cerrarlo se
        vuelve allí. Devolver a la pantalla de fondo haría perder el sitio.
      */}
      {dialog?.kind === 'dev' && <DevPanel onClose={() => setDialog({ kind: 'settings' })} />}

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
