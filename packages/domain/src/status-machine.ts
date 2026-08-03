import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  type StatusConfidence,
  type StatusSource,
  type Task,
  type TaskStatus,
} from '@torre/contracts'
import { canTransition, isManuallyLocked } from './transitions.js'

/**
 * ÚNICO punto del sistema donde una tarea cambia de estado.
 *
 * Ni la interfaz, ni el receptor de eventos, ni la base de datos modifican
 * `status` por su cuenta: todos pasan por aquí. Así solo hay un sitio que
 * auditar cuando algo se comporta raro, y solo un sitio que testear.
 */

export interface StatusChangeRequest {
  status: TaskStatus
  source: StatusSource
  confidence: StatusConfidence
  /** Momento del cambio, en ISO-8601. Se inyecta para que los tests sean deterministas. */
  now: string
}

export type TransitionRejection =
  /** El salto de estado no tiene sentido (por ejemplo, de archivada a fallida). */
  | 'invalid_transition'
  /** El usuario ya decidió a mano y una señal automática no puede deshacerlo. */
  | 'manual_decision_locked'

export type TransitionResult =
  | {
      ok: true
      task: Task
      /** false si el estado ya era ese: sirvió para refrescar actividad, nada más. */
      changed: boolean
      /** true si este cambio merece una notificación de escritorio. */
      notify: boolean
    }
  | { ok: false; reason: TransitionRejection; message: string }

const isActive = (status: TaskStatus): boolean =>
  (ACTIVE_STATUSES as readonly TaskStatus[]).includes(status)

const isTerminal = (status: TaskStatus): boolean =>
  (TERMINAL_STATUSES as readonly TaskStatus[]).includes(status)

/**
 * Estados que interrumpen al usuario. Son exactamente los tres que pide el
 * sprint: necesita intervención, ha terminado, o ha fallado.
 */
const NOTIFIABLE_STATUSES: readonly TaskStatus[] = ['waiting_user', 'completed', 'failed']

/**
 * Regla anti-duplicados de primer nivel: solo se avisa cuando el estado
 * REALMENTE cambia. Diez eventos seguidos diciendo "completed" producen
 * una única notificación.
 */
export function shouldNotify(previous: TaskStatus, next: TaskStatus): boolean {
  if (previous === next) return false
  return NOTIFIABLE_STATUSES.includes(next)
}

export function applyStatusChange(task: Task, change: StatusChangeRequest): TransitionResult {
  if (isManuallyLocked(task.status, task.statusSource) && change.source !== 'manual') {
    return {
      ok: false,
      reason: 'manual_decision_locked',
      message:
        `La tarea está en "${task.status}" porque lo decidiste tú. ` +
        `Una señal automática (${change.source}) no puede cambiarlo; hazlo a mano si procede.`,
    }
  }

  if (!canTransition(task.status, change.status)) {
    return {
      ok: false,
      reason: 'invalid_transition',
      message: `No es posible pasar de "${task.status}" a "${change.status}".`,
    }
  }

  const changed = task.status !== change.status
  const { now } = change

  // startedAt: se fija la primera vez que la tarea deja de ser un borrador.
  const startedAt =
    task.startedAt ?? (isActive(change.status) || isTerminal(change.status) ? now : null)

  // finishedAt: se fija al acabar y se borra si la tarea se reabre.
  let finishedAt = task.finishedAt
  if (isTerminal(change.status)) {
    finishedAt = changed ? now : (task.finishedAt ?? now)
  } else if (change.status !== 'archived') {
    finishedAt = null
  }

  const next: Task = {
    ...task,
    status: change.status,
    statusSource: change.source,
    statusConfidence: change.confidence,
    startedAt,
    finishedAt,
    lastActivityAt: now,
    updatedAt: now,
  }

  return { ok: true, task: next, changed, notify: shouldNotify(task.status, change.status) }
}
