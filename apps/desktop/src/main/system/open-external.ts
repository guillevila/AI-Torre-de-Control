import { shell } from 'electron'
import { externalUrlSchema } from '@torre/contracts'

/**
 * Apertura de un enlace externo en el navegador del sistema.
 *
 * La URL se vuelve a validar aquí aunque ya se validara al guardarla. Es
 * deliberado: es el último punto antes de entregarle algo al sistema operativo,
 * y una segunda comprobación cuesta nada. Solo pasan http y https; cualquier
 * intento de abrir `file:`, `javascript:` o un ejecutable se rechaza.
 */
export async function openExternalUrl(rawUrl: unknown): Promise<void> {
  const parsed = externalUrlSchema.safeParse(rawUrl)
  if (!parsed.success) {
    throw new Error('El enlace no es válido. Solo se pueden abrir direcciones http:// o https://')
  }
  await shell.openExternal(parsed.data)
}
