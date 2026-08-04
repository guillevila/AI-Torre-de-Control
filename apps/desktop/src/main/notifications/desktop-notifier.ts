import { Notification } from 'electron'
import type { NotificationMessage } from './notifier.js'

/**
 * Envío real de la notificación al sistema operativo.
 *
 * Único archivo de la carpeta que depende de Electron, para que la lógica de
 * avisos (qué avisar y cuándo) se pueda testear sin abrir la aplicación.
 */
export function showDesktopNotification(message: NotificationMessage): void {
  if (!Notification.isSupported()) {
    console.warn('[torre] Este sistema no admite notificaciones de escritorio.')
    return
  }

  new Notification({
    title: message.title,
    body: message.body,
    silent: false,
  }).show()
}
