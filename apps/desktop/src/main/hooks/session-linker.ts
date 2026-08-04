import type { Task } from '@torre/contracts'
import { folderName, isWithinPath, pathDepth, RESTING_STATUSES, samePath } from '@torre/domain'
import type { TaskService } from '../services/task-service.js'

/** Cuántos caracteres del identificador de sesión distinguen una conversación. */
const CODIGO_SESION = 6

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
 *     ella con total seguridad. Da igual desde qué subcarpeta llegue: una
 *     conversación es siempre la misma tarea.
 *  2. **Por carpeta, si está libre.** El caso normal: tú registras la tarea con
 *     su carpeta y la sesión que trabaje ahí se asocia sola. Con tareas para
 *     `proyecto` y `proyecto/web`, una sesión en `proyecto/web/src` va a la
 *     segunda: se elige la coincidencia más específica.
 *  3. **Se crea una nueva.** Si no había tarea para esa carpeta, o si las que
 *     hay están ocupadas por otra conversación viva (D23-bis).
 *
 * ## Por qué «si está libre» (D23-bis)
 *
 * Antes, dos conversaciones abiertas en el mismo repositorio compartían tarea, y
 * cada señal **sobrescribía** el identificador de sesión de la otra. El estado
 * de la tarea acababa siendo el de la última señal que llegó, de cualquiera de
 * las dos: si una te esperaba y la otra terminaba, **el «te espera» desaparecía
 * y no te enterabas**.
 *
 * Ahora una tarea ocupada por otra conversación viva no se reutiliza: se crea
 * otra. Cada conversación tiene su icono y su estado.
 *
 * Y sigue sin acumularse basura, porque «ocupada» excluye el reposo: una tarea
 * **revisada** vuelve a estar libre y la adopta la siguiente conversación que
 * abras. Ese es el ciclo que D22 y D23 dejaron montado; lo único que cambia es
 * que dos conversaciones simultáneas ya no se pisan.
 */
export class SessionLinker {
  constructor(private readonly tasks: TaskService) {}

  resolve(cwd: string, sessionId: string | null): Task {
    const open = this.tasks.list().filter((task) => task.status !== 'archived')

    if (sessionId) {
      const bySession = open.find((task) => task.externalSessionId === sessionId)
      if (bySession) return bySession
    }

    // Candidatas por carpeta, de la más específica a la más general. La exacta
    // primero; después las que contienen a esta sesión, por profundidad.
    const candidatas: Task[] = []
    for (const task of open.filter((task) => samePath(task.projectPath, cwd))) {
      candidatas.push(task)
    }
    for (const task of open
      .filter((task) => isWithinPath(task.projectPath, cwd))
      .sort((a, b) => pathDepth(b.projectPath ?? '') - pathDepth(a.projectPath ?? ''))) {
      if (!candidatas.some((previa) => previa.id === task.id)) candidatas.push(task)
    }

    const libre = candidatas.find((task) => !this.ocupadaPorOtraConversacion(task, sessionId))
    if (libre) {
      this.rememberSession(libre, sessionId)
      return libre
    }

    return this.tasks.create({
      // Si ya hay otra conversación en este mismo proyecto, la nueva lleva el
      // código de sesión: sin él, dos tareas del mismo repositorio se llamarían
      // exactamente igual y no habría forma de distinguirlas.
      title: this.tituloPara(cwd, sessionId, candidatas.length > 0),
      provider: 'claude_code',
      projectPath: cwd,
      externalSessionId: sessionId,
      status: 'running',
      // No la registraste tú: la creó el enlace al ver trabajar a Claude Code.
      // La confianza es alta porque la señal viene de la propia herramienta.
      statusSource: 'claude_hook',
      statusConfidence: 'high',
    })
  }

  /**
   * ¿Esta tarea es de otra conversación que sigue viva? (D23-bis)
   *
   * Vive = no está en reposo. Una tarea **revisada** ya no reclama nada y vuelve
   * a estar disponible, así que abrir sesiones nuevas en un proyecto no llena la
   * oficina de iconos: los va reutilizando a medida que los revisas.
   *
   * Sin identificador de sesión no se puede distinguir nada, así que se sigue
   * emparejando por carpeta como siempre: perder una señal es peor que compartir
   * una tarea.
   */
  private ocupadaPorOtraConversacion(task: Task, sessionId: string | null): boolean {
    if (!sessionId) return false
    if (!task.externalSessionId) return false
    if (task.externalSessionId === sessionId) return false
    return !RESTING_STATUSES.includes(task.status)
  }

  private tituloPara(cwd: string, sessionId: string | null, hayOtra: boolean): string {
    const base = `Claude Code · ${folderName(cwd)}`
    if (!hayOtra || !sessionId) return base
    return `${base} · ${sessionId.slice(0, CODIGO_SESION)}`
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
