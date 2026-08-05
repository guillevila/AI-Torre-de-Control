import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { TaskService } from '../services/task-service.js'
import { IntakeService } from './intake-service.js'
import { WebActivityService } from './web-activity-service.js'

/**
 * El alta que llega del navegador.
 *
 * Regla que gobierna todo lo de abajo: de una conversación registrada desde el
 * navegador **solo sabemos que existe**. Nadie ha dicho todavía que esté
 * trabajando ni que haya terminado, y la Torre no debe fingir que sí.
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 12, 0, clock++)).toISOString()
let ids = 0

let tasks: TaskService
let intake: IntakeService

const CHATGPT = 'https://chatgpt.com/c/abc-123'

beforeEach(() => {
  clock = 0
  ids = 0
  tasks = new TaskService({
    repository: new InMemoryTaskRepository(),
    now,
    newId: () => `task-${++ids}`,
  })
  intake = new IntakeService({ taskService: tasks })
})

describe('registrar una conversación', () => {
  it('crea la tarea y la devuelve', () => {
    const resultado = intake.register({ title: 'Presupuesto Sagasta', externalUrl: CHATGPT })

    expect(resultado.accepted).toBe(true)
    expect(resultado.duplicate).toBe(false)
    expect(tasks.list()).toHaveLength(1)
    expect(tasks.list()[0]?.title).toBe('Presupuesto Sagasta')
  })

  it('deduce la plataforma del enlace', () => {
    intake.register({ title: 'x', externalUrl: CHATGPT })
    expect(tasks.list()[0]?.provider).toBe('chatgpt')
  })

  it('no se inventa una plataforma que no reconoce', () => {
    intake.register({ title: 'x', externalUrl: 'https://una-herramienta-rara.test/chat/1' })
    expect(tasks.list()[0]?.provider).toBe('other')
  })

  it('guarda el enlace para poder volver a la conversación', () => {
    intake.register({ title: 'x', externalUrl: CHATGPT })
    expect(tasks.list()[0]?.externalUrl).toBe(CHATGPT)
  })
})

describe('honestidad sobre lo que sabemos (D8)', () => {
  it('nace «en cola», no «trabajando»', () => {
    // Registrarla no significa que ChatGPT esté haciendo nada.
    intake.register({ title: 'x', externalUrl: CHATGPT })
    expect(tasks.list()[0]?.status).toBe('queued')
  })

  it('deja dicho que vino de la extensión, no de tu mano', () => {
    intake.register({ title: 'x', externalUrl: CHATGPT })
    expect(tasks.list()[0]?.statusSource).toBe('browser_extension')
  })

  it('con confianza BAJA: nadie ha confirmado ese estado', () => {
    intake.register({ title: 'x', externalUrl: CHATGPT })
    expect(tasks.list()[0]?.statusConfidence).toBe('low')
  })

  it('la primera línea del historial dice la verdad', () => {
    const { taskId } = intake.register({ title: 'x', externalUrl: CHATGPT })
    const historial = tasks.history(taskId)

    expect(historial[0]?.source).toBe('browser_extension')
    expect(historial[0]?.confidence).toBe('low')
  })
})

describe('no duplicar: un icono por conversación', () => {
  it('registrar dos veces la misma no crea dos tareas', () => {
    intake.register({ title: 'Presupuesto', externalUrl: CHATGPT })
    const segunda = intake.register({ title: 'Presupuesto', externalUrl: CHATGPT })

    expect(segunda.accepted).toBe(true)
    expect(segunda.duplicate).toBe(true)
    expect(tasks.list()).toHaveLength(1)
  })

  it('devuelve la tarea que ya existía, con su estado actual', () => {
    const primera = intake.register({ title: 'Presupuesto', externalUrl: CHATGPT })
    tasks.changeStatus({ id: primera.taskId, status: 'running', source: 'manual' })

    const segunda = intake.register({ title: 'Presupuesto', externalUrl: CHATGPT })

    expect(segunda.taskId).toBe(primera.taskId)
    expect(segunda.status).toBe('running')
  })

  /**
   * El navegador cambia la dirección solo mientras navegas: añade y quita la
   * barra final y el trozo tras la almohadilla. Tratarlas como conversaciones
   * distintas llenaría la Torre de gemelas.
   */
  it('ignora la barra final y el fragmento', () => {
    intake.register({ title: 'x', externalUrl: CHATGPT })
    intake.register({ title: 'x', externalUrl: `${CHATGPT}/` })
    intake.register({ title: 'x', externalUrl: `${CHATGPT}#seccion` })

    expect(tasks.list()).toHaveLength(1)
  })

  it('pero los parámetros SÍ distinguen', () => {
    // Hay herramientas que identifican la conversación ahí. Unirlas sería peor.
    intake.register({ title: 'x', externalUrl: 'https://una.test/chat?id=1' })
    intake.register({ title: 'x', externalUrl: 'https://una.test/chat?id=2' })

    expect(tasks.list()).toHaveLength(2)
  })

  it('conversaciones distintas del mismo sitio son tareas distintas', () => {
    intake.register({ title: 'a', externalUrl: 'https://chatgpt.com/c/uno' })
    intake.register({ title: 'b', externalUrl: 'https://chatgpt.com/c/dos' })

    expect(tasks.list()).toHaveLength(2)
  })
})

describe('lo que no se acepta', () => {
  it('rechaza sin enlace', () => {
    expect(intake.register({ title: 'Algo' }).accepted).toBe(false)
    expect(tasks.list()).toHaveLength(0)
  })

  it('rechaza un enlace peligroso', () => {
    expect(
      intake.register({ title: 'x', externalUrl: 'javascript:alert(1)' }).accepted,
    ).toBe(false)
    expect(tasks.list()).toHaveLength(0)
  })

  it('rechaza la petición entera si trae contenido de conversación', () => {
    const resultado = intake.register({
      title: 'x',
      externalUrl: CHATGPT,
      prompt: 'lo que escribí',
    })

    expect(resultado.accepted).toBe(false)
    expect(tasks.list()).toHaveLength(0)
  })

  it('explica por qué, en lugar de fallar en seco', () => {
    const resultado = intake.register({ title: '', externalUrl: CHATGPT })
    expect(resultado.accepted).toBe(false)
    expect(resultado.reason).toBeTruthy()
  })
})

/**
 * Registrar una conversación que archivaste.
 *
 * Encontrado en uso real: el dueño del proyecto pulsó «Registrar», la extensión
 * contestó «ya está añadida» y no aparecía nada en ninguna pantalla. La tarea
 * existía, pero archivada — o sea invisible. Una respuesta cierta y a la vez
 * inservible, que es la peor clase de respuesta.
 */
describe('una conversación archivada se recupera, no se ignora', () => {
  const archivar = (id: string | undefined) =>
    tasks.changeStatus({ id, status: 'archived', source: 'manual' })

  it('la desarchiva en lugar de dejarte buscando algo invisible', () => {
    const primera = intake.register({ title: 'Análisis', externalUrl: CHATGPT })
    archivar(primera.taskId)

    const segunda = intake.register({ title: 'Análisis', externalUrl: CHATGPT })

    expect(segunda.revived).toBe(true)
    expect(tasks.list()[0]?.status).toBe('queued')
  })

  it('sigue siendo la MISMA tarea, con su historial', () => {
    const primera = intake.register({ title: 'Análisis', externalUrl: CHATGPT })
    archivar(primera.taskId)

    const segunda = intake.register({ title: 'Análisis', externalUrl: CHATGPT })

    expect(segunda.taskId).toBe(primera.taskId)
    expect(tasks.list()).toHaveLength(1)
  })

  it('la recuperación consta como MANUAL: la pediste tú con un clic', () => {
    // El vigilante infiere estados mirando una página; esto es un botón que
    // pulsas. Por eso puede levantar el candado que protege lo que archivaste.
    const primera = intake.register({ title: 'Análisis', externalUrl: CHATGPT })
    archivar(primera.taskId)
    intake.register({ title: 'Análisis', externalUrl: CHATGPT })

    expect(tasks.list()[0]?.statusSource).toBe('manual')
  })

  it('una tarea que NO estaba archivada no se toca', () => {
    const primera = intake.register({ title: 'Análisis', externalUrl: CHATGPT })
    tasks.changeStatus({ id: primera.taskId, status: 'running', source: 'manual' })

    const segunda = intake.register({ title: 'Análisis', externalUrl: CHATGPT })

    expect(segunda.revived).toBeFalsy()
    expect(segunda.duplicate).toBe(true)
    expect(tasks.list()[0]?.status).toBe('running')
  })

  it('y la actividad del vigilante vuelve a alcanzarla', () => {
    // Antes no: una tarea archivada se ignoraba, así que recuperarla sin más
    // habría dejado un icono que no se movía nunca.
    const primera = intake.register({ title: 'Análisis', externalUrl: CHATGPT })
    archivar(primera.taskId)
    intake.register({ title: 'Análisis', externalUrl: CHATGPT })

    const actividad = new WebActivityService({ taskService: tasks })
    const resultado = actividad.apply({
      externalUrl: CHATGPT,
      status: 'running',
      timestamp: new Date(Date.UTC(2026, 7, 5, 10, 0, 0)).toISOString(),
    })

    expect(resultado.matched).toBe(true)
    expect(tasks.list()[0]?.status).toBe('running')
  })
})
