import { webActivitySchema, type WebActivityResult } from '@torre/contracts'
import { sameConversation } from '@torre/domain'
import type { TaskService } from '../services/task-service.js'

/**
 * Mueve una tarea al detectar que su conversación empieza o termina.
 *
 * Es la etapa 2 del enlace con el navegador: tú registras la conversación una
 * vez, y a partir de ahí el estado se mueve solo.
 *
 * Tres decisiones que gobiernan esta pieza:
 *
 *  1. **No crea tareas.** Si la conversación no está registrada, se ignora sin
 *     ruido. Registrar sigue siendo tuyo: el vigilante puede estar mirando una
 *     pestaña que nunca diste de alta, y llenarte la Torre de tareas que no
 *     pediste sería peor que no hacer nada.
 *  2. **Confianza media, no alta.** Lo que se ha visto es una página web
 *     dejando de generar texto. Es una inferencia buena, pero es una
 *     inferencia: la herramienta no ha dicho «he terminado» (D8).
 *  3. **Respeta lo que decidiste tú.** Si marcaste una tarea como terminada o
 *     revisada, el vigilante no se la lleva de vuelta a «trabajando» por su
 *     cuenta — de eso ya se encarga la máquina de estados, y aquí no se la
 *     puentea.
 */
export interface WebActivityServiceDeps {
  taskService: TaskService
}

export class WebActivityService {
  private readonly tasks: TaskService

  constructor(deps: WebActivityServiceDeps) {
    this.tasks = deps.taskService
  }

  apply(raw: unknown): WebActivityResult {
    const parsed = webActivitySchema.safeParse(raw)
    if (!parsed.success) {
      return {
        accepted: false,
        reason: parsed.error.issues[0]?.message ?? 'Los datos no cumplen el contrato',
      }
    }

    const { externalUrl, status } = parsed.data

    const tarea = this.tasks
      .list()
      .find((task) => task.status !== 'archived' && sameConversation(task.externalUrl, externalUrl))

    if (!tarea) {
      // No es un error: esa conversación no está registrada, y no se registra
      // sola. Se contesta que sí para que el vigilante no lo trate como fallo.
      return { accepted: true, matched: false }
    }

    try {
      const actualizada = this.tasks.changeStatus({
        id: tarea.id,
        status,
        source: 'browser_extension',
        confidence: 'medium',
      })
      return { accepted: true, matched: true, taskId: actualizada.id, status: actualizada.status }
    } catch {
      // La máquina de estados ha dicho que no: o la transición no tiene sentido
      // desde donde estaba, o lo fijaste tú a mano y manda tu decisión. En
      // ambos casos la señal se descarta sin tocar nada.
      return { accepted: true, matched: true, taskId: tarea.id, status: tarea.status }
    }
  }
}
