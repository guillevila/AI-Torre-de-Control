import { taskIntakeSchema, type TaskIntakeResult } from '@torre/contracts'
import { detectProvider } from '@torre/domain'
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

    // Ya registrada: se devuelve la que hay. Se miran también las archivadas,
    // porque revivir una archivada es más honesto que crear una gemela.
    const existente = this.tasks.list().find((task) => sameConversation(task.externalUrl, externalUrl))
    if (existente) {
      return {
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
}

/**
 * ¿Son la misma conversación?
 *
 * Se comparan sin el fragmento (`#...`) ni la barra final, porque el navegador
 * los añade y quita solo mientras navegas: `…/c/abc`, `…/c/abc/` y `…/c/abc#x`
 * son la misma página, y tratarlas como distintas duplicaría la tarea.
 *
 * Los parámetros (`?...`) SÍ cuentan: hay herramientas que identifican la
 * conversación por ahí, y unirlas sería peor que separarlas.
 */
function sameConversation(a: string | null, b: string): boolean {
  if (!a) return false
  return canonical(a) === canonical(b)
}

function canonical(url: string): string {
  try {
    const parsed = new URL(url.trim())
    parsed.hash = ''
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`
  } catch {
    return url.trim()
  }
}
