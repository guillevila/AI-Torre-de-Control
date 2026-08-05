import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { HookActivityLog } from '../hooks/hook-activity-log.js'
import { SessionLinker } from '../hooks/session-linker.js'
import { TaskService } from '../services/task-service.js'
import { TurnRegistry } from './turn-registry.js'
import { TurnService } from './turn-service.js'

/**
 * Responder desde la Torre (D25), lado servicio. Las tres garantías:
 * apagado no retiene nada; contestar reengancha la tarea a «trabajando»;
 * y el agotamiento del tiempo es un `pass`, nunca un error.
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 10, 0, clock++)).toISOString()
let ids = 0

let tasks: TaskService
let linker: SessionLinker
let registry: TurnRegistry
let activity: HookActivityLog
let ventanaMs: number

function crearServicio(): TurnService {
  return new TurnService({
    registry,
    linker,
    taskService: tasks,
    activity,
    windowMs: () => ventanaMs,
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
  ventanaMs = 5_000
  const repository = new InMemoryTaskRepository()
  tasks = new TaskService({ repository, now, newId: () => `task-${++ids}` })
  linker = new SessionLinker(tasks)
  registry = new TurnRegistry({})
  activity = new HookActivityLog()
})

describe('responder desde la Torre (D25)', () => {
  it('apagado (ventana 0) responde pass al instante, sin crear tarjeta', async () => {
    ventanaMs = 0
    const servicio = crearServicio()

    const resolucion = await servicio.request(peticion())

    expect(resolucion).toEqual({ action: 'pass' })
    expect(registry.list()).toHaveLength(0)
  })

  it('encendido, la tarjeta espera y contestar reengancha la tarea a «trabajando»', async () => {
    const servicio = crearServicio()

    const promesa = servicio.request(peticion())
    await Promise.resolve()
    await Promise.resolve()

    const tarjeta = registry.list()[0]
    expect(tarjeta?.output).toContain('¿Lo mando?')

    servicio.decide(tarjeta!.requestId, { action: 'reply', text: 'mándalo' })
    const resolucion = await promesa

    expect(resolucion).toEqual({ action: 'reply', text: 'mándalo' })
    expect(tasks.list()[0]?.status).toBe('running')
    expect(registry.list()).toHaveLength(0)
  })

  it('cerrar la tarjeta deja que el turno termine como siempre', async () => {
    const servicio = crearServicio()
    const promesa = servicio.request(peticion())
    await Promise.resolve()
    await Promise.resolve()

    servicio.decide(registry.list()[0]!.requestId, { action: 'pass' })

    expect(await promesa).toEqual({ action: 'pass' })
  })

  it('una petición mal formada es pass, no un fallo', async () => {
    const servicio = crearServicio()
    expect(await servicio.request({ cualquier: 'cosa' })).toEqual({ action: 'pass' })
  })

  it('la respuesta del asistente jamás entra en la ventana de actividad', async () => {
    const servicio = crearServicio()
    const promesa = servicio.request(peticion({ output: 'TEXTO-QUE-NO-DEBE-PERSISTIR' }))
    await Promise.resolve()
    await Promise.resolve()
    servicio.decide(registry.list()[0]!.requestId, { action: 'pass' })
    await promesa

    const volcado = JSON.stringify(activity.list())
    expect(volcado).not.toContain('TEXTO-QUE-NO-DEBE-PERSISTIR')
  })
})
