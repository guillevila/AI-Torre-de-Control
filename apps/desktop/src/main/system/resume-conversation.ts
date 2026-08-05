import { spawn } from 'node:child_process'

/**
 * Relanza una conversación de Claude Code con la respuesta del dueño (D25-bis).
 *
 * Es lo que hace posible «contestar más tarde»: cuando el turno ya terminó y no
 * hay ningún hook sosteniendo la sesión, la única vía de vuelta es pedirle a
 * Claude Code que retome la conversación (`--resume`) con el texto nuevo. La
 * conversación continúa con otro identificador de sesión; sus hooks avisan a la
 * Torre como siempre y el muñeco vuelve a «trabajando».
 *
 * El texto del dueño viaja por la ENTRADA ESTÁNDAR, jamás interpolado en la
 * línea de comandos: una respuesta con comillas o `$` no debe poder ejecutar
 * nada. Lo único que va en la línea es el identificador, validado como UUID.
 *
 * Comprobado en este equipo que la invocación es la correcta: con un
 * identificador inventado, Claude Code responde «No conversation found with
 * session ID», no un error de sintaxis.
 *
 * **Limitación conocida:** en un proyecto cuyo diálogo de confianza no se haya
 * aceptado nunca, Claude Code avisa de que ignora los permisos del
 * `.claude/settings.json` de ese proyecto. La conversación se retoma igual,
 * pero con permisos más restrictivos. Se arregla abriendo Claude Code a mano
 * una vez en esa carpeta y aceptando la confianza.
 */
export function resumeConversation(cwd: string, sessionId: string, text: string): boolean {
  if (!/^[0-9a-f-]{8,64}$/i.test(sessionId)) return false
  if (!cwd || !text.trim()) return false

  try {
    // Sin `shell`: en este equipo `claude` es un ejecutable, así que se lanza
    // directo y el texto del dueño nunca pasa por un intérprete de comandos.
    // Si algún día no se encuentra en el PATH, spawn falla y se devuelve false:
    // la tarjeta se queda y la interfaz lo dice, en vez de perder la respuesta.
    const hijo = spawn('claude', ['-p', '--resume', sessionId], {
      cwd,
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    })
    hijo.once('error', () => {
      /* no se pudo lanzar; ya se avisó por el valor de retorno del intento */
    })
    hijo.stdin.write(text)
    hijo.stdin.end()
    hijo.unref()
    return true
  } catch {
    return false
  }
}
