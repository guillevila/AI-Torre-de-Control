import { handoffRequestSchema, type HandoffResolution, type Settings } from '@torre/contracts'
import type { HookActivityLog } from '../hooks/hook-activity-log.js'
import type { SessionLinker } from '../hooks/session-linker.js'
import type { TaskService } from '../services/task-service.js'
import type { HandoffRegistry } from './handoff-registry.js'

/**
 * Convierte el final de un turno de Claude Code en algo a lo que puedas
 * contestar sin abrir la terminal (D24).
 *
 * Lo que hace, por orden:
 *  1. Si la función está apagada, suelta **al instante**. Esto es lo primero de
 *     todo por un motivo importante: el enlace está reteniendo el turno de
 *     Claude mientras espera esta respuesta. Con la función apagada, ese coste
 *     tiene que ser de milisegundos, no de una espera.
 *  2. Encuentra a qué tarea pertenece la sesión —o crea una si es la primera vez.
 *  3. Enseña lo que Claude te dijo y se queda esperando a que escribas.
 *  4. Si escribes, lo devuelve y deja la tarea trabajando otra vez.
 *
 * El estado de la tarea NO se toca al llegar la entrega. El enlace ya la ha
 * puesto en «terminada» por su cuenta, y eso es cierto: te ha entregado algo.
 * Solo vuelve a «trabajando» si le contestas, porque entonces vuelve a estarlo.
 *
 * **Nada de lo que pasa por aquí se escribe en disco.** Ni el mensaje de Claude,
 * ni lo que tú respondes. El cuaderno de actividad recibe cuántos caracteres
 * había, nunca cuáles.
 */
export interface HandoffServiceDeps {
  registry: HandoffRegistry
  linker: SessionLinker
  taskService: TaskService
  /** Se lee en cada entrega: el ajuste puede cambiar sin reiniciar. */
  getSettings: () => Settings
  activity?: HookActivityLog
  now?: () => string
}

export class HandoffService {
  private readonly registry: HandoffRegistry
  private readonly linker: SessionLinker
  private readonly tasks: TaskService
  private readonly getSettings: () => Settings
  private readonly activity: HookActivityLog | undefined
  private readonly now: () => string

  constructor(deps: HandoffServiceDeps) {
    this.registry = deps.registry
    this.linker = deps.linker
    this.tasks = deps.taskService
    this.getSettings = deps.getSettings
    this.activity = deps.activity
    this.now = deps.now ?? (() => new Date().toISOString())
  }

  /**
   * Atiende una entrega. La promesa no se resuelve hasta que contestas, la
   * sueltas o se agota el tiempo, porque quien llama —el receptor HTTP—
   * mantiene la conexión abierta esperando, y con ella el turno de Claude.
   */
  async request(raw: unknown): Promise<HandoffResolution> {
    const settings = this.getSettings()

    // Apagada: se suelta antes incluso de mirar qué ha llegado. Un turno no se
    // retiene ni un instante por una función que nadie ha encendido.
    if (!settings.replyFromTower) {
      return {
        outcome: 'release',
        reply: null,
        reason: 'Contestar desde la Torre está apagado en los Ajustes',
      }
    }

    const parsed = handoffRequestSchema.safeParse(raw)
    if (!parsed.success) {
      // Ante una entrega mal formada se suelta, no se devuelve un error: así
      // Claude termina su turno con normalidad en vez de quedarse colgado.
      const reason = `Entrega mal formada: ${parsed.error.issues[0]?.message ?? 'datos no válidos'}`
      this.activity?.record({
        event: 'entrega mal formada',
        cwd: '—',
        accepted: false,
        detail: reason,
        taskTitle: null,
      })
      return { outcome: 'release', reply: null, reason }
    }

    const input = parsed.data
    const task = this.linker.resolve(input.cwd, input.sessionId)

    /*
     * El cuaderno recibe el TAMAÑO, nunca el texto.
     *
     * Es la misma cautela que ya salvó al cuaderno de permisos de convertirse en
     * un registro de todo lo que se escribe en disco. Aquí es más importante
     * todavía: lo que pasa por este canal es literalmente la conversación.
     */
    this.activity?.record({
      event: 'fin de turno',
      cwd: input.cwd,
      accepted: true,
      detail: `esperando tu respuesta · ${input.message.length} caracteres entregados`,
      taskTitle: task.title,
    })

    const resolution = await this.registry.await({
      requestId: input.requestId,
      taskId: task.id,
      taskTitle: task.title,
      message: input.message,
      cwd: input.cwd,
      requestedAt: this.now(),
    })

    // Le has contestado: vuelve a trabajar. Si no, se queda en «terminada»,
    // que es la verdad — te entregó algo y ahí sigue.
    if (resolution.outcome === 'reply') {
      this.moveToRunning(task.id)
    }

    this.activity?.record({
      event: 'fin de turno',
      cwd: input.cwd,
      accepted: resolution.outcome === 'reply',
      detail:
        resolution.outcome === 'reply'
          ? `le contestaste · ${resolution.reply?.length ?? 0} caracteres`
          : 'terminó el turno sin respuesta',
      taskTitle: task.title,
    })

    return resolution
  }

  /**
   * Claude Code se marchó sin esperar respuesta: se retira el aviso.
   *
   * Ocurre de verdad, y no como caso raro: si el enlace está instalado con un
   * tope de tiempo menor que el que espera la Torre —por ejemplo, una sesión
   * de Claude Code abierta ANTES de actualizar el enlace—, Claude Code mata el
   * proceso a media espera mientras el aviso sigue en pantalla contando.
   *
   * Sin esto, escribirías una respuesta a alguien que ya no está escuchando y
   * la Torre te diría que la ha mandado.
   */
  abandon(raw: unknown): void {
    const parsed = handoffRequestSchema.safeParse(raw)
    if (!parsed.success) return
    this.registry.abandon(parsed.data.requestId)
  }

  reply(requestId: string, text: string): boolean {
    return this.registry.reply(requestId, text)
  }

  release(requestId: string): boolean {
    return this.registry.release(requestId)
  }

  private moveToRunning(taskId: string): void {
    try {
      this.tasks.changeStatus({
        id: taskId,
        status: 'running',
        source: 'claude_hook',
        confidence: 'high',
      })
    } catch {
      // Una transición rechazada por la máquina de estados no debe impedir que
      // tu respuesta llegue a Claude. El estado es contexto; la respuesta es lo
      // que has pedido que pase.
    }
  }
}
