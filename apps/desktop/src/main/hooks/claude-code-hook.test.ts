import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Prueba del enlace REAL, ejecutándolo como lo ejecuta Claude Code.
 *
 * No importa el módulo ni prueba una copia: levanta una Torre de mentira, lanza
 * `node claude-code-hook.mjs` con una petición por la entrada estándar y mira
 * qué escribe por la salida. Es la única forma de comprobar el contrato de
 * verdad, que es donde estuvo el fallo:
 *
 * Durante un tiempo el enlace contestaba a `PermissionRequest` con el formato
 * de `PreToolUse`. No daba ningún error —Claude Code se limitaba a ignorar la
 * decisión y preguntar en la terminal—, así que desde fuera parecía que el
 * enlace no funcionaba, cuando lo único mal era el nombre de un campo.
 *
 * Un fallo mudo solo se caza con una prueba que hable el mismo idioma.
 */

const SCRIPT = fileURLToPath(new URL('./claude-code-hook.mjs', import.meta.url))
const TOKEN = 'clave-de-prueba'

interface Recibido {
  path: string
  body: Record<string, unknown>
}

let server: Server
let dataDir: string
let recibidas: Recibido[]
/** Lo que la Torre de mentira contesta a una petición de permiso. */
let respuesta: Record<string, unknown> | null

beforeEach(async () => {
  recibidas = []
  respuesta = null

  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      recibidas.push({ path: req.url ?? '', body })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(respuesta ?? { accepted: true }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port

  dataDir = mkdtempSync(join(tmpdir(), 'torre-hook-'))
  writeFileSync(
    join(dataDir, 'event-endpoint.json'),
    JSON.stringify({ host: '127.0.0.1', port, token: TOKEN }),
  )
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dataDir, { recursive: true, force: true })
})

/** Ejecuta el enlace igual que lo ejecuta Claude Code y devuelve lo que escribe. */
function ejecutar(payload: unknown): Promise<{ salida: string; codigo: number }> {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [SCRIPT], {
      // El registro de sesiones se aísla SIEMPRE a una carpeta del test: si no,
      // el hook leería el registro real del ordenador donde corren los tests.
      env: {
        ...process.env,
        TORRE_USER_DATA: dataDir,
        TORRE_CLAUDE_SESSIONS: join(dataDir, 'registro-sesiones'),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let salida = ''
    hijo.stdout.on('data', (c: Buffer) => {
      salida += c.toString('utf8')
    })
    hijo.on('close', (codigo) => resolve({ salida, codigo: codigo ?? 0 }))

    hijo.stdin.write(JSON.stringify(payload))
    hijo.stdin.end()
  })
}

const peticionDePermiso = (extra: Record<string, unknown> = {}) => ({
  hook_event_name: 'PermissionRequest',
  session_id: 'sesion-1',
  cwd: 'C:/proyectos/mi-app',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf temporal' },
  ...extra,
})

describe('peticiones de permiso: el sobre correcto', () => {
  it('contesta a PermissionRequest con decision.behavior, no con permissionDecision', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida, codigo } = await ejecutar(peticionDePermiso())
    const contestacion = JSON.parse(salida)

    expect(codigo).toBe(0)
    expect(contestacion.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(contestacion.hookSpecificOutput.decision.behavior).toBe('allow')
    // El campo de PreToolUse NO debe aparecer: es lo que rompía el enlace.
    expect(contestacion.hookSpecificOutput.permissionDecision).toBeUndefined()
  })

  it('al aceptar devuelve la orden original sin tocarla', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida } = await ejecutar(peticionDePermiso())
    const decision = JSON.parse(salida).hookSpecificOutput.decision

    expect(decision.updatedInput).toEqual({ command: 'rm -rf temporal' })
  })

  it('al rechazar dice deny y explica de dónde vino la decisión', async () => {
    respuesta = { outcome: 'deny', reason: 'Lo rechazaste en la Torre' }

    const { salida } = await ejecutar(peticionDePermiso())
    const contestacion = JSON.parse(salida)

    expect(contestacion.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(contestacion.systemMessage).toContain('rechazaste')
  })

  it('a PreToolUse sí le contesta en SU formato', async () => {
    respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

    const { salida } = await ejecutar(
      peticionDePermiso({ hook_event_name: 'PreToolUse' }),
    )
    const salidaHook = JSON.parse(salida).hookSpecificOutput

    expect(salidaHook.permissionDecision).toBe('allow')
    expect(salidaHook.decision).toBeUndefined()
  })

  it('manda el comando ENTERO para que puedas decidir con criterio', async () => {
    respuesta = { outcome: 'allow', reason: 'ok' }

    await ejecutar(peticionDePermiso())
    const enviado = recibidas.find((r) => r.path === '/permissions')

    expect(enviado?.body.toolName).toBe('Bash')
    expect(enviado?.body.detail).toBe('rm -rf temporal')
  })
})

describe('nunca estorba a Claude Code (D21)', () => {
  it('si se agota el tiempo no contesta nada y deja que pregunte él', async () => {
    respuesta = { outcome: 'timeout', reason: 'nadie decidió' }

    const { salida, codigo } = await ejecutar(peticionDePermiso())

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })

  it('no contesta una decisión que esta petición no admite', async () => {
    respuesta = { outcome: 'deny', reason: 'rechazado' }

    // Claude Code avisa de que aquí solo cabe aceptar.
    const { salida, codigo } = await ejecutar(
      peticionDePermiso({ permission_suggestions: ['allow'] }),
    )

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })

  /**
   * La cautela que costó una tarde.
   *
   * La comprobación de arriba, escrita sin cuidado, descartaba decisiones
   * humanas en silencio en cuanto ese campo venía con una forma inesperada: el
   * dueño del proyecto pulsaba «Aceptar» y no pasaba nada, sin ningún error.
   *
   * Ante un campo que no se entiende, la decisión SIEMPRE gana. Preferimos
   * contestar de más que tragarnos un clic.
   */
  describe('un campo raro nunca puede tragarse tu decisión', () => {
    const formasRaras: ReadonlyArray<readonly [string, unknown]> = [
      ['una lista de objetos', [{ behavior: 'allow' }, { behavior: 'deny' }]],
      ['una lista vacía', []],
      ['un texto suelto', 'allow'],
      ['un objeto', { allow: true }],
      ['nulo', null],
      ['una lista mezclada', ['allow', { behavior: 'deny' }]],
    ]

    for (const [descripcion, valor] of formasRaras) {
      it(`transmite igual si viene como ${descripcion}`, async () => {
        respuesta = { outcome: 'allow', reason: 'Aceptado desde la Torre' }

        const { salida } = await ejecutar(
          peticionDePermiso({ permission_suggestions: valor }),
        )

        expect(salida.trim()).not.toBe('')
        expect(JSON.parse(salida).hookSpecificOutput.decision.behavior).toBe('allow')
      })
    }
  })

  it('sin Torre abierta sale en silencio y sin quejarse', async () => {
    rmSync(join(dataDir, 'event-endpoint.json'))

    const { salida, codigo } = await ejecutar(peticionDePermiso())

    expect(salida.trim()).toBe('')
    expect(codigo).toBe(0)
  })
})

/**
 * El reparto de estados que el dueño del proyecto corrigió dos veces.
 * «Te espera» está reservado a cuando el agente te PIDE algo; terminar un turno
 * es una ENTREGA, y va a la mesa de entregas.
 */
describe('qué estado manda cada evento', () => {
  const casos: ReadonlyArray<readonly [string, string]> = [
    ['UserPromptSubmit', 'running'],
    ['Stop', 'completed'],
    ['SessionEnd', 'completed'],
    ['Notification', 'waiting_user'],
  ]

  for (const [evento, esperado] of casos) {
    it(`${evento} → ${esperado}`, async () => {
      await ejecutar({
        hook_event_name: evento,
        session_id: 'sesion-1',
        cwd: 'C:/proyectos/mi-app',
      })

      const enviado = recibidas.find((r) => r.path === '/sessions')
      expect(enviado?.body.status).toBe(esperado)
    })
  }

  it('SessionEnd avisa además de que la conversación ha CERRADO', () => {
    // Es lo que permite a la Torre reciclar el muñeco (D23-bis). Stop no lo
    // manda: terminar un turno no es cerrar la sesión.
    return (async () => {
      await ejecutar({
        hook_event_name: 'SessionEnd',
        session_id: 'sesion-1',
        cwd: 'C:/proyectos/mi-app',
      })
      expect(recibidas.find((r) => r.path === '/sessions')?.body.sessionEnded).toBe(true)
    })()
  })

  it('Stop NO marca la conversación como cerrada: sigue viva tras entregar', () => {
    return (async () => {
      await ejecutar({
        hook_event_name: 'Stop',
        session_id: 'sesion-1',
        cwd: 'C:/proyectos/mi-app',
      })
      const body = recibidas.find((r) => r.path === '/sessions')?.body
      expect(body?.status).toBe('completed')
      // El campo ni siquiera viaja: una Torre antigua (contrato estricto)
      // seguiría aceptando este aviso.
      expect('sessionEnded' in (body ?? {})).toBe(false)
    })()
  })

  /*
   * Este caso nació de un fallo concreto: con el modo desatendido (D24) la Torre
   * aprobaba el permiso en silencio, pero Claude Code emite ADEMÁS un
   * `Notification` de tipo `permission_prompt` por el mismo permiso. Se atendía,
   * la tarea pasaba a «te espera» y llegaba la notificación de Windows — o sea,
   * el modo desatendido interrumpía igual, que es lo único que no debe hacer.
   */
  it('ignora las notificaciones de permiso: ya llegan por PermissionRequest', async () => {
    const { codigo } = await ejecutar({
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(recibidas.find((r) => r.path === '/sessions')).toBeUndefined()
    expect(codigo).toBe(0)
  })

  it('las notificaciones de «te pregunta algo» sí pasan a «te espera»', async () => {
    await ejecutar({
      hook_event_name: 'Notification',
      notification_type: 'idle_prompt',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(recibidas.find((r) => r.path === '/sessions')?.body.status).toBe('waiting_user')
  })

  it('una notificación sin tipo sigue avisando: ante la duda, mejor enterarse', async () => {
    await ejecutar({
      hook_event_name: 'Notification',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(recibidas.find((r) => r.path === '/sessions')?.body.status).toBe('waiting_user')
  })

  it('no manda nada del contenido de la conversación', async () => {
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: 'C:/algo/transcripcion.jsonl',
      message: 'texto que jamás debe salir de aquí',
    })

    const enviado = recibidas.find((r) => r.path === '/sessions')
    expect(JSON.stringify(enviado?.body)).not.toContain('jamás debe salir')
    expect(JSON.stringify(enviado?.body)).not.toContain('transcripcion')
  })
})

/**
 * Responder desde la Torre (D25). El hook consulta /turns al terminar un turno;
 * si el dueño contesta, devuelve `decision: block` con su texto y la
 * conversación continúa. Si nadie contesta, entrega normal.
 */
describe('responder desde la Torre (D25)', () => {
  const transcripcion = (...partes: string[]) => {
    const ruta = join(dataDir, 'transcripcion.jsonl')
    writeFileSync(ruta, partes.join('\n'))
    return ruta
  }
  const entradaAsistente = (texto: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: texto }] }, ...extra })

  it('si contestas, el turno NO termina: tu texto reengancha la conversación', async () => {
    respuesta = { action: 'reply', text: 'sí, sigue con la opción B' }
    const { salida } = await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    const json = JSON.parse(salida.trim())
    expect(json.decision).toBe('block')
    expect(json.reason).toBe('sí, sigue con la opción B')
    // Y NO se dio por terminada: la conversación sigue viva.
    expect(recibidas.find((r) => r.path === '/sessions')).toBeUndefined()
  })

  it('si nadie contesta, entrega normal a la mesa', async () => {
    respuesta = { action: 'pass' }
    const { salida } = await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(salida.trim()).toBe('')
    expect(recibidas.find((r) => r.path === '/sessions')?.body.status).toBe('completed')
  })

  const entradaUsuario = (texto: string) => JSON.stringify({ type: 'user', message: { content: texto } })
  const resultadoHerramienta = () =>
    JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }] },
    })
  const razonamiento = () =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'mmm' }] } })

  const salidaDelTurno = async (...partes: string[]) => {
    respuesta = { action: 'pass' }
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: transcripcion(...partes),
    })
    return recibidas.find((r) => r.path === '/turns')?.body.output as string
  }

  /*
   * Un turno NO es un mensaje: es varios. El asistente narra, usa herramientas,
   * cuenta lo que encuentra y concluye. Enseñar solo el último trozo dejaba
   * fuera la explicación, y en el peor caso enseñaba una frase intermedia como
   * si fuera la conclusión.
   */
  it('junta el turno ENTERO, no solo el último mensaje', async () => {
    const salida = await salidaDelTurno(
      entradaUsuario('arregla los tests'),
      entradaAsistente('Voy a mirar qué falla.'),
      resultadoHerramienta(),
      entradaAsistente('Son tres, todos del mismo módulo.'),
      resultadoHerramienta(),
      entradaAsistente('Hecho.'),
    )

    expect(salida).toBe('Voy a mirar qué falla.\n\nSon tres, todos del mismo módulo.\n\nHecho.')
  })

  it('un resultado de herramienta no corta el turno aunque viaje como mensaje de «user»', async () => {
    const salida = await salidaDelTurno(
      entradaUsuario('hazlo'),
      entradaAsistente('Empiezo.'),
      resultadoHerramienta(),
      entradaAsistente('Listo.'),
    )

    expect(salida).toContain('Empiezo.')
    expect(salida).toContain('Listo.')
  })

  it('se para en tu mensaje anterior: no arrastra el turno de antes', async () => {
    const salida = await salidaDelTurno(
      entradaAsistente('esto es del turno ANTERIOR'),
      entradaUsuario('ahora otra cosa'),
      entradaAsistente('esto es del turno de ahora'),
    )

    expect(salida).toBe('esto es del turno de ahora')
  })

  it('el razonamiento del asistente no se enseña', async () => {
    const salida = await salidaDelTurno(
      entradaUsuario('dale'),
      razonamiento(),
      entradaAsistente('La respuesta.'),
    )

    expect(salida).toBe('La respuesta.')
  })

  it('si el turno no cabe, se conserva el FINAL, que es lo que hay que leer', async () => {
    const salida = await salidaDelTurno(
      entradaUsuario('dale'),
      entradaAsistente('R'.repeat(4500)),
      entradaAsistente('LA CONCLUSIÓN'),
    )

    expect(salida.length).toBeLessThanOrEqual(4000)
    expect(salida.endsWith('LA CONCLUSIÓN')).toBe(true)
    expect(salida.startsWith('…')).toBe(true)
  })

  it('manda a la Torre la última respuesta del asistente, recortada de la transcripción', async () => {
    respuesta = { action: 'pass' }
    const ruta = transcripcion(
      entradaAsistente('primera respuesta, ya antigua'),
      JSON.stringify({ type: 'user', message: { content: 'pregunta' } }),
      entradaAsistente('esto es de un subagente', { isSidechain: true }),
      entradaAsistente('ésta es la respuesta final del turno'),
    )
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: ruta,
    })

    const enviado = recibidas.find((r) => r.path === '/turns')
    expect(enviado?.body.output).toBe('ésta es la respuesta final del turno')
  })

  it('sin transcripción legible, consulta igual con el texto vacío', async () => {
    respuesta = { action: 'pass' }
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: 'C:/no/existe.jsonl',
    })

    expect(recibidas.find((r) => r.path === '/turns')?.body.output).toBe('')
  })

  it('una respuesta rara de la Torre no bloquea nada: entrega normal', async () => {
    respuesta = { accepted: true }
    const { codigo } = await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(codigo).toBe(0)
    expect(recibidas.find((r) => r.path === '/sessions')?.body.status).toBe('completed')
  })
})

/**
 * El nombre de la conversación (D5-bis). Sale del registro de METADATOS de
 * sesiones vivas, jamás de la transcripción; el test de arriba sigue vigilando
 * que del contenido no salga nada.
 */
describe('el nombre de la conversación', () => {
  const registrar = (sessionId: string, name: unknown) => {
    const dir = join(dataDir, 'registro-sesiones')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '12345.json'), JSON.stringify({ pid: 12345, sessionId, name }))
  }

  it('viaja con el aviso cuando el registro lo conoce', async () => {
    registrar('sesion-1', 'repasar facturas de julio')
    await ejecutar({ hook_event_name: 'Stop', session_id: 'sesion-1', cwd: 'C:/proyectos/mi-app' })

    expect(recibidas.find((r) => r.path === '/sessions')?.body.sessionTitle).toBe(
      'repasar facturas de julio',
    )
  })

  it('sin registro, el aviso viaja sin nombre — ni campo vacío ni fallo', async () => {
    await ejecutar({ hook_event_name: 'Stop', session_id: 'sesion-1', cwd: 'C:/proyectos/mi-app' })

    const body = recibidas.find((r) => r.path === '/sessions')?.body
    expect(body?.status).toBe('completed')
    expect('sessionTitle' in (body ?? {})).toBe(false)
  })

  it('el registro de OTRA sesión no contamina: cada aviso lleva su nombre o ninguno', async () => {
    registrar('sesion-ajena', 'otro trabajo')
    await ejecutar({ hook_event_name: 'Stop', session_id: 'sesion-1', cwd: 'C:/proyectos/mi-app' })

    expect('sessionTitle' in (recibidas.find((r) => r.path === '/sessions')?.body ?? {})).toBe(false)
  })

  it('un registro corrupto no tumba el aviso', async () => {
    const dir = join(dataDir, 'registro-sesiones')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '12345.json'), 'esto no es JSON {')
    const { codigo } = await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
    })

    expect(codigo).toBe(0)
    expect(recibidas.find((r) => r.path === '/sessions')?.body.status).toBe('completed')
  })
})

/**
 * El cuaderno que evita volver a diagnosticar a ciegas.
 *
 * Este canal ha fallado dos veces sin dar un solo error. Apuntar qué llega y
 * qué se contesta es lo que convierte «no funciona» en «mira, aquí está».
 */
describe('cuaderno de bitácora de los permisos', () => {
  const leerCuaderno = (): Array<Record<string, unknown>> => {
    const ruta = join(dataDir, 'diagnostico-permisos.log')
    if (!existsSync(ruta)) return []
    return readFileSync(ruta, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((linea) => JSON.parse(linea) as Record<string, unknown>)
  }

  /** Se busca por fase, no por posición: así añadir apuntes no rompe la prueba. */
  const fase = (nombre: string) => leerCuaderno().find((l) => l.fase === nombre)

  it('apunta toda señal que llega, sea del tipo que sea', async () => {
    await ejecutar({ hook_event_name: 'Stop', session_id: 's', cwd: 'C:/x' })

    expect(fase('señal')).toMatchObject({ evento: 'Stop' })
  })

  it('apunta lo que llega y lo que se contesta', async () => {
    respuesta = { outcome: 'allow', reason: 'ok' }
    await ejecutar(peticionDePermiso())

    expect(leerCuaderno().map((l) => l.fase)).toEqual(['señal', 'llega', 'contesta'])
    expect(fase('llega')).toMatchObject({ herramienta: 'Bash' })
    // Deja dicho POR QUÉ campo se contestó: es lo que estuvo mal el 4/8/2026.
    expect(fase('contesta')).toMatchObject({
      decisionEnviada: 'allow',
      campoUsado: 'decision.behavior',
    })
  })

  it('deja escrito POR QUÉ se apartó, que es lo que hacía falta saber', async () => {
    respuesta = { outcome: 'timeout', reason: 'nadie decidió' }
    await ejecutar(peticionDePermiso())

    expect(fase('se aparta')?.motivo).toContain('decidió')
  })

  it('anota la FORMA del campo que rompió el canal, no solo su valor', async () => {
    respuesta = { outcome: 'allow', reason: 'ok' }
    await ejecutar(peticionDePermiso({ permission_suggestions: [{ behavior: 'allow' }] }))

    expect(fase('llega')).toMatchObject({ tipoDeAdmitidas: 'lista de [object]' })
  })

  it('anota el modo de permisos, que decide si habrá peticiones o no', async () => {
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 's',
      cwd: 'C:/x',
      permission_mode: 'acceptEdits',
    })

    expect(fase('señal')).toMatchObject({ modo: 'acceptEdits' })
  })

  it('NO escribe nada del contenido de la conversación', async () => {
    respuesta = { outcome: 'allow', reason: 'ok' }
    await ejecutar(
      peticionDePermiso({
        tool_name: 'Write',
        tool_input: { file_path: 'x.txt', content: 'secreto que jamás debe escribirse' },
        transcript_path: 'C:/algo/transcripcion.jsonl',
      }),
    )

    const cuaderno = leerCuaderno()
    expect(cuaderno).not.toContain('secreto que jamás')
    expect(cuaderno).not.toContain('transcripcion.jsonl')
  })
})

describe('avisos de estado y privacidad', () => {
  it('tampoco manda el contenido en los avisos de estado', async () => {
    await ejecutar({
      hook_event_name: 'Stop',
      session_id: 'sesion-1',
      cwd: 'C:/proyectos/mi-app',
      transcript_path: 'C:/algo/transcripcion.jsonl',
      message: 'texto que jamás debe salir de aquí',
    })

    const enviado = recibidas.find((r) => r.path === '/sessions')
    expect(JSON.stringify(enviado?.body)).not.toContain('jamás debe salir')
    expect(JSON.stringify(enviado?.body)).not.toContain('transcripcion')
  })
})
