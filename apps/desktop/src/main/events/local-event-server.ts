import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import type {
  EventIngestResult,
  PermissionResolution,
  SessionUpdateResult,
  TaskIntakeResult,
  WebActivityResult,
} from '@torre/contracts'

/**
 * Receptor local de eventos.
 *
 * Reglas de seguridad que implementa (SYSTEM_VISION §13 y D17):
 *
 *  1. Escucha SOLO en 127.0.0.1. Nunca en 0.0.0.0 ni en la IP de la red local,
 *     así que ningún otro equipo puede alcanzarlo.
 *  2. Comprueba además que quien llama viene de una dirección de bucle local.
 *  3. Exige un token secreto local, comparado en tiempo constante.
 *  4. Exige `Content-Type: application/json`, lo que obliga a cualquier página
 *     web a pedir permiso previo (preflight) que aquí nunca se concede.
 *  5. Limita el tamaño del cuerpo, para que nadie pueda saturar la aplicación.
 *  6. Delega TODA la validación del contenido en el contrato de eventos.
 *  7. No ejecuta absolutamente nada de lo que recibe: un evento solo puede
 *     mover una tarea entre estados ya conocidos.
 */

export const DEFAULT_EVENT_PORTS = [4319, 4320, 4321, 4322, 4323] as const

/** 16 KB es holgadísimo para un evento de estado y cierra la puerta a abusos. */
const MAX_BODY_BYTES = 16 * 1024

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export interface LocalEventServerOptions {
  token: string
  /** Puertos a intentar, en orden. Se usa el primero libre. */
  ports?: readonly number[]
  /** Procesa un evento ya recibido. La validación ocurre dentro. */
  onEvent: (raw: unknown) => EventIngestResult
  /**
   * Procesa una petición de permiso (D18-bis).
   *
   * A diferencia de un evento, esta llamada **no responde hasta que el usuario
   * decide** o se agota el tiempo. La conexión se queda abierta mientras tanto.
   * Si no se proporciona, la ruta de permisos devuelve 404: una aplicación sin
   * permisos configurados no debe fingir que los acepta.
   */
  onPermission?: (raw: unknown) => Promise<PermissionResolution>
  /**
   * Procesa un aviso de estado que no conoce el identificador de la tarea, solo
   * su carpeta y su sesión. Es lo que envía el enlace con Claude Code.
   */
  onSession?: (raw: unknown) => SessionUpdateResult
  /**
   * Da de alta una tarea que llega de fuera. Es lo que usa la extensión de
   * navegador para registrar la conversación que tienes abierta.
   *
   * A diferencia de un evento, esta ruta sí CREA algo. Por eso el contrato que
   * la gobierna solo admite dos campos —título y dirección— y rechaza por
   * completo cualquier petición que traiga uno más.
   */
  onIntake?: (raw: unknown) => TaskIntakeResult
  /**
   * Señal de que una conversación del navegador empieza o termina.
   *
   * A diferencia del alta, esta ruta NO crea nada: solo mueve una tarea que ya
   * existía. Una conversación desconocida se ignora sin ruido.
   */
  onWebActivity?: (raw: unknown) => WebActivityResult
}

export interface LocalEventServerAddress {
  host: string
  port: number
}

export class LocalEventServer {
  private server: Server | null = null
  private address: LocalEventServerAddress | null = null
  private readonly options: LocalEventServerOptions

  constructor(options: LocalEventServerOptions) {
    this.options = options
  }

  getAddress(): LocalEventServerAddress | null {
    return this.address
  }

  async start(): Promise<LocalEventServerAddress> {
    const ports = this.options.ports ?? DEFAULT_EVENT_PORTS
    let lastError: unknown = null

    for (const port of ports) {
      try {
        const address = await this.listenOn(port)
        this.address = address
        return address
      } catch (error) {
        lastError = error
        if (!isPortBusy(error)) throw error
      }
    }

    throw new Error(
      `No se pudo abrir el receptor local en ninguno de los puertos ${ports.join(', ')}. ` +
        `Último error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
  }

  private listenOn(port: number): Promise<LocalEventServerAddress> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        this.handle(req, res)
      })

      const onError = (error: unknown) => {
        server.removeAllListeners()
        server.close()
        reject(error)
      }

      server.once('error', onError)
      // El '127.0.0.1' explícito es la garantía de que no salimos del equipo.
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError)
        this.server = server
        // Con puerto 0 el sistema asigna uno libre; hay que leer el real.
        const assigned = server.address()
        const actualPort = typeof assigned === 'object' && assigned ? assigned.port : port
        resolve({ host: '127.0.0.1', port: actualPort })
      })
    })
  }

  async stop(): Promise<void> {
    const server = this.server
    if (!server) return
    this.server = null
    this.address = null
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    // Barrera 2: solo bucle local, aunque el bind ya lo garantice.
    const remote = req.socket.remoteAddress ?? ''
    if (!LOOPBACK.has(remote)) {
      return send(res, 403, { accepted: false, reason: 'Solo se aceptan conexiones locales' })
    }

    const url = req.url ?? '/'

    if (req.method === 'GET' && url === '/health') {
      // Sin token a propósito: solo confirma que la aplicación está abierta.
      // No revela ningún dato de las tareas.
      return send(res, 200, { status: 'ok' })
    }

    const isEvents = req.method === 'POST' && url === '/events'
    const isPermissions = req.method === 'POST' && url === '/permissions'
    const isSessions = req.method === 'POST' && url === '/sessions'
    const isIntake = req.method === 'POST' && url === '/tasks'
    const isWebActivity = req.method === 'POST' && url === '/web-activity'

    // Cada ruta solo existe si la aplicación sabe atenderla. Sin atendedor
    // devuelve 404 en lugar de aceptar algo que nadie va a procesar.
    const known =
      isEvents ||
      (isPermissions && this.options.onPermission) ||
      (isSessions && this.options.onSession) ||
      (isIntake && this.options.onIntake) ||
      (isWebActivity && this.options.onWebActivity)
    if (!known) {
      return send(res, 404, { accepted: false, reason: 'Ruta no encontrada' })
    }

    // Barrera 3: token local.
    const provided = req.headers['x-torre-token']
    if (typeof provided !== 'string' || !this.tokenMatches(provided)) {
      return send(res, 401, { accepted: false, reason: 'Token local ausente o incorrecto' })
    }

    // Barrera 4: tipo de contenido.
    const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim()
    if (contentType !== 'application/json') {
      return send(res, 415, {
        accepted: false,
        reason: 'El contenido debe ser application/json',
      })
    }

    // Barrera 5: tamaño.
    readBody(req, MAX_BODY_BYTES)
      .then((body) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(body)
        } catch {
          return send(res, 400, { accepted: false, reason: 'El cuerpo no es JSON válido' })
        }

        if (isEvents) {
          // Barrera 6: el contrato decide. Barrera 7: solo mueve estados.
          const result = this.options.onEvent(parsed)
          return send(res, result.accepted ? 200 : 422, result)
        }

        if (isSessions && this.options.onSession) {
          const result = this.options.onSession(parsed)
          return send(res, result.accepted ? 200 : 422, result)
        }

        if (isIntake && this.options.onIntake) {
          const result = this.options.onIntake(parsed)
          return send(res, result.accepted ? 200 : 422, result)
        }

        if (isWebActivity && this.options.onWebActivity) {
          const result = this.options.onWebActivity(parsed)
          return send(res, result.accepted ? 200 : 422, result)
        }

        // ── Permisos ─────────────────────────────────────────────────────────
        // La respuesta se queda pendiente hasta que el usuario decide. Si quien
        // preguntó se marcha antes (cierra la terminal, corta la sesión), se
        // deja de esperar: nadie va a leer ya esa respuesta.
        const handler = this.options.onPermission
        if (!handler) return send(res, 404, { accepted: false, reason: 'Ruta no encontrada' })

        let abandoned = false
        req.once('close', () => {
          abandoned = true
        })

        handler(parsed)
          .then((resolution) => {
            if (abandoned || res.writableEnded) return
            send(res, 200, resolution)
          })
          .catch((error: unknown) => {
            if (abandoned || res.writableEnded) return
            // Ante cualquier fallo se devuelve `timeout`: es la salida segura,
            // la que hace que la herramienta pregunte por su cuenta (D21).
            send(res, 200, {
              outcome: 'timeout',
              reason: `La Torre no pudo atender la petición: ${
                error instanceof Error ? error.message : 'error desconocido'
              }`,
            })
          })
      })
      .catch((error: unknown) => {
        const tooLarge = error instanceof Error && error.message === 'BODY_TOO_LARGE'
        if (tooLarge) {
          // Se contesta primero y se corta la conexión después, para que quien
          // envía llegue a leer el motivo del rechazo en lugar de ver un corte seco.
          res.once('finish', () => req.socket.destroy())
          send(res, 413, { accepted: false, reason: 'El evento es demasiado grande' }, true)
          return
        }
        send(res, 400, { accepted: false, reason: 'No se pudo leer el evento' })
      })
  }

  private tokenMatches(provided: string): boolean {
    const expected = Buffer.from(this.options.token, 'utf8')
    const candidate = Buffer.from(provided, 'utf8')
    // timingSafeEqual exige la misma longitud; comprobarla antes no filtra el
    // secreto, solo su tamaño, que además es fijo y conocido.
    if (expected.length !== candidate.length) return false
    return timingSafeEqual(expected, candidate)
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    let aborted = false

    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      size += chunk.length
      if (size > limit) {
        aborted = true
        chunks.length = 0
        reject(new Error('BODY_TOO_LARGE'))
        // Se descarta el resto sin acumularlo en memoria, pero sin cerrar el
        // socket todavía: hace falta seguir vivo para poder contestar 413.
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, payload: unknown, close = false): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // Sin cabeceras CORS: ninguna página web puede leer la respuesta.
    'X-Content-Type-Options': 'nosniff',
    ...(close ? { Connection: 'close' } : {}),
  })
  res.end(body)
}

function isPortBusy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  )
}
