import { useCallback, useEffect, useState } from 'react'
import type { IpcResult, Task } from '@torre/contracts'

/**
 * Única fuente de datos de la interfaz.
 *
 * La vista operativa y la vista oficina consumen este mismo hook, así que las
 * dos ven exactamente el mismo array de tareas en el mismo instante (D10).
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
    // sola sin necesidad de refrescar ni de preguntar cada pocos segundos.
    const unsubscribe = window.torre.onTasksChanged((next) => {
      if (alive) setTasks(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  /** Ejecuta una operación y deja el mensaje de error a la vista si falla. */
  const run = useCallback(async <T,>(operation: Promise<IpcResult<T>>): Promise<T | null> => {
    const result = await operation
    if (!result.ok) {
      setError(result.error)
      return null
    }
    setError(null)
    return result.data
  }, [])

  const createTask = useCallback(
    (input: unknown) => run(window.torre.createTask(input)),
    [run],
  )
  const updateTask = useCallback(
    (input: unknown) => run(window.torre.updateTask(input)),
    [run],
  )
  const changeStatus = useCallback(
    (input: unknown) => run(window.torre.changeStatus(input)),
    [run],
  )
  const archiveTask = useCallback((id: string) => run(window.torre.archiveTask(id)), [run])
  const openExternal = useCallback((id: string) => run(window.torre.openExternal(id)), [run])

  return {
    tasks,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
    createTask,
    updateTask,
    changeStatus,
    archiveTask,
    openExternal,
  }
}
