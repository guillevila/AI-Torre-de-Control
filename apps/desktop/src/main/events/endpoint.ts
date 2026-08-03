import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Fichero donde la aplicación publica cómo hablar con su receptor de eventos.
 *
 * Vive en la carpeta de datos del usuario, NUNCA en el repositorio (D15). Lo
 * leen las herramientas locales que quieran enviar eventos —hoy el script de
 * simulación, mañana un hook de Claude Code.
 */
export const ENDPOINT_FILENAME = 'event-endpoint.json'

export interface EndpointDescriptor {
  host: string
  port: number
  token: string
}

export function endpointFilePath(userDataDir: string): string {
  return join(userDataDir, ENDPOINT_FILENAME)
}

/**
 * Recupera el token existente o crea uno nuevo.
 *
 * Por qué hay token si el servidor ya solo escucha en 127.0.0.1: escuchar en
 * local protege frente a la red, pero NO frente a otros programas del propio
 * ordenador. Sin token, cualquier proceso podría falsear el estado de tus
 * tareas. Con token, solo puede hacerlo quien pueda leer tu carpeta de usuario.
 */
export function loadOrCreateToken(userDataDir: string): string {
  const path = endpointFilePath(userDataDir)
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<EndpointDescriptor>
    if (typeof raw.token === 'string' && raw.token.length >= 32) return raw.token
  } catch {
    // No existe todavía, o está ilegible: se genera uno nuevo.
  }
  return randomBytes(32).toString('hex')
}

export function writeEndpointFile(userDataDir: string, descriptor: EndpointDescriptor): string {
  mkdirSync(userDataDir, { recursive: true })
  const path = endpointFilePath(userDataDir)
  writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    // En Windows esto es prácticamente simbólico, pero en macOS y Linux deja el
    // fichero legible solo por el usuario.
    chmodSync(path, 0o600)
  } catch {
    // Si el sistema de ficheros no admite permisos, seguimos igualmente.
  }
  return path
}
