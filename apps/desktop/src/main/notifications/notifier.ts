import type { Task, TaskStatus } from '@torre/contracts'

/**
 * Lógica de avisos, sin nada de Electron dentro.
 *
 * Está separada del envío real para poder probarla con Node normal: los tests
 * comprueban QUÉ se avisaría y cuándo, sin abrir ninguna ventana.
 */

export interface NotificationMessage {
  title: string
  body: string
  taskId: string
}

/**
 * Cuánto se espera antes de avisar de que una tarea te reclama.
 *
 * No es un capricho. Con el enlace de Claude Code, cada turno del asistente
 * termina en «te espera»: si estás delante de la terminal contestando, te
 * lloverían avisos por algo que ya estás atendiendo, y acabarías apagándolos.
 *
 * Esperando un poco, el aviso solo sale si de verdad te has ido. Si vuelves y
 * escribes antes, la tarea pasa a «trabajando» y el aviso se cancela sin haber
 * llegado a molestar.
 *
 * Los estados finales —terminada, fallida— no esperan: ahí no hay nada que
 * atender en caliente, y saber que ha acabado es justo lo que quieres.
 */
export const WAITING_NOTICE_DELAY_MS = 45_000

/**
 * Segunda barrera anti-duplicados.
 *
 * La primera está en la máquina de estados (solo avisa si el estado cambia de
 * verdad). Esta cubre el caso de que dos caminos distintos pidan avisar del
 * mismo cambio.
 */
export class NotificationDeduplicator {
  private readonly lastNotified = new Map<string, TaskStatus>()

  shouldSend(taskId: string, status: TaskStatus): boolean {
    if (this.lastNotified.get(taskId) === status) return false
    this.lastNotified.set(taskId, status)
    return true
  }

  /** Al salir de un estado avisable, su próximo aviso vuelve a ser válido. */
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

export interface NotifierOptions {
  /**
   * Espera antes de avisar de «te espera». 0 avisa al momento.
   *
   * Admite una función para poder leer el ajuste vigente en cada aviso, en
   * lugar de quedarse con el que hubiera al arrancar.
   */
  waitingDelayMs?: number | (() => number)
  deduplicator?: NotificationDeduplicator
}

/**
 * Construye la función que el servicio de tareas llama en CADA cambio de estado.
 *
 * Recibe también si ese cambio merecía aviso, porque necesita enterarse de
 * todos los cambios —no solo de los avisables— para poder cancelar un aviso
 * que ya no tiene sentido.
 *
 * `show` es lo único específico del sistema operativo, y se inyecta desde
 * fuera. En los tests se sustituye por una función que solo apunta lo recibido.
 */
export function createNotifier(
  show: (message: NotificationMessage) => void,
  options: NotifierOptions = {},
): (task: Task, notify: boolean) => void {
  const delayOption = options.waitingDelayMs ?? WAITING_NOTICE_DELAY_MS
  const waitingDelay = (): number =>
    typeof delayOption === 'function' ? delayOption() : delayOption
  const deduplicator = options.deduplicator ?? new NotificationDeduplicator()
  const pending = new Map<string, NodeJS.Timeout>()

  const cancel = (taskId: string): void => {
    const timer = pending.get(taskId)
    if (!timer) return
    clearTimeout(timer)
    pending.delete(taskId)
  }

  return (task: Task, notify: boolean) => {
    // Cualquier cambio de estado invalida un aviso que estuviera esperando:
    // si la tarea ya no está donde estaba, el aviso ya no describe la realidad.
    cancel(task.id)

    const message = buildNotification(task)
    if (!message) {
      // Salió de un estado avisable: se olvida para que la próxima vez avise.
      deduplicator.forget(task.id)
      return
    }

    if (!notify) return

    const delay = waitingDelay()
    if (task.status === 'waiting_user' && delay > 0) {
      const timer = setTimeout(() => {
        pending.delete(task.id)
        if (deduplicator.shouldSend(task.id, task.status)) show(message)
      }, delay)
      // No debe impedir que la aplicación se cierre.
      timer.unref?.()
      pending.set(task.id, timer)
      return
    }

    if (deduplicator.shouldSend(task.id, task.status)) show(message)
  }
}
