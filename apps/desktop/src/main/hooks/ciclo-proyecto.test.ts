import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { TaskService } from '../services/task-service.js'
import { HookActivityLog } from './hook-activity-log.js'
import { SessionLinker } from './session-linker.js'
import { SessionStatusService } from './session-status-service.js'

/**
 * El ciclo completo de un proyecto de Claude Code, tal y como lo describió el
 * dueño del proyecto:
 *
 *   trabajando → te espera → terminado (revísalo)
 *        ▲                        │
 *        │                        ├─ le mandas algo → vuelve a trabajar
 *        └──────────────── revisada (backlog: nada pendiente)
 *
 * Un solo icono por proyecto, moviéndose entre estados. Nunca dos.
 */

const CARPETA = 'C:/Users/x/proyectos/mi-app'

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 12, 0, clock++)).toISOString()
let ids = 0

let tasks: TaskService
let sessions: SessionStatusService
let activity: HookActivityLog

const señal = (status: string, cwd = CARPETA, sessionId: string | null = 'sesion-1') =>
  sessions.apply({ sessionId, cwd, status, timestamp: now() })

beforeEach(() => {
  clock = 0
  ids = 0
  const repository = new InMemoryTaskRepository()
  tasks = new TaskService({ repository, now, newId: () => `task-${++ids}` })
  const linker = new SessionLinker(tasks)
  activity = new HookActivityLog()
  sessions = new SessionStatusService(linker, tasks, activity)
})

describe('un proyecto = un icono, siempre', () => {
  it('recorre el ciclo entero sin duplicar la tarea', () => {
    // Le pides algo: se pone a trabajar.
    expect(señal('running').accepted).toBe(true)
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('running')

    // Termina su turno: te espera.
    señal('waiting_user')
    expect(tasks.list()[0]?.status).toBe('waiting_user')

    // Le mandas otra cosa: vuelve a trabajar. MISMA tarea.
    señal('running')
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('running')

    // La sesión acaba: terminada, pendiente de que la revises.
    señal('completed')
    expect(tasks.list()[0]?.status).toBe('completed')

    // La revisas tú: se va al backlog.
    const tarea = tasks.list()[0]
    tasks.changeStatus({ id: tarea?.id, status: 'reviewed', source: 'manual' })
    expect(tasks.list()[0]?.status).toBe('reviewed')

    // Y al mandarle algo nuevo, vuelve a trabajar. Sigue siendo la misma.
    señal('running')
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('running')
  })

  it('trabajar desde subcarpetas distintas no crea iconos nuevos', () => {
    señal('running')
    señal('running', `${CARPETA}/apps/web`)
    señal('waiting_user', `${CARPETA}/packages/core`)

    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('waiting_user')
  })

  it('una tarea que diste por terminada revive al volver a trabajar', () => {
    señal('running')
    const tarea = tasks.list()[0]
    // La cierras tú a mano, no la herramienta.
    tasks.changeStatus({ id: tarea?.id, status: 'completed', source: 'manual' })

    expect(señal('running').accepted).toBe(true)
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('running')
  })

  it('pero lo revisado no lo puede dar por terminado la herramienta sola', () => {
    señal('running')
    const tarea = tasks.list()[0]
    tasks.changeStatus({ id: tarea?.id, status: 'completed', source: 'manual' })
    tasks.changeStatus({ id: tarea?.id, status: 'reviewed', source: 'manual' })

    const resultado = señal('completed')
    expect(resultado.accepted).toBe(false)
    expect(tasks.list()[0]?.status).toBe('reviewed')
  })

  it('proyectos distintos sí tienen iconos distintos', () => {
    señal('running', 'C:/proyectos/uno', 'sesion-uno')
    señal('running', 'C:/proyectos/dos', 'sesion-dos')
    expect(tasks.list()).toHaveLength(2)
  })
})

describe('la ventana de diagnóstico', () => {
  it('anota cada señal que llega y qué se hizo con ella', () => {
    señal('running')
    señal('waiting_user')

    const registro = activity.list()
    expect(registro).toHaveLength(2)
    expect(registro[0]?.event).toBe('sesión → waiting_user')
    expect(registro[0]?.accepted).toBe(true)
    expect(registro[0]?.cwd).toBe(CARPETA)
  })

  it('anota también los rechazos, con su motivo', () => {
    señal('running')
    const tarea = tasks.list()[0]
    tasks.changeStatus({ id: tarea?.id, status: 'completed', source: 'manual' })

    señal('failed')

    const ultimo = activity.list()[0]
    expect(ultimo?.accepted).toBe(false)
    expect(ultimo?.detail).toContain('decidiste')
  })

  it('anota una señal mal formada aunque no se pueda emparejar', () => {
    sessions.apply({ esto: 'no vale' })
    expect(activity.list()[0]?.accepted).toBe(false)
    expect(activity.list()[0]?.taskTitle).toBeNull()
  })

  it('no crece sin límite', () => {
    const corto = new HookActivityLog(3)
    for (let i = 0; i < 10; i += 1) {
      corto.record({ event: `n${i}`, cwd: 'x', accepted: true, detail: '', taskTitle: null })
    }
    expect(corto.list()).toHaveLength(3)
    expect(corto.list()[0]?.event).toBe('n9')
  })
})
