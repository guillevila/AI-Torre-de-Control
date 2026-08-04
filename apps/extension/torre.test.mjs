import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nombrePlataforma, registrar } from './torre.js'

/**
 * Lo único de la extensión que se puede probar sin un navegador delante.
 *
 * El resto —leer la pestaña, guardar la clave, hablar con la Torre— depende de
 * las APIs de Chrome, y probarlas de mentira solo demostraría que los remedos
 * funcionan. Lo que sí importa comprobar aquí es que la etiqueta que ves antes
 * de pulsar «Registrar» dice la verdad sobre dónde estás.
 */
describe('nombre de la plataforma que se enseña antes de registrar', () => {
  it('reconoce ChatGPT en sus dos dominios', () => {
    expect(nombrePlataforma('https://chatgpt.com/c/abc')).toBe('ChatGPT')
    expect(nombrePlataforma('https://chat.openai.com/c/abc')).toBe('ChatGPT')
    expect(nombrePlataforma('https://www.chatgpt.com/c/abc')).toBe('ChatGPT')
  })

  it('reconoce las demás herramientas conocidas', () => {
    expect(nombrePlataforma('https://claude.ai/chat/1')).toBe('Claude')
    expect(nombrePlataforma('https://gemini.google.com/app/1')).toBe('Gemini')
    expect(nombrePlataforma('https://copilot.microsoft.com/')).toBe('Copilot')
  })

  it('no se deja engañar por un dominio que solo lo parece', () => {
    // `chatgpt.com.malo.test` NO es ChatGPT. El patrón exige que el dominio
    // termine ahí, no que lo contenga.
    expect(nombrePlataforma('https://chatgpt.com.malo.test/c/1')).toBeNull()
    expect(nombrePlataforma('https://nochatgpt.com/c/1')).toBeNull()
  })

  it('calla cuando no reconoce el sitio, en vez de inventarse uno', () => {
    expect(nombrePlataforma('https://example.test/algo')).toBeNull()
  })

  it('aguanta una dirección que no es una dirección', () => {
    expect(nombrePlataforma('no soy una url')).toBeNull()
    expect(nombrePlataforma('')).toBeNull()
  })
})

/**
 * Lo que sale del navegador, comprobado contra un servidor de verdad.
 *
 * Esta es LA prueba de la promesa: la extensión no puede filtrar el contenido
 * de una conversación porque no envía nada más que dos campos. Se comprueba
 * mirando el cuerpo exacto que llega al otro lado, no leyendo el código.
 */
describe('lo que la extensión envía de verdad', () => {
  let servidor
  let puerto
  let recibido

  beforeEach(async () => {
    recibido = null
    servidor = createServer((req, res) => {
      const trozos = []
      req.on('data', (t) => trozos.push(t))
      req.on('end', () => {
        recibido = {
          ruta: req.url,
          clave: req.headers['x-torre-token'],
          tipo: req.headers['content-type'],
          cuerpo: JSON.parse(Buffer.concat(trozos).toString('utf8')),
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: true, taskId: 'task-1', duplicate: false }))
      })
    })
    await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo))
    puerto = servidor.address().port
  })

  afterEach(async () => {
    await new Promise((listo) => servidor.close(listo))
  })

  const enviar = () =>
    registrar({
      puerto,
      token: 'clave-de-prueba',
      title: 'Presupuesto Sagasta',
      externalUrl: 'https://chatgpt.com/c/abc-123',
    })

  it('envía EXACTAMENTE dos campos, y ninguno más', async () => {
    await enviar()
    expect(Object.keys(recibido.cuerpo).sort()).toEqual(['externalUrl', 'title'])
  })

  it('esos dos campos son el título y el enlace', async () => {
    await enviar()
    expect(recibido.cuerpo).toEqual({
      title: 'Presupuesto Sagasta',
      externalUrl: 'https://chatgpt.com/c/abc-123',
    })
  })

  it('lleva la clave local y se declara como JSON', async () => {
    await enviar()
    expect(recibido.clave).toBe('clave-de-prueba')
    expect(recibido.tipo).toBe('application/json')
  })

  it('llama a la ruta de altas', async () => {
    await enviar()
    expect(recibido.ruta).toBe('/tasks')
  })

  it('avisa de que ya estaba registrada, sin fingir un alta nueva', async () => {
    servidor.removeAllListeners('request')
    servidor.on('request', (req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: true, taskId: 'task-1', duplicate: true }))
      })
    })

    const resultado = await enviar()
    expect(resultado).toMatchObject({ ok: true, duplicada: true })
  })

  it('distingue una clave equivocada de un rechazo cualquiera', async () => {
    servidor.removeAllListeners('request')
    servidor.on('request', (req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: false, reason: 'Token local ausente o incorrecto' }))
      })
    })

    const resultado = await enviar()
    expect(resultado).toMatchObject({ ok: false, motivo: 'clave' })
  })

  it('repite el motivo que da la Torre, en lugar de inventarse uno', async () => {
    servidor.removeAllListeners('request')
    servidor.on('request', (req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(422, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: false, reason: 'La URL debe empezar por http://' }))
      })
    })

    const resultado = await enviar()
    expect(resultado.ok).toBe(false)
    expect(resultado.mensaje).toContain('http://')
  })
})
