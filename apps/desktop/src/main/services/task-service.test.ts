import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, TaskStatus } from '@torre/contracts'
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

const setup = () => {
  const repository = new InMemoryTaskRepository()
  const notified: Task[] = []
  const changes: Task[][] = []
  const service = new TaskService({
    repository,
    now,
    newId,
    onNotify: (task) => notified.push(task),
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
