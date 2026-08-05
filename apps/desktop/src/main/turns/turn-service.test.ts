import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { HookActivityLog } from '../hooks/hook-activity-log.js'
import { SessionLinker } from '../hooks/session-linker.js'
import { TaskService } from '../services/task-service.js'
import { TurnRegistry } from './turn-registry.js'
import { TurnService } from './turn-service.js'

/**
 * «Responder desde la Torre» sin caducidad (D25-bis). Lo que se fija aquí:
 * la tarjeta sobrevive a que el hook se libere; responder tarde relanza la
 * conversación; y darla por vista manda la tarea a «revisada».
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 5, 10, 0, clock++)).toISOString()
let ids = 0

let tasks: TaskService
let linker: SessionLinker
let registry: TurnRegistry
let activity: HookActivityLog
let holdMs: number
let relanzadas: Array<{ cwd: string; sessionId: string; text: string }>
let relanzarOk: boolean

function crearServicio(): TurnService {
  return new TurnService({
    registry,
    linker,
    taskService: tasks,
    activity,
    holdMs: () => holdMs,
    resume: (cwd, sessionId, text) => {
      if (!relanzarOk) return false
      relanzadas.push({ cwd, sessionId, text })
      return true
    },
    now,
  })
}

const peticion = (overrides: Record<string, unknown> = {}) => ({
  requestId: 'turno-000001',
  sessionId: 'sesion-1',
  cwd: 'C:/proyecto',
  output: 'He terminado el informe. ¿Lo mando?',
  timestamp: now(),
  ...overrides,
})

beforeEach(() => {
  clock = 0
  ids = 0
  holdMs = 5_000
  relanzadas = []
  relanzarOk = true
  const repository = new InMemoryTaskRepository()
  tasks = new TaskService({ repository, now, newId: () => `task-${++ids}` })
  linker = new SessionLinker(tasks)
  registry = new TurnRegistry({})
  activity = new HookActivityLog()
})

describe('responder desde la Torre sin caducidad (D25-bis)', () => {
  it('apagado (0) responde pass al instante, sin tarjeta', async () => {
    holdMs = 0
    const servicio = crearServicio()
    expect(await servicio.request(peticion())).toEqual({ action: 'pass' })
    expect(registry.list()).toHaveLength(0)
  })

  it('responder con la sesión sostenida entra por la misma sesión', async () => {
    const servicio = crearServicio()
    const promesa = servicio.request(peticion())
    await Promise.resolve()
    await Promise.resolve()

    const tarjeta = registry.list()[0]
    expect(tarjeta?.holdUntil).not.toBeNull()

    expect(servicio.decide(tarjeta!.requestId, 'reply', 'mándalo')).toBe(true)
    expect(await promesa).toEqual({ action: 'reply', text: 'mándalo' })
    expect(relanzadas).toHaveLength(0)
    expect(tasks.list()[0]?.status).toBe('running')
    expect(registry.list()).toHaveLength(0)
  })

  it('la tarjeta SOBREVIVE a que el hook se libere, sin caducidad', async () => {
    holdMs = 10
    const servicio = crearServicio()
    const resolucion = await servicio.request(peticion())

    // El hook ya se fue (pass)... pero la tarjeta sigue ahí, en reposo.
    expect(resolucion).toEqual({ action: 'pass' })
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0]?.holdUntil).toBeNull()
  })

  it('responder tarde RELANZA la conversación y libera el identificador', async () => {
    holdMs = 10
    const servicio = crearServicio()
    await servicio.request(peticion())
    const tarjeta = registry.list()[0]

    expect(servicio.decide(tarjeta!.requestId, 'reply', 'sigue con la opción B')).toBe(true)

    expect(relanzadas).toEqual([{ cwd: 'C:/proyecto', sessionId: 'sesion-1', text: 'sigue con la opción B' }])
    const tarea = tasks.list()[0]
    expect(tarea?.status).toBe('running')
    // El identificador queda libre para que la continuación adopte la tarea.
    expect(tarea?.externalSessionId).toBeNull()
    expect(registry.list()).toHaveLength(0)
  })

  it('si el relanzamiento falla, la tarjeta NO desaparece', async () => {
    holdMs = 10
    relanzarOk = false
    const servicio = crearServicio()
    await servicio.request(peticion())

    expect(servicio.decide(registry.list()[0]!.requestId, 'reply', 'hola')).toBe(false)
    expect(registry.list()).toHaveLength(1)
  })

  it('darla por vista manda la tarea a «revisada» y retira la tarjeta', async () => {
    holdMs = 10
    const servicio = crearServicio()
    await servicio.request(peticion())
    // El turno terminó de verdad: el hook mandó «completed» al liberarse.
    tasks.changeStatus({ id: tasks.list()[0]!.id, status: 'completed', source: 'claude_hook', confidence: 'high' })

    expect(servicio.decide(registry.list()[0]!.requestId, 'review')).toBe(true)
    expect(tasks.list()[0]?.status).toBe('reviewed')
    expect(registry.list()).toHaveLength(0)
  })

  it('darla por vista con la sesión aún sostenida también revisa, pasando por terminada', async () => {
    const servicio = crearServicio()
    const promesa = servicio.request(peticion())
    await Promise.resolve()
    await Promise.resolve()

    expect(servicio.decide(registry.list()[0]!.requestId, 'review')).toBe(true)
    expect(await promesa).toEqual({ action: 'pass' })
    expect(tasks.list()[0]?.status).toBe('reviewed')
  })

  it('contestar desde la ficha relanza la conversación de la tarea', async () => {
    holdMs = 10
    const servicio = crearServicio()
    await servicio.request(peticion())
    const tarea = tasks.list()[0]!

    expect(servicio.replyToTask({ taskId: tarea.id, text: 'retomamos' })).toBe(true)
    expect(relanzadas[0]?.text).toBe('retomamos')
  })

  it('la respuesta del asistente jamás entra en la ventana de actividad', async () => {
    holdMs = 10
    const servicio = crearServicio()
    await servicio.request(peticion({ output: 'TEXTO-QUE-NO-DEBE-PERSISTIR' }))
    expect(JSON.stringify(activity.list())).not.toContain('TEXTO-QUE-NO-DEBE-PERSISTIR')
  })
})
