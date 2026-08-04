import type { Task } from '@torre/contracts'
import { folderName, samePath } from '@torre/domain'
import type { TaskService } from '../services/task-service.js'

/**
 * Averigua a qué tarea pertenece una sesión de una herramienta local.
 *
 * Es la pieza que hace que no tengas que registrar a mano las tareas de Claude
 * Code: la sesión dice desde qué carpeta trabaja, y aquí se busca —o se crea—
 * la tarea que le corresponde.
 *
 * Orden de búsqueda, del más fiable al más general:
 *
 *  1. **Por identificador de sesión.** Si una tarea ya lo tiene guardado, es
 *     ella con total seguridad.
 *  2. **Por carpeta de proyecto.** El caso normal: tú registras la tarea con su
 *     carpeta, y todas las sesiones que trabajen ahí se asocian solas.
 *  3. **Se crea una nueva.** Así una sesión que empieza sin tarea registrada
 *     aparece igualmente en la Torre, en lugar de perderse.
 *
 * El paso 3 es deliberado: perder una señal es peor que tener una tarea de más,
 * porque una tarea de más se archiva en un clic y una señal perdida no se
 * recupera nunca.
 */
export class SessionLinker {
  constructor(private readonly tasks: TaskService) {}

  resolve(cwd: string, sessionId: string | null): Task {
    const open = this.tasks.list().filter((task) => task.status !== 'archived')

    if (sessionId) {
      const bySession = open.find((task) => task.externalSessionId === sessionId)
      if (bySession) return bySession
    }

    const byPath = open.find((task) => samePath(task.projectPath, cwd))
    if (byPath) {
      this.rememberSession(byPath, sessionId)
      return byPath
    }

    return this.tasks.create({
      title: `Claude Code · ${folderName(cwd)}`,
      provider: 'claude_code',
      projectPath: cwd,
      externalSessionId: sessionId,
      status: 'running',
    })
  }

  /** Guarda el identificador de sesión la primera vez que se conoce. */
  private rememberSession(task: Task, sessionId: string | null): void {
    if (!sessionId || task.externalSessionId === sessionId) return
    try {
      this.tasks.update({ id: task.id, externalSessionId: sessionId })
    } catch {
      // Si no se puede guardar, no es motivo para tumbar la señal que venía.
    }
  }
}
