import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventIngestResult, HandoffResolution } from '@torre/contracts'
import { LocalEventServer } from './local-event-server.js'

/**
 * Tests del receptor local con peticiones HTTP de verdad.
 *
 * Comprueban las barreras de seguridad una por una, porque este es el único
 * punto de la aplicación al que puede llegar algo desde fuera del proceso.
 */

const TOKEN = 'a'.repeat(64)

let server: LocalEventServer
let base: string
let onEvent: ReturnType<typeof vi.fn>

const validEvent = {
  type: 'status_changed',
  taskId: 'task-1',
  status: 'completed',
  source: 'local_event',
  confidence: 'high',
  timestamp: '2026-08-03T12:00:00Z',
}

const post = (body: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${base}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN, ...headers },
    body,
  })

beforeEach(async () => {
  onEvent = vi.fn(
    (): EventIngestResult => ({ accepted: true, taskId: 'task-1', status: 'completed' }),
  )
  server = new LocalEventServer({ token: TOKEN, ports: [0], onEvent })
  const address = await server.start()
  base = `http://${address.host}:${address.port}`
})

afterEach(async () => {
  await server.stop()
})

describe('dónde escucha (D17)', () => {
  it('se ata exclusivamente a 127.0.0.1', () => {
    expect(server.getAddress()?.host).toBe('127.0.0.1')
  })

  it('responde al chequeo de salud sin revelar datos', async () => {
    const res = await fetch(`${base}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('token local', () => {
  it('acepta el evento con el token correcto', async () => {
    const res = await post(JSON.stringify(validEvent))
    expect(res.status).toBe(200)
    expect(onEvent).toHaveBeenCalledOnce()
  })

  it('rechaza si falta el token', async () => {
    const res = await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validEvent),
    })
    expect(res.status).toBe(401)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('rechaza un token incorrecto', async () => {
    const res = await post(JSON.stringify(validEvent), { 'x-torre-token': 'b'.repeat(64) })
    expect(res.status).toBe(401)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('rechaza un token de longitud distinta', async () => {
    const res = await post(JSON.stringify(validEvent), { 'x-torre-token': 'corto' })
    expect(res.status).toBe(401)
  })
})

describe('forma de la petición', () => {
  it('exige application/json', async () => {
    const res = await post(JSON.stringify(validEvent), { 'Content-Type': 'text/plain' })
    expect(res.status).toBe(415)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('admite application/json con codificación', async () => {
    const res = await post(JSON.stringify(validEvent), {
      'Content-Type': 'application/json; charset=utf-8',
    })
    expect(res.status).toBe(200)
  })

  it('rechaza un cuerpo que no es JSON', async () => {
    const res = await post('esto no es json')
    expect(res.status).toBe(400)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('rechaza cuerpos desproporcionados', async () => {
    const enorme = JSON.stringify({ ...validEvent, relleno: 'x'.repeat(32 * 1024) })
    const res = await post(enorme)
    expect(res.status).toBe(413)
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('no expone ninguna otra ruta', async () => {
    expect((await fetch(`${base}/`)).status).toBe(404)
    expect((await fetch(`${base}/tasks`)).status).toBe(404)
    expect((await fetch(`${base}/events`)).status).toBe(404) // GET no vale
  })

  it('no devuelve cabeceras que permitan usarlo desde una web', async () => {
    const res = await fetch(`${base}/health`)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('contenido del evento', () => {
  it('devuelve 422 cuando el evento no cumple el contrato', async () => {
    onEvent.mockReturnValue({ accepted: false, reason: 'El evento no cumple el contrato' })
    const res = await post(JSON.stringify({ type: 'status_changed' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ accepted: false })
  })

  it('entrega el evento tal cual al servicio, sin interpretarlo', async () => {
    await post(JSON.stringify(validEvent))
    expect(onEvent).toHaveBeenCalledWith(validEvent)
  })
})

describe('ciclo de vida', () => {
  it('deja de responder tras pararse', async () => {
    await server.stop()
    await expect(fetch(`${base}/health`)).rejects.toThrow()
  })
})

/**
 * Alta de tareas desde el navegador.
 *
 * Es la única ruta que CREA algo, así que se comprueba una por una que le
 * aplican las mismas barreras que al resto: si esta se relajara, se relajaría
 * la puerta por la que entra todo.
 */
describe('ruta de alta desde el navegador', () => {
  const TAREA = {
    title: 'Presupuesto Sagasta',
    externalUrl: 'https://chatgpt.com/c/abc-123',
  }

  let servidorConAlta: LocalEventServer
  let baseConAlta: string
  let onIntake: ReturnType<typeof vi.fn>

  const alta = (cuerpo: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    fetch(`${baseConAlta}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN, ...headers },
      body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    })

  beforeEach(async () => {
    onIntake = vi.fn(() => ({ accepted: true, taskId: 'task-9', duplicate: false }))
    servidorConAlta = new LocalEventServer({
      token: TOKEN,
      ports: [0],
      onEvent,
      onIntake: onIntake as unknown as (raw: unknown) => never,
    })
    const address = await servidorConAlta.start()
    baseConAlta = `http://${address.host}:${address.port}`
  })

  afterEach(async () => {
    await servidorConAlta.stop()
  })

  it('registra la tarea con la clave correcta', async () => {
    const res = await alta(TAREA)
    expect(res.status).toBe(200)
    expect(onIntake).toHaveBeenCalledWith(TAREA)
  })

  it('sin clave no llega a crear nada', async () => {
    const res = await fetch(`${baseConAlta}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TAREA),
    })
    expect(res.status).toBe(401)
    expect(onIntake).not.toHaveBeenCalled()
  })

  it('con la clave equivocada tampoco', async () => {
    const res = await alta(TAREA, { 'x-torre-token': 'b'.repeat(64) })
    expect(res.status).toBe(401)
    expect(onIntake).not.toHaveBeenCalled()
  })

  it('exige que el contenido se declare como JSON', async () => {
    // Es la barrera que obliga a cualquier página web a pedir permiso previo,
    // permiso que este receptor no concede nunca.
    const res = await alta(TAREA, { 'Content-Type': 'text/plain' })
    expect(res.status).toBe(415)
    expect(onIntake).not.toHaveBeenCalled()
  })

  it('un cuerpo desmedido no llega al servicio', async () => {
    const res = await alta(JSON.stringify({ ...TAREA, relleno: 'x'.repeat(20_000) }))
    expect(res.status).toBe(413)
    expect(onIntake).not.toHaveBeenCalled()
  })

  it('devuelve 422 cuando el servicio rechaza los datos', async () => {
    onIntake.mockReturnValue({ accepted: false, reason: 'Falta el enlace' })
    const res = await alta({ title: 'x' })
    expect(res.status).toBe(422)
  })

  it('no contesta con cabeceras que dejen leer a una página web', async () => {
    const res = await alta(TAREA)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('sin atendedor de altas, la ruta no existe', () => {
  it('devuelve 404 en lugar de fingir que acepta', async () => {
    // El servidor de arriba se crea SIN `onIntake`.
    const res = await fetch(`${base}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN },
      body: JSON.stringify({ title: 'x', externalUrl: 'https://chatgpt.com/c/1' }),
    })
    expect(res.status).toBe(404)
  })

  it('y ni siquiera comprueba la clave: la ruta no está', async () => {
    const res = await fetch(`${base}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(404)
  })
})

/**
 * Ruta de actividad del navegador (etapa 2).
 *
 * Mueve tareas que ya existen, así que se comprueba que le aplican las mismas
 * barreras: una ruta que mueve estados sin clave sería tan grave como una que
 * los crea.
 */
describe('ruta de actividad del navegador', () => {
  const SEÑAL = {
    externalUrl: 'https://chatgpt.com/c/abc-123',
    status: 'completed',
    timestamp: '2026-08-04T12:00:00Z',
  }

  let servidor: LocalEventServer
  let baseActividad: string
  let onWebActivity: ReturnType<typeof vi.fn>

  const enviar = (cuerpo: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    fetch(`${baseActividad}/web-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN, ...headers },
      body: JSON.stringify(cuerpo),
    })

  beforeEach(async () => {
    onWebActivity = vi.fn(() => ({ accepted: true, matched: true, taskId: 'task-1' }))
    servidor = new LocalEventServer({
      token: TOKEN,
      ports: [0],
      onEvent,
      onWebActivity: onWebActivity as unknown as (raw: unknown) => never,
    })
    const address = await servidor.start()
    baseActividad = `http://${address.host}:${address.port}`
  })

  afterEach(async () => {
    await servidor.stop()
  })

  it('mueve la tarea con la clave correcta', async () => {
    const res = await enviar(SEÑAL)
    expect(res.status).toBe(200)
    expect(onWebActivity).toHaveBeenCalledWith(SEÑAL)
  })

  it('sin clave no mueve nada', async () => {
    const res = await fetch(`${baseActividad}/web-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SEÑAL),
    })
    expect(res.status).toBe(401)
    expect(onWebActivity).not.toHaveBeenCalled()
  })

  it('con la clave equivocada tampoco', async () => {
    const res = await enviar(SEÑAL, { 'x-torre-token': 'b'.repeat(64) })
    expect(res.status).toBe(401)
    expect(onWebActivity).not.toHaveBeenCalled()
  })

  it('exige que el contenido se declare como JSON', async () => {
    const res = await enviar(SEÑAL, { 'Content-Type': 'text/plain' })
    expect(res.status).toBe(415)
    expect(onWebActivity).not.toHaveBeenCalled()
  })

  it('devuelve 422 cuando el servicio rechaza la señal', async () => {
    onWebActivity.mockReturnValue({ accepted: false, reason: 'Estado no admitido' })
    const res = await enviar({ ...SEÑAL, status: 'failed' })
    expect(res.status).toBe(422)
  })

  it('una conversación desconocida NO es un error', async () => {
    // Registrar sigue siendo del usuario: el vigilante puede estar mirando una
    // pestaña que nunca se dio de alta, y eso no debe parecer un fallo.
    onWebActivity.mockReturnValue({ accepted: true, matched: false })
    const res = await enviar(SEÑAL)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ matched: false })
  })

  it('sin atendedor, la ruta no existe', async () => {
    const res = await fetch(`${base}/web-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN },
      body: JSON.stringify(SEÑAL),
    })
    expect(res.status).toBe(404)
  })
})

/**
 * Qué pasa cuando quien esperaba se marcha a media espera (D24).
 *
 * Es el caso real de una sesión de Claude Code abierta antes de actualizar el
 * enlace: conserva un tope de tiempo más corto que el de la Torre y mata el
 * proceso mientras el aviso sigue en pantalla contando. Si el receptor no
 * avisara, la Torre te dejaría escribir una respuesta que no puede llegar a
 * ningún sitio.
 */
describe('el fin de turno avisa cuando lo dejan colgado', () => {
  let propio: LocalEventServer
  let url: string
  let abandonada: ReturnType<typeof vi.fn>
  let soltar: (valor: HandoffResolution) => void

  beforeEach(async () => {
    abandonada = vi.fn()
    // Se limpia entre pruebas: si no, la segunda suelta la promesa de la primera
    // y su propia llamada se queda esperando para siempre.
    soltar = undefined as unknown as typeof soltar
    propio = new LocalEventServer({
      token: TOKEN,
      ports: [0],
      onEvent,
      // Se queda esperando indefinidamente, como una entrega de verdad.
      onHandoff: () =>
        new Promise((resolve) => {
          soltar = resolve
        }),
      onHandoffAbandoned: abandonada,
    })
    const address = await propio.start()
    url = `http://${address.host}:${address.port}/handoffs`
  })

  afterEach(async () => {
    await propio.stop()
  })

  const entrega = {
    requestId: 'req-12345678',
    sessionId: null,
    cwd: 'C:/proyecto',
    message: 'He terminado. ¿Sigo?',
    timestamp: '2026-08-06T10:00:00Z',
  }

  it('avisa con la petición entera al cortarse la conexión', async () => {
    const controller = new AbortController()
    const llamada = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN },
      body: JSON.stringify(entrega),
      signal: controller.signal,
    }).catch(() => null)

    // Se espera a que el receptor tenga la petición en la mano.
    await vi.waitUntil(() => soltar !== undefined, { timeout: 2_000 })

    controller.abort()
    await llamada

    // Llega la petición entera, para poder identificar CUÁL se retira.
    await vi.waitFor(() => expect(abandonada).toHaveBeenCalledWith(entrega))
  })

  it('no avisa cuando la respuesta sí llegó a tiempo', async () => {
    const llamada = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-torre-token': TOKEN },
      body: JSON.stringify(entrega),
    })

    await vi.waitUntil(() => soltar !== undefined, { timeout: 2_000 })
    soltar({ outcome: 'reply', reply: 'sigue', reason: 'contestaste' })

    const res = await llamada
    expect(res.status).toBe(200)

    // La conexión se cierra después de contestar, y eso NO es abandono: si lo
    // fuera, cada respuesta correcta retiraría un aviso que ya no existe.
    await new Promise((r) => setTimeout(r, 50))
    expect(abandonada).not.toHaveBeenCalled()
  })
})
