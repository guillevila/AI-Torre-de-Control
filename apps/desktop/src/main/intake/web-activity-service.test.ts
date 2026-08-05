import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { TaskService } from '../services/task-service.js'
import { IntakeService } from './intake-service.js'
import { WebActivityService } from './web-activity-service.js'

/**
 * Etapa 2: la tarea se mueve sola al ver que la conversación empieza o termina.
 *
 * Lo que el vigilante ve es una página web generando texto o dejando de
 * hacerlo. Es una inferencia buena, pero es una inferencia — y este servicio
 * está escrito para que eso se note en los datos y no se le dé más peso del que
 * tiene.
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 12, 0, clock++)).toISOString()
let ids = 0

let tasks: TaskService
let intake: IntakeService
let actividad: WebActivityService

const CHAT = 'https://chatgpt.com/c/abc-123'
const sello = () => new Date(Date.UTC(2026, 7, 4, 13, 0, 0)).toISOString()

const señal = (status: string, externalUrl = CHAT) =>
  actividad.apply({ externalUrl, status, timestamp: sello() })

beforeEach(() => {
  clock = 0
  ids = 0
  tasks = new TaskService({
    repository: new InMemoryTaskRepository(),
    now,
    newId: () => `task-${++ids}`,
  })
  intake = new IntakeService({ taskService: tasks })
  actividad = new WebActivityService({ taskService: tasks })
})

describe('el ciclo que pidió el dueño del proyecto', () => {
  it('registras, empieza a responder, termina: sin tocar nada', () => {
    intake.register({ title: 'Presupuesto Sagasta', externalUrl: CHAT })
    expect(tasks.list()[0]?.status).toBe('queued')

    señal('running')
    expect(tasks.list()[0]?.status).toBe('running')

    señal('completed')
    expect(tasks.list()[0]?.status).toBe('completed')
  })

  it('y vuelve a trabajar si le mandas otra cosa', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    señal('running')
    señal('completed')

    señal('running')
    expect(tasks.list()[0]?.status).toBe('running')
    expect(tasks.list()).toHaveLength(1)
  })

  it('encuentra la tarea aunque la dirección venga con barra o fragmento', () => {
    intake.register({ title: 'x', externalUrl: CHAT })

    expect(señal('running', `${CHAT}/#mensaje-3`).matched).toBe(true)
    expect(tasks.list()[0]?.status).toBe('running')
  })
})

describe('honestidad sobre lo que se ha visto (D8)', () => {
  it('deja dicho que lo vio la extensión', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    señal('running')
    expect(tasks.list()[0]?.statusSource).toBe('browser_extension')
  })

  it('confianza MEDIA: se ha inferido de una página, no lo ha dicho la herramienta', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    señal('running')
    expect(tasks.list()[0]?.statusConfidence).toBe('medium')
  })
})

describe('lo que el vigilante NO puede decir', () => {
  it('no puede declarar que algo ha fallado', () => {
    // Mirar una página no permite saber si el resultado sirve.
    intake.register({ title: 'x', externalUrl: CHAT })
    expect(señal('failed').accepted).toBe(false)
    expect(tasks.list()[0]?.status).toBe('queued')
  })

  it('no puede decir que la herramienta te espera', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    expect(señal('waiting_user').accepted).toBe(false)
  })

  it('no puede archivar ni dar por revisada una tarea', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    expect(señal('archived').accepted).toBe(false)
    expect(señal('reviewed').accepted).toBe(false)
  })

  it('rechaza la petición entera si trae contenido de conversación', () => {
    intake.register({ title: 'x', externalUrl: CHAT })
    const resultado = actividad.apply({
      externalUrl: CHAT,
      status: 'completed',
      timestamp: sello(),
      respuesta: 'el texto que generó',
    })
    expect(resultado.accepted).toBe(false)
  })
})

describe('no crea tareas: registrar sigue siendo tuyo', () => {
  it('una conversación sin registrar se ignora sin ruido', () => {
    const resultado = señal('running', 'https://chatgpt.com/c/nunca-registrada')

    expect(resultado.accepted).toBe(true)
    expect(resultado.matched).toBe(false)
    expect(tasks.list()).toHaveLength(0)
  })

  it('tampoco revive una que archivaste', () => {
    const { taskId } = intake.register({ title: 'x', externalUrl: CHAT })
    tasks.changeStatus({ id: taskId, status: 'archived', source: 'manual' })

    expect(señal('running').matched).toBe(false)
    expect(tasks.list()[0]?.status).toBe('archived')
  })

  it('no mueve la tarea equivocada cuando hay varias', () => {
    intake.register({ title: 'una', externalUrl: 'https://chatgpt.com/c/uno' })
    intake.register({ title: 'otra', externalUrl: 'https://chatgpt.com/c/dos' })

    señal('running', 'https://chatgpt.com/c/dos')

    const [una, otra] = tasks.list()
    expect(una?.status).toBe('queued')
    expect(otra?.status).toBe('running')
  })
})

describe('lo que decidiste tú manda', () => {
  it('una tarea que diste por revisada no la mueve el vigilante', () => {
    const { taskId } = intake.register({ title: 'x', externalUrl: CHAT })
    tasks.changeStatus({ id: taskId, status: 'completed', source: 'manual' })
    tasks.changeStatus({ id: taskId, status: 'reviewed', source: 'manual' })

    señal('completed')
    expect(tasks.list()[0]?.status).toBe('reviewed')
  })

  it('una transición rechazada no rompe nada ni miente sobre el resultado', () => {
    const { taskId } = intake.register({ title: 'x', externalUrl: CHAT })
    tasks.changeStatus({ id: taskId, status: 'completed', source: 'manual' })
    tasks.changeStatus({ id: taskId, status: 'reviewed', source: 'manual' })

    const resultado = señal('completed')

    expect(resultado.accepted).toBe(true)
    // Devuelve el estado REAL, no el que se pidió.
    expect(resultado.status).toBe('reviewed')
  })
})

describe('datos mal formados', () => {
  it('rechaza sin dirección', () => {
    expect(actividad.apply({ status: 'running', timestamp: sello() }).accepted).toBe(false)
  })

  it('rechaza una dirección peligrosa', () => {
    expect(señal('running', 'javascript:alert(1)').accepted).toBe(false)
  })

  it('rechaza sin hora', () => {
    expect(actividad.apply({ externalUrl: CHAT, status: 'running' }).accepted).toBe(false)
  })

  it('explica el motivo', () => {
    const resultado = actividad.apply({ externalUrl: CHAT, status: 'inventado', timestamp: sello() })
    expect(resultado.accepted).toBe(false)
    expect(resultado.reason).toBeTruthy()
  })
})

/**
 * El escenario real del dueño del proyecto: varios chats a la vez.
 *
 * «Uso al mismo tiempo a lo mejor 3 chats de ChatGPT de una cuenta haciendo
 * cosas y otros 2 de otra cuenta, y quiero que todos puedan estar en la Torre».
 *
 * Cada conversación tiene su propia dirección, así que cada una es su propia
 * tarea y se mueve por su cuenta. Esto lo comprueba de verdad en lugar de
 * suponerlo.
 */
describe('cinco conversaciones a la vez, de dos cuentas', () => {
  const CUENTA_A = ['uno', 'dos', 'tres'].map((n) => `https://chatgpt.com/c/a-${n}`)
  const CUENTA_B = ['uno', 'dos'].map((n) => `https://chatgpt.com/c/b-${n}`)
  const TODAS = [...CUENTA_A, ...CUENTA_B]

  beforeEach(() => {
    TODAS.forEach((url, i) => intake.register({ title: `Conversación ${i + 1}`, externalUrl: url }))
  })

  it('las cinco caben en la Torre, cada una con su tarea', () => {
    expect(tasks.list()).toHaveLength(5)
  })

  it('mover una no mueve a las demás', () => {
    señal('running', TODAS[2])

    const estados = tasks.list().map((t) => t.status)
    expect(estados.filter((e) => e === 'running')).toHaveLength(1)
    expect(estados.filter((e) => e === 'queued')).toHaveLength(4)
  })

  it('las cinco pueden estar trabajando a la vez', () => {
    for (const url of TODAS) señal('running', url)
    expect(tasks.list().every((t) => t.status === 'running')).toBe(true)
  })

  it('cada una termina cuando le toca, sin arrastrar a las otras', () => {
    for (const url of TODAS) señal('running', url)

    // Terminan las de una cuenta; las de la otra siguen trabajando.
    for (const url of CUENTA_A) señal('completed', url)

    const porUrl = new Map(tasks.list().map((t) => [t.externalUrl, t.status]))
    for (const url of CUENTA_A) expect(porUrl.get(url)).toBe('completed')
    for (const url of CUENTA_B) expect(porUrl.get(url)).toBe('running')
  })

  it('registrarlas otra vez no crea ni una repetida', () => {
    TODAS.forEach((url, i) => intake.register({ title: `Conversación ${i + 1}`, externalUrl: url }))
    expect(tasks.list()).toHaveLength(5)
  })
})
