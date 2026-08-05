import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { avisarActividad, conversacionEmpezada, nombrePlataforma, registrar } from './torre.js'

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

/**
 * Lo que sale del navegador en la etapa 2.
 *
 * El vigilante mira una página web, así que aquí es donde más importa
 * comprobar QUÉ acaba saliendo: tres campos, y ninguno de ellos es texto de la
 * conversación.
 */
describe('lo que envía el vigilante', () => {
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
          cuerpo: JSON.parse(Buffer.concat(trozos).toString('utf8')),
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: true, matched: true, status: 'completed' }))
      })
    })
    await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo))
    puerto = servidor.address().port
  })

  afterEach(async () => {
    await new Promise((listo) => servidor.close(listo))
  })

  const avisar = (status = 'completed') =>
    avisarActividad({
      puerto,
      token: 'clave-de-prueba',
      externalUrl: 'https://chatgpt.com/c/abc-123',
      status,
    })

  it('envía EXACTAMENTE tres campos', async () => {
    await avisar()
    expect(Object.keys(recibido.cuerpo).sort()).toEqual(['externalUrl', 'status', 'timestamp'])
  })

  it('y ninguno de ellos es texto de la conversación', async () => {
    await avisar()
    expect(recibido.cuerpo.externalUrl).toBe('https://chatgpt.com/c/abc-123')
    expect(recibido.cuerpo.status).toBe('completed')
    expect(typeof recibido.cuerpo.timestamp).toBe('string')
  })

  it('llama a la ruta de actividad', async () => {
    await avisar()
    expect(recibido.ruta).toBe('/web-activity')
  })

  it('cuenta si la conversación estaba registrada o no', async () => {
    const resultado = await avisar()
    expect(resultado).toMatchObject({ ok: true, emparejada: true })
  })

  it('una conversación desconocida no se trata como fallo', async () => {
    servidor.removeAllListeners('request')
    servidor.on('request', (req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted: true, matched: false }))
      })
    })

    const resultado = await avisar()
    expect(resultado).toMatchObject({ ok: true, emparejada: false })
  })
})

/**
 * Registrar un chat que todavía no existe.
 *
 * Encontrado en uso real: una tarea registrada en `chatgpt.com/` no se movía
 * nunca. Al escribir el primer mensaje, ChatGPT cambia la dirección por la de
 * la conversación, así que el vigilante avisaba sobre una dirección que no
 * coincidía con la guardada. Un muñeco muerto desde que nace.
 */
describe('¿está empezada la conversación?', () => {
  it('un chat en blanco de ChatGPT todavía no lo está', () => {
    expect(conversacionEmpezada('https://chatgpt.com/')).toBe(false)
    expect(conversacionEmpezada('https://chatgpt.com')).toBe(false)
    expect(conversacionEmpezada('https://www.chatgpt.com/?model=auto')).toBe(false)
  })

  it('una conversación de ChatGPT sí', () => {
    expect(conversacionEmpezada('https://chatgpt.com/c/abc-123')).toBe(true)
  })

  it('también los GPT personalizados y los proyectos', () => {
    expect(conversacionEmpezada('https://chatgpt.com/g/g-xyz/c/abc')).toBe(true)
    expect(conversacionEmpezada('https://chatgpt.com/project/abc')).toBe(true)
  })

  it('Claude: /new no, /chat/<id> sí', () => {
    expect(conversacionEmpezada('https://claude.ai/new')).toBe(false)
    expect(conversacionEmpezada('https://claude.ai/')).toBe(false)
    expect(conversacionEmpezada('https://claude.ai/chat/abc-123')).toBe(true)
    expect(conversacionEmpezada('https://claude.ai/cowork/abc')).toBe(true)
  })

  it('ante un sitio que no conocemos, no se estorba', () => {
    // No nos corresponde impedir registrar algo que no sabemos leer.
    expect(conversacionEmpezada('https://una-herramienta.test/lo-que-sea')).toBe(true)
    expect(conversacionEmpezada('https://una-herramienta.test/')).toBe(true)
  })

  it('lo que no es una dirección tampoco estorba', () => {
    expect(conversacionEmpezada('no soy una url')).toBe(true)
  })
})
