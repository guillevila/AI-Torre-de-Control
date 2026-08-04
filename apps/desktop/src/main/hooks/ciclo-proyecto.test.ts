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

    // Termina su turno: te ENTREGA algo. A la mesa de entregas, no a tu puerta.
    señal('completed')
    expect(tasks.list()[0]?.status).toBe('completed')

    // Le mandas otra cosa: vuelve a trabajar. MISMA tarea.
    señal('running')
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('running')

    // Ahora sí te PIDE algo: se planta en tu puerta.
    señal('waiting_user')
    expect(tasks.list()[0]?.status).toBe('waiting_user')

    // Lo resuelves y sigue; al acabar, otra entrega.
    señal('running')
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

/**
 * D23-bis. El fallo que arregla esto: dos conversaciones abiertas en el mismo
 * repositorio compartían tarea y cada señal sobrescribía el identificador de la
 * otra. El estado acababa siendo el de la última señal recibida, así que si una
 * conversación te esperaba y la otra terminaba, **el «te espera» desaparecía**.
 */
describe('varias conversaciones en el mismo proyecto (D23-bis)', () => {
  it('cada conversación tiene su icono', () => {
    señal('running', CARPETA, 'sesion-A')
    señal('running', CARPETA, 'sesion-B')

    expect(tasks.list()).toHaveLength(2)
  })

  it('el «te espera» de una no lo borra la otra al terminar', () => {
    señal('waiting_user', CARPETA, 'sesion-A')
    señal('completed', CARPETA, 'sesion-B')

    const estados = tasks.list().map((tarea) => tarea.status)
    expect(estados).toContain('waiting_user')
    expect(estados).toContain('completed')
  })

  it('cada conversación conserva su propio identificador, sin pisarse', () => {
    señal('running', CARPETA, 'sesion-A')
    señal('running', CARPETA, 'sesion-B')
    // Vuelve a hablar la primera: debe caer en SU tarea, no en la de la otra.
    señal('waiting_user', CARPETA, 'sesion-A')

    const deA = tasks.list().find((tarea) => tarea.externalSessionId === 'sesion-A')
    const deB = tasks.list().find((tarea) => tarea.externalSessionId === 'sesion-B')
    expect(deA?.status).toBe('waiting_user')
    expect(deB?.status).toBe('running')
    expect(tasks.list()).toHaveLength(2)
  })

  it('la misma conversación desde subcarpetas distintas sigue siendo un solo icono', () => {
    señal('running', CARPETA, 'sesion-A')
    señal('running', `${CARPETA}/apps/web`, 'sesion-A')
    señal('waiting_user', `${CARPETA}/packages/core`, 'sesion-A')

    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.status).toBe('waiting_user')
  })

  it('no acumula iconos: una tarea revisada la adopta la conversación siguiente', () => {
    // Es lo que evita que abrir sesiones un día tras otro llene la oficina.
    señal('running', CARPETA, 'sesion-A')
    const tarea = tasks.list()[0]
    tasks.changeStatus({ id: tarea?.id, status: 'completed', source: 'manual' })
    tasks.changeStatus({ id: tarea?.id, status: 'reviewed', source: 'manual' })

    señal('running', CARPETA, 'sesion-B')

    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.externalSessionId).toBe('sesion-B')
  })

  it('la segunda conversación lleva el código de sesión en el título', () => {
    señal('running', CARPETA, 'sesion-A')
    señal('running', CARPETA, 'sesion-B-larga-0123456789')

    const titulos = tasks.list().map((tarea) => tarea.title)
    // La primera conserva el título limpio; solo la que llega después se marca.
    expect(titulos.some((titulo) => /· sesion$/.test(titulo))).toBe(true)
  })

  it('sin identificador de sesión sigue emparejando por carpeta', () => {
    // Perder una señal es peor que compartir una tarea: si no hay forma de
    // distinguir, se mantiene el comportamiento de siempre.
    señal('running', CARPETA, null)
    señal('waiting_user', CARPETA, null)

    expect(tasks.list()).toHaveLength(1)
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
