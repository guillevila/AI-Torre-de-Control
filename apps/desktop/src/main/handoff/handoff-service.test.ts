import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings, type Task } from '@torre/contracts'
import type { HookActivityLog } from '../hooks/hook-activity-log.js'
import type { SessionLinker } from '../hooks/session-linker.js'
import type { TaskService } from '../services/task-service.js'
import { HandoffRegistry } from './handoff-registry.js'
import { HandoffService } from './handoff-service.js'

/**
 * El servicio decide tres cosas que importan: cuándo se retiene un turno,
 * cuándo la tarea vuelve a trabajar, y —la más delicada— qué se escribe en
 * disco de todo lo que pasa por aquí.
 */

const TAREA = { id: 'task-1', title: 'Migrar la base de datos' } as Task

const MENSAJE = 'He migrado las tres tablas. ¿Sigo con los índices?'

const peticion = (extra: Record<string, unknown> = {}) => ({
  requestId: 'req-12345678',
  sessionId: 'sesion-1',
  cwd: 'C:/proyecto',
  message: MENSAJE,
  timestamp: '2026-08-06T10:00:00.000Z',
  ...extra,
})

function montar(settings: Partial<Settings> = {}) {
  const registry = new HandoffRegistry({ timeoutMs: 60_000 })
  const changeStatus = vi.fn()
  const record = vi.fn()
  const resolve = vi.fn(() => TAREA)

  const service = new HandoffService({
    registry,
    linker: { resolve } as unknown as SessionLinker,
    taskService: { changeStatus } as unknown as TaskService,
    getSettings: () => ({ ...DEFAULT_SETTINGS, replyFromTower: true, ...settings }),
    activity: { record } as unknown as HookActivityLog,
  })

  return { service, registry, changeStatus, record, resolve }
}

describe('apagada, no cuesta nada', () => {
  it('suelta al instante sin mirar siquiera qué ha llegado', async () => {
    const { service, resolve, record } = montar({ replyFromTower: false })

    await expect(service.request(peticion())).resolves.toMatchObject({
      outcome: 'release',
      reply: null,
    })

    // Ni busca la tarea ni apunta nada: con la función apagada, retener el
    // turno de Claude ni un instante sería un coste que nadie ha pedido.
    expect(resolve).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })
})

describe('encendida', () => {
  it('espera, y al contestar devuelve tu texto y pone la tarea a trabajar', async () => {
    const { service, registry, changeStatus } = montar()

    const pendiente = service.request(peticion())
    // El turno se queda retenido: la promesa no se resuelve sola.
    await vi.waitFor(() => expect(registry.list()).toHaveLength(1))

    registry.reply('req-12345678', 'Sí, sigue con los índices')

    await expect(pendiente).resolves.toMatchObject({
      outcome: 'reply',
      reply: 'Sí, sigue con los índices',
    })
    expect(changeStatus).toHaveBeenCalledWith({
      id: 'task-1',
      status: 'running',
      source: 'claude_hook',
      confidence: 'high',
    })
  })

  it('si no contestas, la tarea se queda en «terminada»', async () => {
    const { service, registry, changeStatus } = montar()

    const pendiente = service.request(peticion())
    await vi.waitFor(() => expect(registry.list()).toHaveLength(1))
    registry.release('req-12345678')
    await pendiente

    // No se toca el estado: te entregó algo y ahí sigue. Es la verdad.
    expect(changeStatus).not.toHaveBeenCalled()
  })

  it('una entrega mal formada suelta el turno en vez de dar error', async () => {
    const { service } = montar()

    await expect(service.request(peticion({ cwd: 123 }))).resolves.toMatchObject({
      outcome: 'release',
    })
  })

  it('rechaza campos de más, como el resto de contratos', async () => {
    const { service } = montar()

    await expect(service.request(peticion({ transcriptPath: 'C:/x.jsonl' }))).resolves.toMatchObject(
      { outcome: 'release' },
    )
  })
})

/**
 * La prueba que sostiene toda la promesa de D24.
 *
 * El cuaderno de actividad SÍ vive en memoria, pero es lo que se enseña en la
 * pantalla del receptor y lo que se copia al diagnosticar. Si el texto de la
 * conversación se colara ahí, acabaría pegado en un informe algún día.
 *
 * Es exactamente el fallo que ya se cometió una vez en el cuaderno de permisos,
 * donde se apuntaba la respuesta entera —y con ella el contenido de los ficheros
 * que se escribían—. Aquí se comprueba que no vuelve a pasar.
 */
describe('lo que se escribe en el cuaderno no es la conversación', () => {
  it('apunta el tamaño, nunca el texto', async () => {
    const { service, registry, record } = montar()

    const pendiente = service.request(peticion())
    await vi.waitFor(() => expect(registry.list()).toHaveLength(1))
    registry.reply('req-12345678', 'Sí, sigue con los índices')
    await pendiente

    const apuntado = JSON.stringify(record.mock.calls)
    expect(apuntado).not.toContain(MENSAJE)
    expect(apuntado).not.toContain('Sí, sigue con los índices')
    // Pero sí queda constancia de que pasó algo, y de cuánto.
    expect(apuntado).toContain(String(MENSAJE.length))
    expect(apuntado).toContain('fin de turno')
  })
})
