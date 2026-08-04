import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(() => {
  vi.useRealTimers()
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
    const message = buildNotification(task('completed'))
    expect(JSON.stringify(message)).not.toMatch(/prompt|respuesta|output/i)
  })
})

describe('anti-duplicados', () => {
  it('deja pasar el primer aviso y bloquea el repetido', () => {
    const dedup = new NotificationDeduplicator()
    expect(dedup.shouldSend('t1', 'completed')).toBe(true)
    expect(dedup.shouldSend('t1', 'completed')).toBe(false)
  })

  it('distingue entre tareas', () => {
    const dedup = new NotificationDeduplicator()
    expect(dedup.shouldSend('t1', 'completed')).toBe(true)
    expect(dedup.shouldSend('t2', 'completed')).toBe(true)
  })
})

describe('estados finales: se avisa al momento', () => {
  it('avisa de fallida sin esperar', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title))

    notify(task('failed'), true)
    expect(enviados).toEqual(['Tarea fallida'])
  })

  it('no avisa si el cambio no lo merecía', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 0 })

    notify(task('completed'), false)
    expect(enviados).toEqual([])
  })

  it('no envía nada para estados silenciosos', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title))

    notify(task('running'), true)
    notify(task('unknown'), true)
    expect(enviados).toEqual([])
  })
})

/**
 * El comportamiento que evita que acabes apagando las notificaciones.
 *
 * Con el enlace de Claude Code, cada turno del asistente termina en «te espera».
 * Si estás delante contestando, no debe salir ningún aviso.
 */
describe('cada turno acaba en «terminada»: también espera', () => {
  it('no avisa de terminada de inmediato', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('completed'), true)
    expect(enviados).toEqual([])
  })

  it('un turno tras otro no genera ni un aviso', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    // Trabajando en la terminal: entrega, le contestas, entrega, le contestas…
    for (let turno = 0; turno < 5; turno += 1) {
      notify(task('completed'), true)
      vi.advanceTimersByTime(9_000)
      notify(task('running'), false)
      vi.advanceTimersByTime(3_000)
    }

    vi.advanceTimersByTime(60_000)
    expect(enviados).toEqual([])
  })

  it('pero si te vas de verdad, avisa de que ha terminado', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('completed'), true)
    vi.advanceTimersByTime(45_001)
    expect(enviados).toEqual(['Tarea terminada'])
  })
})

describe('«te espera»: el aviso espera a ver si vuelves', () => {
  it('no avisa de inmediato', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('waiting_user'), true)
    expect(enviados).toEqual([])
  })

  it('avisa si de verdad te has ido', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('waiting_user'), true)
    vi.advanceTimersByTime(45_001)
    expect(enviados).toEqual(['Te están esperando'])
  })

  it('CANCELA el aviso si contestas antes', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('waiting_user'), true)
    // Escribes en la terminal: la tarea vuelve a trabajar.
    vi.advanceTimersByTime(5_000)
    notify(task('running'), false)

    vi.advanceTimersByTime(60_000)
    expect(enviados).toEqual([])
  })

  it('un ir y venir de turnos no genera ni un solo aviso', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    // Cinco turnos seguidos contestando rápido, como cuando estás trabajando.
    for (let turno = 0; turno < 5; turno += 1) {
      notify(task('waiting_user'), true)
      vi.advanceTimersByTime(8_000)
      notify(task('running'), false)
      vi.advanceTimersByTime(4_000)
    }

    vi.advanceTimersByTime(60_000)
    expect(enviados).toEqual([])
  })

  it('pero al irte de verdad tras varios turnos, sí avisa', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('waiting_user'), true)
    vi.advanceTimersByTime(8_000)
    notify(task('running'), false)
    // Ahora sí te vas.
    notify(task('waiting_user'), true)
    vi.advanceTimersByTime(45_001)

    expect(enviados).toEqual(['Te están esperando'])
  })

  it('una espera larga no avisa dos veces', () => {
    vi.useFakeTimers()
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 45_000 })

    notify(task('waiting_user'), true)
    vi.advanceTimersByTime(45_001)
    // Llega otro aviso del mismo estado: no debe repetirse.
    notify(task('waiting_user'), true)
    vi.advanceTimersByTime(45_001)

    expect(enviados).toEqual(['Te están esperando'])
  })

  it('con la espera desactivada avisa al momento', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 0 })

    notify(task('waiting_user'), true)
    expect(enviados).toEqual(['Te están esperando'])
  })
})

describe('reapertura', () => {
  it('si una tarea se reabre y vuelve a terminar, avisa de nuevo', () => {
    const enviados: string[] = []
    const notify = createNotifier((m) => enviados.push(m.title), { idleDelayMs: 0 })

    notify(task('completed'), true)
    notify(task('running'), false)
    notify(task('completed'), true)

    expect(enviados).toEqual(['Tarea terminada', 'Tarea terminada'])
  })
})
