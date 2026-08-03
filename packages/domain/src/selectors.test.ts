import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  filterTasks,
  groupOf,
  groupTasks,
  officeWorkers,
  summarise,
} from './selectors.js'
import { makeTask } from './test-fixtures.js'

const at = (iso: string) => ({ lastActivityAt: iso, createdAt: iso })

describe('agrupación por estado', () => {
  it('manda a atención lo que reclama al usuario', () => {
    expect(groupOf('waiting_user')).toBe('attention')
    expect(groupOf('failed')).toBe('attention')
  })

  it('separa trabajando, desconocido, terminado y archivado', () => {
    expect(groupOf('running')).toBe('active')
    expect(groupOf('queued')).toBe('active')
    expect(groupOf('unknown')).toBe('unknown')
    expect(groupOf('completed')).toBe('completed')
    expect(groupOf('archived')).toBe('archived')
    expect(groupOf('draft')).toBe('draft')
  })

  it('reparte una lista mixta en sus grupos', () => {
    const groups = groupTasks([
      makeTask({ id: '1', status: 'running' }),
      makeTask({ id: '2', status: 'waiting_user' }),
      makeTask({ id: '3', status: 'completed' }),
      makeTask({ id: '4', status: 'unknown' }),
      makeTask({ id: '5', status: 'failed' }),
      makeTask({ id: '6', status: 'archived' }),
    ])

    expect(groups.active.map((t) => t.id)).toEqual(['1'])
    expect(groups.attention.map((t) => t.id).sort()).toEqual(['2', '5'])
    expect(groups.completed.map((t) => t.id)).toEqual(['3'])
    expect(groups.unknown.map((t) => t.id)).toEqual(['4'])
    expect(groups.archived.map((t) => t.id)).toEqual(['6'])
  })

  it('en atención pone primero la que lleva más tiempo esperando', () => {
    const groups = groupTasks([
      makeTask({ id: 'reciente', status: 'waiting_user', ...at('2026-05-01T10:00:00.000Z') }),
      makeTask({ id: 'olvidada', status: 'waiting_user', ...at('2026-01-01T10:00:00.000Z') }),
    ])
    expect(groups.attention.map((t) => t.id)).toEqual(['olvidada', 'reciente'])
  })

  it('en el resto pone primero lo más reciente', () => {
    const groups = groupTasks([
      makeTask({ id: 'vieja', status: 'running', ...at('2026-01-01T10:00:00.000Z') }),
      makeTask({ id: 'nueva', status: 'running', ...at('2026-05-01T10:00:00.000Z') }),
    ])
    expect(groups.active.map((t) => t.id)).toEqual(['nueva', 'vieja'])
  })
})

describe('la oficina refleja el mismo estado que la vista operativa (D10)', () => {
  const tasks = [
    makeTask({ id: 'a', status: 'running' }),
    makeTask({ id: 'b', status: 'waiting_user' }),
    makeTask({ id: 'c', status: 'completed' }),
    makeTask({ id: 'd', status: 'failed' }),
    makeTask({ id: 'e', status: 'unknown' }),
    makeTask({ id: 'f', status: 'archived' }),
    makeTask({ id: 'g', status: 'draft' }),
  ]

  it('pone un trabajador por cada tarea delegada', () => {
    expect(officeWorkers(tasks).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('deja fuera lo archivado y lo que aún no se ha lanzado', () => {
    const ids = officeWorkers(tasks).map((t) => t.id)
    expect(ids).not.toContain('f')
    expect(ids).not.toContain('g')
  })

  it('cubre los cinco estados visuales que exige la oficina', () => {
    const estados = new Set(officeWorkers(tasks).map((t) => t.status))
    expect(estados).toEqual(new Set(['running', 'waiting_user', 'completed', 'failed', 'unknown']))
  })
})

describe('filtros', () => {
  const tasks = [
    makeTask({ id: '1', title: 'Informe de mercado', provider: 'chatgpt', status: 'running' }),
    makeTask({ id: '2', title: 'Refactor del panel', provider: 'claude_code', status: 'completed' }),
    makeTask({ id: '3', title: 'Tarea vieja', provider: 'chatgpt', status: 'archived' }),
  ]

  it('oculta las archivadas por defecto', () => {
    expect(filterTasks(tasks, EMPTY_FILTERS).map((t) => t.id)).toEqual(['1', '2'])
  })

  it('las muestra si se piden', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, showArchived: true })
    expect(result.map((t) => t.id)).toEqual(['1', '2', '3'])
  })

  it('filtra por plataforma', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, provider: 'claude_code' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })

  it('busca por texto sin distinguir mayúsculas', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, search: 'REFACTOR' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })

  it('filtra por grupo', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, group: 'completed' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })
})

describe('resumen de cabecera', () => {
  it('cuenta cada grupo y excluye archivadas del total', () => {
    const resumen = summarise([
      makeTask({ id: '1', status: 'running' }),
      makeTask({ id: '2', status: 'waiting_user' }),
      makeTask({ id: '3', status: 'completed' }),
      makeTask({ id: '4', status: 'unknown' }),
      makeTask({ id: '5', status: 'archived' }),
    ])

    expect(resumen).toEqual({ attention: 1, active: 1, unknown: 1, completed: 1, total: 4 })
  })
})
