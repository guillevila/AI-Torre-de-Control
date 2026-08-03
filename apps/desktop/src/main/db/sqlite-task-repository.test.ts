import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Task } from '@torre/contracts'
import { FORBIDDEN_COLUMNS } from './schema.js'
import { SqliteTaskRepository } from './sqlite-task-repository.js'

/**
 * Tests contra SQLite de verdad, sobre un fichero temporal.
 *
 * Son los que respaldan el criterio de aceptación «la tarea sigue ahí después
 * de reiniciar»: se cierra la base de datos y se vuelve a abrir.
 */

let dir: string
let repo: SqliteTaskRepository

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Estudio de mercado',
  provider: 'chatgpt',
  externalUrl: 'https://example.test/c/1',
  externalSessionId: null,
  projectPath: null,
  status: 'running',
  statusSource: 'manual',
  statusConfidence: 'high',
  startedAt: '2026-08-03T12:00:00.000Z',
  finishedAt: null,
  lastActivityAt: '2026-08-03T12:00:00.000Z',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
  notes: null,
  ...overrides,
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'torre-test-'))
  repo = new SqliteTaskRepository(join(dir, 'nested', 'torre.db'))
})

afterEach(() => {
  repo.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('guardar y leer', () => {
  it('guarda una tarea y la recupera igual', () => {
    const original = task()
    repo.save(original)
    expect(repo.findById('task-1')).toEqual(original)
  })

  it('devuelve null si no existe', () => {
    expect(repo.findById('fantasma')).toBeNull()
  })

  it('conserva los campos opcionales vacíos como null', () => {
    repo.save(task({ externalUrl: null, notes: null, finishedAt: null }))
    const found = repo.findById('task-1')
    expect(found?.externalUrl).toBeNull()
    expect(found?.notes).toBeNull()
    expect(found?.finishedAt).toBeNull()
  })

  it('actualiza en lugar de duplicar cuando el id ya existe', () => {
    repo.save(task())
    repo.save(task({ title: 'Título corregido', status: 'completed' }))

    const all = repo.list()
    expect(all).toHaveLength(1)
    expect(all[0]?.title).toBe('Título corregido')
    expect(all[0]?.status).toBe('completed')
  })

  it('ordena la lista por actividad más reciente', () => {
    repo.save(task({ id: 'vieja', lastActivityAt: '2026-01-01T00:00:00.000Z' }))
    repo.save(task({ id: 'nueva', lastActivityAt: '2026-09-01T00:00:00.000Z' }))
    expect(repo.list().map((t) => t.id)).toEqual(['nueva', 'vieja'])
  })
})

describe('persistencia real entre sesiones', () => {
  it('mantiene las tareas al cerrar y volver a abrir', () => {
    const path = join(dir, 'persistencia.db')
    const first = new SqliteTaskRepository(path)
    first.save(task({ id: 'sobrevive', title: 'Sigo aquí' }))
    first.close()

    const second = new SqliteTaskRepository(path)
    const found = second.findById('sobrevive')
    second.close()

    expect(found?.title).toBe('Sigo aquí')
  })

  it('vuelve a abrir una base existente sin repetir las migraciones', () => {
    const path = join(dir, 'migraciones.db')
    const first = new SqliteTaskRepository(path)
    first.save(task({ id: 'x' }))
    first.close()

    const second = new SqliteTaskRepository(path)
    expect(second.list()).toHaveLength(1)
    second.close()
  })
})

describe('privacidad del almacenamiento (D5)', () => {
  it('la tabla no tiene ninguna columna capaz de guardar conversaciones', () => {
    repo.save(task())
    const columnas = Object.keys(repo.list()[0] ?? {}).map((c) => c.toLowerCase())
    for (const prohibida of FORBIDDEN_COLUMNS) {
      expect(columnas).not.toContain(prohibida)
    }
  })
})
