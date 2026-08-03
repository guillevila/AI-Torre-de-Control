import type { Provider, Task, TaskStatus } from '@torre/contracts'

/**
 * Agrupaciones y filtros de tareas.
 *
 * Este archivo es la pieza que hace cumplir D10: la vista operativa y la vista
 * oficina NO calculan nada por su cuenta, las dos llaman aquí. Si algún día
 * cambia qué cuenta como "necesita atención", cambia en un solo sitio y las dos
 * pantallas se mueven a la vez. Es imposible que se desincronicen.
 */

export type TaskGroupKey = 'attention' | 'active' | 'draft' | 'completed' | 'unknown' | 'archived'

const GROUP_OF_STATUS: Readonly<Record<TaskStatus, TaskGroupKey>> = {
  waiting_user: 'attention',
  failed: 'attention',
  queued: 'active',
  running: 'active',
  draft: 'draft',
  completed: 'completed',
  unknown: 'unknown',
  archived: 'archived',
}

export function groupOf(status: TaskStatus): TaskGroupKey {
  return GROUP_OF_STATUS[status]
}

export const GROUP_ORDER: readonly TaskGroupKey[] = [
  'attention',
  'active',
  'unknown',
  'completed',
  'draft',
  'archived',
]

/** Etiquetas en lenguaje normal. Nada de jerga en pantalla. */
export const GROUP_LABELS: Readonly<Record<TaskGroupKey, string>> = {
  attention: 'Necesitan tu atención',
  active: 'Trabajando ahora',
  unknown: 'Estado desconocido',
  completed: 'Terminadas',
  draft: 'Preparadas sin lanzar',
  archived: 'Archivadas',
}

export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  draft: 'Preparada',
  queued: 'En cola',
  running: 'Trabajando',
  waiting_user: 'Te espera',
  completed: 'Terminada',
  failed: 'Ha fallado',
  unknown: 'Sin contacto',
  archived: 'Archivada',
}

export const PROVIDER_LABELS: Readonly<Record<Provider, string>> = {
  claude_code: 'Claude Code',
  claude_web: 'Claude (web)',
  chatgpt: 'ChatGPT',
  codex: 'Codex',
  gemini: 'Gemini',
  copilot: 'Copilot',
  other: 'Otra herramienta',
}

export const CONFIDENCE_LABELS = {
  high: 'confianza alta',
  medium: 'confianza media',
  low: 'confianza baja',
} as const

export const SOURCE_LABELS = {
  manual: 'lo marcaste tú',
  local_event: 'evento local',
  claude_hook: 'aviso de Claude Code',
  browser_extension: 'extensión de navegador',
  process_monitor: 'monitor de procesos',
} as const

// ─── Ordenación ──────────────────────────────────────────────────────────────

const byActivityDesc = (a: Task, b: Task): number =>
  b.lastActivityAt.localeCompare(a.lastActivityAt)

/**
 * En el grupo de atención se ordena al revés: la que lleva más tiempo esperando
 * sale primero, porque es la que más riesgo tiene de olvidarse.
 */
const byActivityAsc = (a: Task, b: Task): number => a.lastActivityAt.localeCompare(b.lastActivityAt)

export function groupTasks(tasks: readonly Task[]): Record<TaskGroupKey, Task[]> {
  const groups: Record<TaskGroupKey, Task[]> = {
    attention: [],
    active: [],
    draft: [],
    completed: [],
    unknown: [],
    archived: [],
  }

  for (const task of tasks) {
    groups[groupOf(task.status)].push(task)
  }

  for (const key of Object.keys(groups) as TaskGroupKey[]) {
    groups[key].sort(key === 'attention' ? byActivityAsc : byActivityDesc)
  }

  return groups
}

// ─── La oficina ──────────────────────────────────────────────────────────────

/**
 * Qué tareas tienen un trabajador en la oficina.
 *
 * Fuera quedan las archivadas (ya retiradas) y los borradores (todavía no se ha
 * delegado nada, así que no hay nadie trabajando en ellas).
 */
export function officeWorkers(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((task) => task.status !== 'archived' && task.status !== 'draft')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// ─── Filtros de la vista operativa ───────────────────────────────────────────

export interface TaskFilters {
  /** Texto libre contra el título. Vacío = sin filtro. */
  search: string
  provider: Provider | 'all'
  group: TaskGroupKey | 'all'
  showArchived: boolean
}

export const EMPTY_FILTERS: TaskFilters = {
  search: '',
  provider: 'all',
  group: 'all',
  showArchived: false,
}

export function filterTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  const needle = filters.search.trim().toLowerCase()

  return tasks.filter((task) => {
    if (task.status === 'archived' && !filters.showArchived && filters.group !== 'archived') {
      return false
    }
    if (filters.provider !== 'all' && task.provider !== filters.provider) return false
    if (filters.group !== 'all' && groupOf(task.status) !== filters.group) return false
    if (needle && !task.title.toLowerCase().includes(needle)) return false
    return true
  })
}

// ─── Resumen de cabecera ─────────────────────────────────────────────────────

export interface TaskSummary {
  attention: number
  active: number
  unknown: number
  completed: number
  total: number
}

export function summarise(tasks: readonly Task[]): TaskSummary {
  const groups = groupTasks(tasks)
  return {
    attention: groups.attention.length,
    active: groups.active.length,
    unknown: groups.unknown.length,
    completed: groups.completed.length,
    total: tasks.filter((task) => task.status !== 'archived').length,
  }
}
