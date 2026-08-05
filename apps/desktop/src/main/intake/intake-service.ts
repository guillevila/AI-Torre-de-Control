import { taskIntakeSchema, type Task, type TaskIntakeResult } from '@torre/contracts'
import { detectProvider, sameConversation } from '@torre/domain'
import type { TaskService } from '../services/task-service.js'

/**
 * Da de alta una tarea que llega de fuera —hoy, de la extensión de navegador.
 *
 * Hace tres cosas y ninguna más:
 *
 *  1. **Valida contra el contrato**, que solo admite título y dirección. Un
 *     campo de más y la petición entera se rechaza.
 *  2. **Deduce la plataforma de la dirección**, sin fiarse de quien envía. Si no
 *     reconoce el dominio, la marca como `other` en lugar de inventarse una.
 *  3. **No duplica**: si ya existe una tarea con esa misma dirección, devuelve
 *     esa. Pulsar dos veces sobre la misma conversación no debe llenarte la
 *     Torre de tareas repetidas.
 *
 * La tarea nace en `queued` —«encargada, aún sin señal de que esté trabajando»—
 * y con confianza `low`: lo único que sabemos de verdad es que TÚ la registraste
 * desde el navegador. Que ChatGPT esté trabajando o haya terminado no lo sabe
 * nadie todavía; fingir otra cosa sería el peor error posible en esta
 * aplicación (D8).
 */
export interface IntakeServiceDeps {
  taskService: TaskService
}

export class IntakeService {
  private readonly tasks: TaskService

  constructor(deps: IntakeServiceDeps) {
    this.tasks = deps.taskService
  }

  register(raw: unknown): TaskIntakeResult {
    const parsed = taskIntakeSchema.safeParse(raw)
    if (!parsed.success) {
      return {
        accepted: false,
        reason: parsed.error.issues[0]?.message ?? 'Los datos no cumplen el contrato',
      }
    }

    const { title, externalUrl } = parsed.data

    const existente = this.tasks.list().find((task) => sameConversation(task.externalUrl, externalUrl))
    if (existente) {
      return existente.status === 'archived'
        ? this.recuperar(existente)
        : {
            accepted: true,
            duplicate: true,
            taskId: existente.id,
            title: existente.title,
            provider: existente.provider,
            status: existente.status,
          }
    }

    const created = this.tasks.create({
      title,
      // Sin dominio reconocido no se inventa plataforma: `other` es la verdad.
      provider: detectProvider(externalUrl) ?? 'other',
      externalUrl,
      status: 'queued',
      statusSource: 'browser_extension',
      statusConfidence: 'low',
    })

    return {
      accepted: true,
      duplicate: false,
      taskId: created.id,
      title: created.title,
      provider: created.provider,
      status: created.status,
    }
  }

  /**
   * Trae de vuelta una conversación que estaba archivada.
   *
   * Una tarea archivada no aparece en ninguna pantalla. Contestar «ya la tienes»
   * sin desarchivarla deja al usuario buscando algo que no puede ver: una
   * respuesta cierta y a la vez inservible, que es la peor clase de respuesta.
   *
   * Se desarchiva como **manual**, no como `browser_extension`, y la diferencia
   * es de fondo: el vigilante *infiere* estados mirando una página, pero esto es
   * un clic tuyo en un botón que dice «Registrar en la Torre». Eso es una
   * decisión humana, y por eso puede levantar el candado que protege lo que
   * archivaste a mano — un candado que existe precisamente para que ninguna
   * señal automática lo haga sola.
   */
  private recuperar(task: Task): TaskIntakeResult {
    try {
      const recuperada = this.tasks.changeStatus({
        id: task.id,
        status: 'queued',
        source: 'manual',
        confidence: 'high',
      })
      return {
        accepted: true,
        duplicate: true,
        revived: true,
        taskId: recuperada.id,
        title: recuperada.title,
        provider: recuperada.provider,
        status: recuperada.status,
      }
    } catch {
      // Si la máquina de estados se negara, es mejor decir la verdad —«existe,
      // pero archivada»— que fingir que se ha recuperado.
      return {
        accepted: true,
        duplicate: true,
        revived: false,
        taskId: task.id,
        title: task.title,
        provider: task.provider,
        status: task.status,
      }
    }
  }
}

