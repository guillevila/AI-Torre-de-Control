import type { Task, TaskStatus } from '@torre/contracts'

/**
 * Lógica de avisos, sin nada de Electron dentro.
 *
 * Está separada del envío real para poder probarla con Node normal: los tests
 * comprueban QUÉ se avisaría y cuántas veces, sin abrir ninguna ventana.
 */

export interface NotificationMessage {
  title: string
  body: string
  taskId: string
}

/**
 * Segunda barrera anti-duplicados.
 *
 * La primera está en la máquina de estados (solo avisa si el estado cambia de
 * verdad). Esta cubre el caso de que dos caminos distintos —por ejemplo, el
 * botón de la interfaz y un evento local que llega a la vez— pidan avisar del
 * mismo cambio.
 */
export class NotificationDeduplicator {
  private readonly lastNotified = new Map<string, TaskStatus>()

  shouldSend(taskId: string, status: TaskStatus): boolean {
    if (this.lastNotified.get(taskId) === status) return false
    this.lastNotified.set(taskId, status)
    return true
  }

  /** Al reabrirse una tarea, el aviso de su próximo cierre vuelve a ser válido. */
  forget(taskId: string): void {
    this.lastNotified.delete(taskId)
  }
}

const TITLES: Partial<Record<TaskStatus, string>> = {
  waiting_user: 'Te están esperando',
  completed: 'Tarea terminada',
  failed: 'Tarea fallida',
}

export function buildNotification(task: Task): NotificationMessage | null {
  const title = TITLES[task.status]
  if (!title) return null

  const bodies: Partial<Record<TaskStatus, string>> = {
    waiting_user: `«${task.title}» necesita que intervengas.`,
    completed: `«${task.title}» ha terminado.`,
    failed: `«${task.title}» ha fallado.`,
  }

  return { title, body: bodies[task.status] ?? task.title, taskId: task.id }
}

/**
 * Construye la función de aviso que usa el servicio de tareas.
 *
 * `show` es lo único específico del sistema operativo, y se inyecta desde
 * fuera. En los tests se sustituye por una función que solo apunta lo recibido.
 */
export function createNotifier(
  show: (message: NotificationMessage) => void,
  deduplicator: NotificationDeduplicator = new NotificationDeduplicator(),
): (task: Task) => void {
  return (task: Task) => {
    const message = buildNotification(task)
    if (!message) {
      // La tarea salió de un estado avisable: se olvida para que el próximo
      // cierre vuelva a notificarse.
      deduplicator.forget(task.id)
      return
    }
    if (!deduplicator.shouldSend(task.id, task.status)) return
    show(message)
  }
}
