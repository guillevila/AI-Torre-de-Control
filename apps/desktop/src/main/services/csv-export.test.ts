import { describe, expect, it } from 'vitest'
import type { Task } from '@torre/contracts'
import { tasksToCsv } from './csv-export.js'

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Estudio de mercado',
  provider: 'chatgpt',
  externalUrl: 'https://example.test/c/1',
  externalSessionId: null,
  projectPath: null,

  account: null,
  status: 'completed',
  statusSource: 'manual',
  statusConfidence: 'high',
  startedAt: '2026-08-03T10:00:00.000Z',
  finishedAt: '2026-08-03T12:00:00.000Z',
  lastActivityAt: '2026-08-03T12:00:00.000Z',
  createdAt: '2026-08-03T09:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
  notes: null,
  ...overrides,
})

const lines = (csv: string) => csv.replace(/^﻿/, '').trim().split('\r\n')

describe('exportar a CSV', () => {
  it('escribe una cabecera y una fila por tarea', () => {
    const rows = lines(tasksToCsv([task({ id: 'a' }), task({ id: 'b' })]))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('titulo')
  })

  it('entrecomilla lo que lleva comas, comillas o saltos de línea', () => {
    const csv = tasksToCsv([task({ title: 'Informe: ventas, costes y "márgenes"' })])
    expect(csv).toContain('"Informe: ventas, costes y ""márgenes"""')
  })

  it('deja vacías las celdas sin valor', () => {
    const row = lines(tasksToCsv([task({ externalUrl: null, notes: null })]))[1] ?? ''
    expect(row).toContain(',,')
  })

  it('neutraliza títulos que una hoja de cálculo ejecutaría como fórmula', () => {
    // Sin esto, abrir el CSV en Excel ejecutaría la fórmula.
    for (const peligroso of ['=1+1', '+A1', '-A1', '@SUM(A1)']) {
      const csv = tasksToCsv([task({ title: peligroso })])
      expect(csv).toContain(`'${peligroso}`)
    }
  })

  it('empieza por la marca que hace que Excel lea bien los acentos', () => {
    expect(tasksToCsv([])).toMatch(/^﻿/)
  })

  it('no exporta ningún campo con contenido de conversaciones (D5)', () => {
    const cabecera = lines(tasksToCsv([task()]))[0] ?? ''
    for (const prohibido of ['prompt', 'respuesta', 'output', 'mensaje', 'conversacion']) {
      expect(cabecera).not.toContain(prohibido)
    }
  })

  it('funciona con la lista vacía', () => {
    expect(lines(tasksToCsv([]))).toHaveLength(1)
  })
})
