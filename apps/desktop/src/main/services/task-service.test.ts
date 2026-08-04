import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings, type Task, type TaskStatus } from '@torre/contracts'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { TaskService, TaskServiceError } from './task-service.js'

/**
 * Tests del orquestador. Usan un repositorio en memoria: comprueban la lógica
 * de coordinación, no la base de datos (que tiene sus propios tests).
 */

let clock = 0
const now = (): string => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString()

let ids = 0
const newId = (): string => `task-${++ids}`

const setup = (settings: Partial<Settings> = {}) => {
  const repository = new InMemoryTaskRepository()
  const notified: Task[] = []
  const changes: Task[][] = []
  const service = new TaskService({
    repository,
    now,
    newId,
    settings: () => ({ ...DEFAULT_SETTINGS, ...settings }),
    // Solo se apuntan los cambios que MERECÍAN aviso: el resto llegan también,
    // pero sirven para cancelar avisos pendientes, no para lanzarlos.
    onStatusChange: (task: Task, _previous: TaskStatus, notify: boolean) => {
      if (notify) notified.push(task)
    },
    onChange: (tasks) => changes.push(tasks),
  })
  return { service, repository, notified, changes }
}

beforeEach(() => {
  clock = 0
  ids = 0
})

describe('crear tareas', () => {
  it('guarda la tarea y publica el estado nuevo', () => {
    const { service, repository, changes } = setup()
    const task = service.create({ title: 'Estudio de mercado', provider: 'chatgpt' })

    expect(repository.findById(task.id)).not.toBeNull()
    expect(changes).toHaveLength(1)
    expect(changes[0]).toHaveLength(1)
  })

  it('devuelve un mensaje comprensible si los datos son inválidos', () => {
    const { service } = setup()
    expect(() => service.create({ title: '', provider: 'chatgpt' })).toThrow(TaskServiceError)
    expect(() => service.create({ title: 'X', provider: 'no_existe' })).toThrow(TaskServiceError)
  })

  it('no guarda nada cuando la creación falla', () => {
    const { service, repository } = setup()
    expect(() => service.create({ title: '', provider: 'chatgpt' })).toThrow()
    expect(repository.list()).toHaveLength(0)
  })
})

describe('cambiar estado', () => {
  it('aplica la transición y notifica una sola vez', () => {
    const { service, notified } = setup()
    const task = service.create({ title: 'Tarea', provider: 'claude_code', status: 'running' })

    service.changeStatus({ id: task.id, status: 'completed' })
    expect(notified.map((t) => t.status)).toEqual(['completed'])

    // Repetir el mismo estado no debe generar un segundo aviso.
    service.changeStatus({ id: task.id, status: 'completed' })
    expect(notified).toHaveLength(1)
  })

  it('avisa de los tres estados que interrumpen', () => {
    const { service, notified } = setup()
    const a = service.create({ title: 'A', provider: 'other', status: 'running' })
    const b = service.create({ title: 'B', provider: 'other', status: 'running' })
    const c = service.create({ title: 'C', provider: 'other', status: 'running' })

    service.changeStatus({ id: a.id, status: 'waiting_user' })
    service.changeStatus({ id: b.id, status: 'completed' })
    service.changeStatus({ id: c.id, status: 'failed' })

    expect(notified.map((t) => t.status)).toEqual(['waiting_user', 'completed', 'failed'])
  })

  it('no avisa de estados que no requieren al usuario', () => {
    const { service, notified } = setup()
    const task = service.create({ title: 'A', provider: 'other' })

    service.changeStatus({ id: task.id, status: 'running' })
    service.changeStatus({ id: task.id, status: 'unknown' })

    expect(notified).toHaveLength(0)
  })

  it('rechaza una transición imposible con un mensaje claro', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other' })
    service.changeStatus({ id: task.id, status: 'archived' })

    expect(() => service.changeStatus({ id: task.id, status: 'completed' })).toThrow(
      /No es posible pasar/,
    )
  })

  it('falla si la tarea no existe', () => {
    const { service } = setup()
    expect(() => service.changeStatus({ id: 'inventada', status: 'running' })).toThrow(
      /No existe ninguna tarea/,
    )
  })
})

describe('archivar', () => {
  it('deja la tarea archivada', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'completed' })
    const archived = service.archive(task.id)
    expect(archived.status).toBe('archived')
  })
})

describe('entrada de eventos locales', () => {
  it('acepta un evento válido y mueve la tarea', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'claude_code', status: 'running' })

    const result = service.ingestEvent({
      type: 'status_changed',
      taskId: task.id,
      status: 'completed',
      source: 'local_event',
      confidence: 'high',
      timestamp: '2026-08-03T12:00:00Z',
    })

    expect(result.accepted).toBe(true)
    expect(service.getById(task.id)?.status).toBe('completed')
    expect(service.getById(task.id)?.statusSource).toBe('local_event')
  })

  it('notifica igual que un cambio manual', () => {
    const { service, notified } = setup()
    const task = service.create({ title: 'A', provider: 'claude_code', status: 'running' })

    service.ingestEvent({
      type: 'status_changed',
      taskId: task.id,
      status: 'waiting_user',
      source: 'claude_hook',
      confidence: 'high',
      timestamp: '2026-08-03T12:00:00Z',
    })

    expect(notified).toHaveLength(1)
    expect(notified[0]?.status).toBe('waiting_user')
  })

  it('rechaza un evento mal formado explicando qué falla', () => {
    const { service } = setup()
    const result = service.ingestEvent({ type: 'status_changed', taskId: 'x' })

    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.details?.length).toBeGreaterThan(0)
  })

  it('rechaza un evento para una tarea inexistente', () => {
    const { service } = setup()
    const result = service.ingestEvent({
      type: 'status_changed',
      taskId: 'fantasma',
      status: 'completed',
      source: 'local_event',
      confidence: 'high',
      timestamp: '2026-08-03T12:00:00Z',
    })

    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.reason).toMatch(/No existe/)
  })

  it('no deja que un evento automático deshaga una decisión manual', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'claude_code', status: 'running' })
    service.changeStatus({ id: task.id, status: 'completed', source: 'manual' })

    const result = service.ingestEvent({
      type: 'status_changed',
      taskId: task.id,
      status: 'running',
      source: 'browser_extension',
      confidence: 'low',
      timestamp: '2026-08-03T12:00:00Z',
    })

    expect(result.accepted).toBe(false)
    expect(service.getById(task.id)?.status).toBe('completed')
  })

  it('nunca ejecuta nada de lo que llega en el evento', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    const spy = vi.fn()

    const result = service.ingestEvent({
      type: 'status_changed',
      taskId: task.id,
      status: 'completed',
      source: 'local_event',
      confidence: 'high',
      timestamp: '2026-08-03T12:00:00Z',
      command: 'rm -rf /',
      onComplete: spy,
    })

    // El campo de más hace que se rechace el evento entero.
    expect(result.accepted).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    expect(service.getById(task.id)?.status).toBe('running')
  })
})

describe('la lista publicada refleja el estado real', () => {
  it('cada cambio publica la lista completa actualizada', () => {
    const { service, changes } = setup()
    const task = service.create({ title: 'A', provider: 'other' })
    service.changeStatus({ id: task.id, status: 'running' })

    const last = changes.at(-1) as Task[]
    expect(last).toHaveLength(1)
    expect(last[0]?.status).toBe('running')
  })
})

describe('historial de estados (D19)', () => {
  it('deja una primera línea al crear la tarea', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })

    const history = service.history(task.id)
    expect(history).toHaveLength(1)
    expect(history[0]?.fromStatus).toBeNull()
    expect(history[0]?.toStatus).toBe('running')
    expect(history[0]?.source).toBe('manual')
  })

  it('anota cada cambio con su origen y su destino', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'waiting_user' })
    service.changeStatus({ id: task.id, status: 'completed' })

    const history = service.history(task.id)
    expect(history).toHaveLength(3)
    // Del más reciente al más antiguo.
    expect(history[0]?.toStatus).toBe('completed')
    expect(history[0]?.fromStatus).toBe('waiting_user')
    expect(history[1]?.toStatus).toBe('waiting_user')
    expect(history[1]?.fromStatus).toBe('running')
  })

  it('no anota nada cuando el estado no cambia de verdad', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'running' })
    service.changeStatus({ id: task.id, status: 'running' })

    expect(service.history(task.id)).toHaveLength(1)
  })

  it('guarda también lo que llega por evento, con su fuente', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'claude_code', status: 'running' })

    service.ingestEvent({
      type: 'status_changed',
      taskId: task.id,
      status: 'completed',
      source: 'claude_hook',
      confidence: 'high',
      timestamp: '2026-08-03T12:00:00Z',
    })

    expect(service.history(task.id)[0]?.source).toBe('claude_hook')
  })

  it('la actividad reciente mezcla tareas y trae su título', () => {
    const { service } = setup()
    const a = service.create({ title: 'Primera', provider: 'other', status: 'running' })
    service.create({ title: 'Segunda', provider: 'other', status: 'running' })
    service.changeStatus({ id: a.id, status: 'completed' })

    const activity = service.recentActivity(10)
    expect(activity[0]?.taskTitle).toBe('Primera')
    expect(activity.map((entry) => entry.taskTitle)).toContain('Segunda')
  })

  it('al borrar una tarea se lleva su historial por delante', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'completed' })
    service.remove(task.id)

    expect(service.getById(task.id)).toBeNull()
    expect(service.recentActivity(10)).toHaveLength(0)
  })
})

describe('barrido de tareas sin señal (D9)', () => {
  const OLD = '2025-01-01T00:00:00.000Z'

  it('pasa a «sin confirmar» lo automático que lleva demasiado tiempo callado', () => {
    const { service, repository } = setup({ staleAfterMinutes: 30 })
    const task = service.create({ title: 'A', provider: 'claude_code', status: 'running' })
    // Se envejece a mano la última señal, como si el evento fuese antiguo.
    repository.save({ ...task, statusSource: 'claude_hook', lastActivityAt: OLD })

    expect(service.sweepStale()).toBe(1)
    expect(service.getById(task.id)?.status).toBe('unknown')
    expect(service.getById(task.id)?.statusConfidence).toBe('low')
  })

  it('NUNCA toca lo que fijaste tú a mano', () => {
    const { service, repository } = setup({ staleAfterMinutes: 30 })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    repository.save({ ...task, statusSource: 'manual', lastActivityAt: OLD })

    expect(service.sweepStale()).toBe(0)
    expect(service.getById(task.id)?.status).toBe('running')
  })

  it('no toca lo que ya terminó ni lo que te espera', () => {
    const { service, repository } = setup({ staleAfterMinutes: 30 })
    const done = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: done.id, status: 'completed', source: 'local_event' })
    repository.save({ ...(service.getById(done.id) as Task), lastActivityAt: OLD })

    expect(service.sweepStale()).toBe(0)
    expect(service.getById(done.id)?.status).toBe('completed')
  })

  it('se puede desactivar poniéndolo a cero', () => {
    const { service, repository } = setup({ staleAfterMinutes: 0 })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    repository.save({ ...task, statusSource: 'claude_hook', lastActivityAt: OLD })

    expect(service.sweepStale()).toBe(0)
  })

  it('deja constancia en el historial de que se perdió el contacto', () => {
    const { service, repository } = setup({ staleAfterMinutes: 30 })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    repository.save({ ...task, statusSource: 'local_event', lastActivityAt: OLD })
    service.sweepStale()

    expect(service.history(task.id)[0]?.toStatus).toBe('unknown')
  })
})

describe('los ajustes gobiernan los avisos', () => {
  it('no avisa de lo que has silenciado', () => {
    const { service, notified } = setup({ notifyCompleted: false })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'completed' })

    expect(notified).toHaveLength(0)
  })

  it('sigue avisando de lo demás', () => {
    const { service, notified } = setup({ notifyCompleted: false })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'waiting_user' })

    expect(notified).toHaveLength(1)
  })

  it('silenciar un aviso no impide que el estado cambie', () => {
    const { service } = setup({ notifyFailed: false })
    const task = service.create({ title: 'A', provider: 'other', status: 'running' })
    service.changeStatus({ id: task.id, status: 'failed' })

    expect(service.getById(task.id)?.status).toBe('failed')
  })
})

describe('estados por defecto de una tarea nueva', () => {
  it('nace como borrador, manual y con confianza alta', () => {
    const { service } = setup()
    const task = service.create({ title: 'A', provider: 'other' })
    const expected: TaskStatus = 'draft'
    expect(task.status).toBe(expected)
    expect(task.statusSource).toBe('manual')
    expect(task.statusConfidence).toBe('high')
  })
})
