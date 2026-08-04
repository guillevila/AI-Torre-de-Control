import type { RecentActivityEntry, StatusHistoryEntry, Task } from '@torre/contracts'

/**
 * Puerto de persistencia.
 *
 * El resto de la aplicación solo conoce esta interfaz, nunca SQLite. Gracias a
 * eso el motor de base de datos se puede cambiar sin tocar el dominio ni la
 * interfaz — que es justo lo que hubo que hacer al descartar `better-sqlite3`
 * (ver docs/decisiones/ADR-002).
 */

/** Una línea de historial recién nacida, antes de que la base le dé número. */
export type NewHistoryEntry = Omit<StatusHistoryEntry, 'id'>

export interface TaskRepository {
  list(): Task[]
  findById(id: string): Task | null
  /** Inserta o actualiza. La tarea siempre llega ya validada por el dominio. */
  save(task: Task): void
  remove(id: string): void

  /** Registra un cambio de estado en el historial (D19). */
  appendHistory(entry: NewHistoryEntry): void
  /** Historial completo de una tarea, del más reciente al más antiguo. */
  historyFor(taskId: string): StatusHistoryEntry[]
  /** Últimos cambios de todas las tareas, para el panel de actividad reciente. */
  recentActivity(limit: number): RecentActivityEntry[]

  close(): void
}

/**
 * Implementación en memoria, para tests.
 *
 * Permite probar el servicio de tareas sin tocar el disco y sin depender de
 * SQLite, de modo que los tests tardan milisegundos.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>()
  private readonly history: StatusHistoryEntry[] = []
  private nextHistoryId = 1

  list(): Task[] {
    return [...this.tasks.values()]
  }

  findById(id: string): Task | null {
    return this.tasks.get(id) ?? null
  }

  save(task: Task): void {
    this.tasks.set(task.id, task)
  }

  remove(id: string): void {
    this.tasks.delete(id)
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      if (this.history[index]?.taskId === id) this.history.splice(index, 1)
    }
  }

  appendHistory(entry: NewHistoryEntry): void {
    this.history.push({ ...entry, id: this.nextHistoryId++ })
  }

  historyFor(taskId: string): StatusHistoryEntry[] {
    return this.history
      .filter((entry) => entry.taskId === taskId)
      .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
  }

  recentActivity(limit: number): RecentActivityEntry[] {
    return this.history
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
      .slice(0, limit)
      .flatMap((entry) => {
        const task = this.tasks.get(entry.taskId)
        return task ? [{ ...entry, taskTitle: task.title, provider: task.provider }] : []
      })
  }

  close(): void {
    this.tasks.clear()
    this.history.length = 0
  }
}
