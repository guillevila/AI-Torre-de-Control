import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventIngestResult } from '@torre/contracts'
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
