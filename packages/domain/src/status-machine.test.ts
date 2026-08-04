import { describe, expect, it } from 'vitest'
import type { TaskStatus } from '@torre/contracts'
import { applyStatusChange, type StatusChangeRequest, shouldNotify } from './status-machine.js'
import { canTransition } from './transitions.js'
import { makeTask } from './test-fixtures.js'

const NOW = '2026-02-01T12:00:00.000Z'

const change = (
  status: TaskStatus,
  extra: Partial<Omit<StatusChangeRequest, 'status'>> = {},
): StatusChangeRequest => ({
  status,
  source: 'manual',
  confidence: 'high',
  now: NOW,
  ...extra,
})

describe('grafo de transiciones', () => {
  it('permite los recorridos normales de una tarea', () => {
    expect(canTransition('draft', 'running')).toBe(true)
    expect(canTransition('running', 'waiting_user')).toBe(true)
    expect(canTransition('waiting_user', 'completed')).toBe(true)
    expect(canTransition('completed', 'archived')).toBe(true)
  })

  it('permite rescatar una tarea perdida (D9)', () => {
    expect(canTransition('running', 'unknown')).toBe(true)
    expect(canTransition('unknown', 'completed')).toBe(true)
  })

  it('rechaza saltos imposibles', () => {
    expect(canTransition('archived', 'completed')).toBe(false)
    expect(canTransition('draft', 'completed')).toBe(false)
    expect(canTransition('completed', 'queued')).toBe(false)
  })

  it('considera válido quedarse en el mismo estado', () => {
    expect(canTransition('running', 'running')).toBe(true)
  })
})

describe('applyStatusChange', () => {
  it('cambia el estado y guarda fuente y confianza (D8)', () => {
    const task = makeTask({ status: 'running', startedAt: NOW })
    const result = applyStatusChange(
      task,
      change('completed', { source: 'local_event', confidence: 'medium' }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.status).toBe('completed')
    expect(result.task.statusSource).toBe('local_event')
    expect(result.task.statusConfidence).toBe('medium')
    expect(result.changed).toBe(true)
  })

  it('rechaza una transición imposible sin tocar la tarea', () => {
    const task = makeTask({ status: 'archived' })
    const result = applyStatusChange(task, change('completed'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_transition')
  })

  it('impide que una señal automática CIERRE de otra forma lo que cerraste tú', () => {
    const task = makeTask({ status: 'failed', statusSource: 'manual' })
    const result = applyStatusChange(
      task,
      change('completed', { source: 'browser_extension', confidence: 'low' }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('manual_decision_locked')
  })

  it('tampoco puede archivar por su cuenta lo que diste por terminado', () => {
    const task = makeTask({ status: 'completed', statusSource: 'manual' })
    const result = applyStatusChange(task, change('archived', { source: 'claude_hook' }))
    expect(result.ok).toBe(false)
  })

  /**
   * La excepción, y el motivo por el que existe: si cierras una tarea a mano y
   * después vuelves a trabajar en esa carpeta, la señal de que hay trabajo en
   * marcha es información nueva y observada, no un evento retrasado. Sin esto,
   * cerrar una tarea a mano dejaba su carpeta sorda para siempre.
   */
  it('SÍ deja que una señal automática la reabra si el trabajo se reanuda', () => {
    const task = makeTask({ status: 'completed', statusSource: 'manual' })
    const result = applyStatusChange(task, change('running', { source: 'claude_hook' }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.status).toBe('running')
  })

  it('sí deja al usuario cambiar a mano lo que él mismo cerró', () => {
    const task = makeTask({ status: 'completed', statusSource: 'manual' })
    const result = applyStatusChange(task, change('running', { source: 'manual' }))

    expect(result.ok).toBe(true)
  })

  it('permite que un evento automático cierre una tarea automática', () => {
    const task = makeTask({ status: 'running', statusSource: 'claude_hook' })
    const result = applyStatusChange(task, change('completed', { source: 'claude_hook' }))

    expect(result.ok).toBe(true)
  })
})

describe('marcas de tiempo', () => {
  it('fija startedAt la primera vez que la tarea arranca', () => {
    const task = makeTask({ status: 'draft', startedAt: null })
    const result = applyStatusChange(task, change('running'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.startedAt).toBe(NOW)
  })

  it('no reescribe startedAt en cambios posteriores', () => {
    const original = '2026-01-15T08:00:00.000Z'
    const task = makeTask({ status: 'running', startedAt: original })
    const result = applyStatusChange(task, change('waiting_user'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.startedAt).toBe(original)
  })

  it('fija finishedAt al terminar y lo borra al reabrir', () => {
    const running = makeTask({ status: 'running', startedAt: NOW })
    const done = applyStatusChange(running, change('completed'))
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.task.finishedAt).toBe(NOW)

    const reopened = applyStatusChange(done.task, change('running'))
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.task.finishedAt).toBeNull()
  })

  it('actualiza lastActivityAt aunque el estado no cambie', () => {
    const task = makeTask({ status: 'running', lastActivityAt: '2026-01-01T00:00:00.000Z' })
    const result = applyStatusChange(task, change('running'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.lastActivityAt).toBe(NOW)
    expect(result.changed).toBe(false)
  })
})

describe('decisión de notificar', () => {
  it('avisa al pasar a los tres estados que interrumpen', () => {
    expect(shouldNotify('running', 'waiting_user')).toBe(true)
    expect(shouldNotify('running', 'completed')).toBe(true)
    expect(shouldNotify('running', 'failed')).toBe(true)
  })

  it('no avisa de estados que no requieren al usuario', () => {
    expect(shouldNotify('draft', 'running')).toBe(false)
    expect(shouldNotify('running', 'unknown')).toBe(false)
    expect(shouldNotify('completed', 'archived')).toBe(false)
  })

  it('no repite el aviso si el estado ya era ese', () => {
    expect(shouldNotify('completed', 'completed')).toBe(false)
    expect(shouldNotify('waiting_user', 'waiting_user')).toBe(false)
  })

  it('el resultado de la transición traslada la decisión de avisar', () => {
    const task = makeTask({ status: 'running', startedAt: NOW })
    const first = applyStatusChange(task, change('completed'))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.notify).toBe(true)

    // Segundo evento idéntico: no debe volver a avisar (anti-duplicados).
    const repeated = applyStatusChange(first.task, change('completed'))
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.notify).toBe(false)
  })
})
