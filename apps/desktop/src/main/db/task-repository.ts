import type { Task } from '@torre/contracts'

/**
 * Puerto de persistencia.
 *
 * El resto de la aplicación solo conoce esta interfaz, nunca SQLite. Gracias a
 * eso el motor de base de datos se puede cambiar sin tocar el dominio ni la
 * interfaz — que es justo lo que hubo que hacer en este sprint al descartar
 * `better-sqlite3` (ver docs/decisiones/ADR-002).
 */
export interface TaskRepository {
  list(): Task[]
  findById(id: string): Task | null
  /** Inserta o actualiza. La tarea siempre llega ya validada por el dominio. */
  save(task: Task): void
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

  list(): Task[] {
    return [...this.tasks.values()]
  }

  findById(id: string): Task | null {
    return this.tasks.get(id) ?? null
  }

  save(task: Task): void {
    this.tasks.set(task.id, task)
  }

  close(): void {
    this.tasks.clear()
  }
}
