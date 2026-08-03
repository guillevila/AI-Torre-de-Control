import { useCallback, useEffect, useState } from 'react'
import type { IpcResult, RecentActivityEntry, StatusHistoryEntry, Task } from '@torre/contracts'

/**
 * Única fuente de datos de la interfaz.
 *
 * Todas las vistas —Torre, Atención, Tareas, Oficina, Historial— consumen este
 * mismo hook, así que ven exactamente el mismo array en el mismo instante (D10).
 * No existe ningún otro sitio donde la interfaz guarde el estado de las tareas.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void window.torre.listTasks().then((result) => {
      if (!alive) return
      if (result.ok) setTasks(result.data)
      else setError(result.error)
      setLoading(false)
    })

    // El proceso principal empuja la lista completa cada vez que algo cambia,
    // venga de un botón o de un evento local. Por eso la pantalla se actualiza
    // sola, sin refrescar ni preguntar cada pocos segundos.
    const unsubscribe = window.torre.onTasksChanged((next) => {
      if (alive) setTasks(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const run = useCallback(async <T,>(operation: Promise<IpcResult<T>>): Promise<T | null> => {
    const result = await operation
    if (!result.ok) {
      setError(result.error)
      return null
    }
    setError(null)
    return result.data
  }, [])

  return {
    tasks,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
    createTask: useCallback((input: unknown) => run(window.torre.createTask(input)), [run]),
    updateTask: useCallback((input: unknown) => run(window.torre.updateTask(input)), [run]),
    changeStatus: useCallback((input: unknown) => run(window.torre.changeStatus(input)), [run]),
    archiveTask: useCallback((id: string) => run(window.torre.archiveTask(id)), [run]),
    deleteTask: useCallback((id: string) => run(window.torre.deleteTask(id)), [run]),
    openExternal: useCallback((id: string) => run(window.torre.openExternal(id)), [run]),
  }
}

/**
 * Historial de estados de una tarea (D19).
 *
 * Se pide bajo demanda al abrir la ficha, no viaja con cada lista: la mayoría
 * de las veces no se mira, y arrastrarlo en cada actualización sería pagar por
 * algo que casi nunca se usa.
 */
export function useTaskHistory(taskId: string | null, version: unknown) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])

  useEffect(() => {
    if (!taskId) {
      setHistory([])
      return
    }
    let alive = true
    void window.torre.taskHistory(taskId).then((result) => {
      if (alive && result.ok) setHistory(result.data)
    })
    return () => {
      alive = false
    }
    // `version` fuerza la recarga cuando la tarea cambia de estado con la ficha
    // abierta, para que el historial se vea crecer en vivo.
  }, [taskId, version])

  return history
}

/** Últimos cambios de todas las tareas. Alimenta la Torre. */
export function useRecentActivity(limit: number, version: unknown) {
  const [activity, setActivity] = useState<RecentActivityEntry[]>([])

  useEffect(() => {
    let alive = true
    void window.torre.recentActivity(limit).then((result) => {
      if (alive && result.ok) setActivity(result.data)
    })
    return () => {
      alive = false
    }
  }, [limit, version])

  return activity
}
