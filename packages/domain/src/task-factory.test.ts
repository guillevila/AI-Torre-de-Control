import { describe, expect, it } from 'vitest'
import { applyTaskUpdate, createTask } from './task-factory.js'
import { makeTask } from './test-fixtures.js'

const CTX = { id: 'task-abc', now: '2026-02-01T12:00:00.000Z' }

describe('createTask', () => {
  it('crea una tarea con los valores mínimos', () => {
    const task = createTask({ title: 'Investigar proveedores', provider: 'chatgpt' }, CTX)

    expect(task.id).toBe('task-abc')
    expect(task.title).toBe('Investigar proveedores')
    expect(task.status).toBe('draft')
    expect(task.statusSource).toBe('manual')
    expect(task.statusConfidence).toBe('high')
    expect(task.startedAt).toBeNull()
    expect(task.externalUrl).toBeNull()
  })

  it('marca startedAt si nace ya lanzada', () => {
    const task = createTask(
      { title: 'Refactor del panel', provider: 'claude_code', status: 'running' },
      CTX,
    )
    expect(task.startedAt).toBe(CTX.now)
  })

  it('acepta una URL externa válida', () => {
    const task = createTask(
      { title: 'Con enlace', provider: 'claude_web', externalUrl: 'https://example.test/chat/1' },
      CTX,
    )
    expect(task.externalUrl).toBe('https://example.test/chat/1')
  })

  it('rechaza un título vacío', () => {
    expect(() => createTask({ title: '   ', provider: 'other' }, CTX)).toThrow()
  })

  it('rechaza una plataforma desconocida', () => {
    expect(() => createTask({ title: 'X', provider: 'inventada' }, CTX)).toThrow()
  })

  it('rechaza enlaces peligrosos', () => {
    expect(() =>
      createTask(
        { title: 'X', provider: 'other', externalUrl: 'javascript:alert(1)' },
        CTX,
      ),
    ).toThrow()
    expect(() =>
      createTask({ title: 'X', provider: 'other', externalUrl: 'file:///C:/Windows' }, CTX),
    ).toThrow()
  })
})

describe('applyTaskUpdate', () => {
  const LATER = '2026-03-01T09:00:00.000Z'

  it('cambia solo los campos enviados', () => {
    const task = makeTask({ title: 'Original', notes: 'Nota previa' })
    const updated = applyTaskUpdate(task, { id: task.id, title: 'Nuevo título' }, LATER)

    expect(updated.title).toBe('Nuevo título')
    expect(updated.notes).toBe('Nota previa')
    expect(updated.updatedAt).toBe(LATER)
  })

  it('permite borrar el enlace externo enviando null', () => {
    const task = makeTask({ externalUrl: 'https://example.test/a' })
    const updated = applyTaskUpdate(task, { id: task.id, externalUrl: null }, LATER)
    expect(updated.externalUrl).toBeNull()
  })

  it('nunca cambia el estado, aunque se intente colar', () => {
    const task = makeTask({ status: 'running' })
    const updated = applyTaskUpdate(task, { id: task.id, title: 'Otro', status: 'completed' }, LATER)
    expect(updated.status).toBe('running')
  })
})
