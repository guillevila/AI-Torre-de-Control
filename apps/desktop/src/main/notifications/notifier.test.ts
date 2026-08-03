import { describe, expect, it } from 'vitest'
import type { Task, TaskStatus } from '@torre/contracts'
import { buildNotification, createNotifier, NotificationDeduplicator } from './notifier.js'

const task = (status: TaskStatus, id = 'task-1'): Task => ({
  id,
  title: 'Informe trimestral',
  provider: 'chatgpt',
  externalUrl: null,
  externalSessionId: null,
  projectPath: null,
  status,
  statusSource: 'manual',
  statusConfidence: 'high',
  startedAt: null,
  finishedAt: null,
  lastActivityAt: '2026-08-03T12:00:00.000Z',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
  notes: null,
})

describe('contenido del aviso', () => {
  it('escribe un mensaje para cada estado que interrumpe', () => {
    expect(buildNotification(task('waiting_user'))?.title).toBe('Te están esperando')
    expect(buildNotification(task('completed'))?.title).toBe('Tarea terminada')
    expect(buildNotification(task('failed'))?.title).toBe('Tarea fallida')
  })

  it('incluye el título de la tarea en el cuerpo', () => {
    expect(buildNotification(task('completed'))?.body).toContain('Informe trimestral')
  })

  it('no genera aviso para los demás estados', () => {
    for (const status of ['draft', 'queued', 'running', 'unknown', 'archived'] as TaskStatus[]) {
      expect(buildNotification(task(status))).toBeNull()
    }
  })

  it('no filtra nada del contenido de la conversación', () => {
    // El aviso solo puede contener el título que escribió el usuario.
    const message = buildNotification(task('completed'))
    expect(JSON.stringify(message)).not.toMatch(/prompt|respuesta|output/i)
  })
})

describe('anti-duplicados', () => {
  it('deja pasar el primer aviso y bloquea el repetido', () => {
    const dedup = new NotificationDeduplicator()
    expect(dedup.shouldSend('t1', 'completed')).toBe(true)
    expect(dedup.shouldSend('t1', 'completed')).toBe(false)
    expect(dedup.shouldSend('t1', 'completed')).toBe(false)
  })

  it('distingue entre tareas', () => {
    const dedup = new NotificationDeduplicator()
    expect(dedup.shouldSend('t1', 'completed')).toBe(true)
    expect(dedup.shouldSend('t2', 'completed')).toBe(true)
  })

  it('vuelve a avisar si el estado cambia a otro que también interrumpe', () => {
    const dedup = new NotificationDeduplicator()
    expect(dedup.shouldSend('t1', 'waiting_user')).toBe(true)
    expect(dedup.shouldSend('t1', 'failed')).toBe(true)
  })
})

describe('notificador completo', () => {
  it('envía una sola vez el mismo cierre', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title))

    notify(task('completed'))
    notify(task('completed'))

    expect(enviados).toEqual(['Tarea terminada'])
  })

  it('no envía nada para estados silenciosos', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title))

    notify(task('running'))
    notify(task('unknown'))

    expect(enviados).toEqual([])
  })

  it('si una tarea se reabre y vuelve a terminar, avisa de nuevo', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title))

    notify(task('completed'))
    notify(task('running')) // reabierta: se olvida el aviso anterior
    notify(task('completed'))

    expect(enviados).toEqual(['Tarea terminada', 'Tarea terminada'])
  })
})
