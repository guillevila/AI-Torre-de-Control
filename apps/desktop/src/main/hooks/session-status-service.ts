import { sessionUpdateSchema, type SessionUpdateResult } from '@torre/contracts'
import type { TaskService } from '../services/task-service.js'
import type { HookActivityLog } from './hook-activity-log.js'
import type { SessionLinker } from './session-linker.js'

/**
 * Avisos de estado que llegan de una sesión local, sin identificador de tarea.
 *
 * Se diferencia del receptor de eventos normal en una cosa: aquel exige saber a
 * qué tarea se refiere, y una herramienta como Claude Code no lo sabe — solo
 * conoce su carpeta y su sesión. Aquí se traduce eso a una tarea concreta.
 *
 * Igual que los eventos, **no ejecuta nada**: solo mueve una tarea entre estados
 * ya conocidos.
 */
export class SessionStatusService {
  constructor(
    private readonly linker: SessionLinker,
    private readonly tasks: TaskService,
    private readonly activity?: HookActivityLog,
  ) {}

  apply(raw: unknown): SessionUpdateResult {
    const parsed = sessionUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const reason = 'El aviso de sesión no cumple el contrato'
      this.activity?.record({
        event: 'aviso mal formado',
        cwd: '—',
        accepted: false,
        detail: reason,
        taskTitle: null,
      })
      return {
        accepted: false,
        reason,
        details: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || 'aviso'}: ${issue.message}`,
        ),
      }
    }

    const update = parsed.data
    const task = this.linker.resolve(update.cwd, update.sessionId)

    try {
      const moved = this.tasks.changeStatus({
        id: task.id,
        status: update.status,
        source: 'claude_hook',
        confidence: 'high',
      })
      this.activity?.record({
        event: `sesión → ${update.status}`,
        cwd: update.cwd,
        accepted: true,
        detail: `la tarea queda en «${moved.status}»`,
        taskTitle: moved.title,
      })
      return { accepted: true, taskId: moved.id, status: moved.status }
    } catch (error) {
      // Una transición que la máquina de estados rechaza no es un fallo del
      // sistema: es el sistema protegiendo una decisión tuya. Se cuenta tal cual.
      const reason = error instanceof Error ? error.message : 'No se pudo aplicar el cambio'
      this.activity?.record({
        event: `sesión → ${update.status}`,
        cwd: update.cwd,
        accepted: false,
        detail: reason,
        taskTitle: task.title,
      })
      return { accepted: false, reason }
    }
  }
}
