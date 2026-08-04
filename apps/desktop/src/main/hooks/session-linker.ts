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
 * ## Y por qué no se acumulan iconos
 *
 * «Ocupada» exige que la otra conversación siga VIVA. Una tarea queda libre —y
 * la adopta la siguiente conversación que se abra en su carpeta— en dos casos:
 *
 *  - Su conversación **terminó** (`sessionEnded`, el evento SessionEnd del
 *    enlace). Cerrar una sesión y abrir otra recicla el muñeco en vez de dejar
 *    uno huérfano por reinicio.
 *  - La marcaste **revisada** (D22): ya no reclama nada.
 *
 * La adopción conserva la tarea —su historial incluido— y solo cambia de
 * conversación. Lo entregado y aún sin revisar sigue en la mesa de entregas
 * hasta que se adopta o lo revisas: reciclar no es descartar.
 */
export class SessionLinker {
  constructor(private readonly tasks: TaskService) {}

  /**
   * `ending` marca si esta señal es el CIERRE de la sesión (SessionEnd). Todas
   * las demás señales prueban que la conversación sigue viva, y así se anota:
   * es lo que corrige solas a las tareas que la migración v3 marcó como
   * terminadas sin serlo.
   */
  resolve(cwd: string, sessionId: string | null, { ending = false } = {}): Task {
    const open = this.tasks.list().filter((task) => task.status !== 'archived')

    if (sessionId) {
      const bySession = open.find((task) => task.externalSessionId === sessionId)
      if (bySession) return this.anotarVida(bySession, ending)
    }

    // Candidatas por carpeta, de la más específica a la más general. La exacta
    // primero —las más recientes antes, para que una adopción continúe el
    // trabajo de ayer y no resucite uno de hace un mes—; después las carpetas
    // que contienen a esta sesión, por profundidad.
    const candidatas: Task[] = []
    for (const task of open
      .filter((task) => samePath(task.projectPath, cwd))
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))) {
      candidatas.push(task)
    }
    for (const task of open
      .filter((task) => isWithinPath(task.projectPath, cwd))
      .sort((a, b) => pathDepth(b.projectPath ?? '') - pathDepth(a.projectPath ?? ''))) {
      if (!candidatas.some((previa) => previa.id === task.id)) candidatas.push(task)
    }

    const libre = candidatas.find((task) => !this.ocupadaPorOtraConversacion(task, sessionId))
    if (libre) return this.adoptar(libre, sessionId, ending)

    return this.tasks.create({
      // Si ya hay otra conversación en este mismo proyecto, la nueva lleva el
      // código de sesión: sin él, dos tareas del mismo repositorio se llamarían
      // exactamente igual y no habría forma de distinguirlas.
      title: this.tituloPara(cwd, sessionId, candidatas.length > 0),
      provider: 'claude_code',
      projectPath: cwd,
      externalSessionId: sessionId,
      sessionEnded: ending,
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
   * Sin identificador de sesión no se puede distinguir nada, así que se sigue
   * emparejando por carpeta como siempre: perder una señal es peor que compartir
   * una tarea.
   */
  private ocupadaPorOtraConversacion(task: Task, sessionId: string | null): boolean {
    if (!sessionId) return false
    if (!task.externalSessionId) return false
    if (task.externalSessionId === sessionId) return false
    if (task.sessionEnded) return false
    return !RESTING_STATUSES.includes(task.status)
  }

  private tituloPara(cwd: string, sessionId: string | null, hayOtra: boolean): string {
    const base = `Claude Code · ${folderName(cwd)}`
    if (!hayOtra || !sessionId) return base
    return `${base} · ${sessionId.slice(0, CODIGO_SESION)}`
  }

  /** La señal de una conversación conocida anota si sigue viva o acaba de cerrar. */
  private anotarVida(task: Task, ending: boolean): Task {
    if (task.sessionEnded === ending) return task
    try {
      return this.tasks.update({ id: task.id, sessionEnded: ending })
    } catch {
      return task
    }
  }

  /**
   * Una conversación se queda una tarea libre: identificador nuevo, y si el
   * título llevaba el código de la conversación anterior, se actualiza — un
   * código viejo bajo el muñeco diría que sigue allí una conversación que ya
   * no existe. Los títulos puestos a mano no se tocan.
   */
  private adoptar(task: Task, sessionId: string | null, ending: boolean): Task {
    const cambios: { id: string; externalSessionId?: string; sessionEnded?: boolean; title?: string } = {
      id: task.id,
    }
    if (sessionId && task.externalSessionId !== sessionId) {
      cambios.externalSessionId = sessionId
      const codigoViejo = task.externalSessionId?.slice(0, CODIGO_SESION)
      if (codigoViejo && task.title.endsWith(` · ${codigoViejo}`)) {
        cambios.title = `${task.title.slice(0, -codigoViejo.length)}${sessionId.slice(0, CODIGO_SESION)}`
      }
    }
    if (task.sessionEnded !== ending) cambios.sessionEnded = ending
    if (cambios.externalSessionId === undefined && cambios.sessionEnded === undefined) return task
    try {
      return this.tasks.update(cambios)
    } catch {
      // Si no se puede guardar, no es motivo para tumbar la señal que venía.
      return task
    }
  }
}
