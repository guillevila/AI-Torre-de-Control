import type { TaskStatus } from '@torre/contracts'

/**
 * Grafo de transiciones permitidas.
 *
 * Por qué existe: sin esto, cualquier evento perdido o desordenado podría dejar
 * una tarea en un estado imposible (por ejemplo, "terminada" y luego "en cola"
 * sin que nadie la reabriera). El grafo hace explícito qué recorridos tienen
 * sentido de verdad.
 *
 * Criterio general: se permite todo lo que puede ocurrir en la vida real,
 * y se prohíbe lo que solo puede venir de un error.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  // Preparada pero no lanzada: solo puede arrancar o retirarse.
  draft: ['queued', 'running', 'archived'],

  // Esperando turno: puede arrancar, o terminar directamente si la herramienta
  // fue muy rápida y solo vimos el final.
  queued: ['running', 'waiting_user', 'completed', 'failed', 'unknown', 'archived'],

  // Trabajando: el estado con más salidas posibles.
  running: ['waiting_user', 'completed', 'failed', 'unknown', 'queued', 'archived'],

  // Pide intervención: o se retoma, o acaba.
  waiting_user: ['running', 'completed', 'failed', 'unknown', 'archived'],

  // Terminada: se puede archivar, o reabrir si el usuario sigue la conversación.
  completed: ['archived', 'running', 'waiting_user'],

  // Fallida: se puede archivar o reintentar.
  failed: ['archived', 'running', 'queued'],

  // Perdimos el contacto (D9): cualquier señal nueva la rescata.
  unknown: ['running', 'waiting_user', 'completed', 'failed', 'queued', 'archived'],

  // Retirada de la vista: solo el usuario puede sacarla de aquí.
  archived: ['draft', 'queued', 'running'],
}

/**
 * ¿Es válido pasar de `from` a `to`?
 *
 * Quedarse en el mismo estado siempre es válido: sirve para refrescar la hora de
 * última actividad o para subir la confianza sin cambiar nada más.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Estados que el usuario ha decidido a mano y que una señal automática no debe
 * poder deshacer.
 *
 * El caso que evita: marcas una tarea como terminada, y diez minutos después
 * llega un evento retrasado de la extensión que la resucita como "trabajando".
 * La decisión del humano manda (D6).
 */
export const MANUAL_LOCK_STATUSES = ['completed', 'failed', 'archived'] as const

/**
 * Estados que una señal automática SÍ puede imponer sobre una decisión manual.
 *
 * Solo `running`, y por un motivo concreto: si marcaste una tarea como
 * terminada y después vuelves a trabajar en esa carpeta, la señal de que hay
 * trabajo en marcha es **información nueva y observada**, no un evento
 * retrasado. Sin esta excepción, la primera vez que cierras una tarea a mano su
 * carpeta se queda sorda para siempre.
 *
 * Lo que el candado sigue impidiendo —y es lo que importa— es que una señal
 * automática dé por terminado o fallido algo que tú cerraste de otra forma.
 */
const UNLOCKS_MANUAL: readonly TaskStatus[] = ['running']

export function isManuallyLocked(
  status: TaskStatus,
  source: string,
  incomingStatus?: TaskStatus,
): boolean {
  if (source !== 'manual') return false
  if (!(MANUAL_LOCK_STATUSES as readonly string[]).includes(status)) return false
  if (incomingStatus && UNLOCKS_MANUAL.includes(incomingStatus)) return false
  return true
}
