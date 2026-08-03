import type { Provider, StatusConfidence, Task, TaskStatus } from '@torre/contracts'

/**
 * Agrupaciones, ordenaciones y etiquetas.
 *
 * Este archivo es la pieza que hace cumplir D10: ninguna vista calcula nada por
 * su cuenta, todas llaman aquí. Si algún día cambia qué cuenta como «necesita
 * atención», cambia en un solo sitio y todas las pantallas se mueven a la vez.
 */

// ─── Vocabulario visual (viene del documento de diseño) ──────────────────────

/**
 * Glifo geométrico de cada estado.
 *
 * Acompaña SIEMPRE al color, nunca lo sustituye: quitando el color, la pantalla
 * tiene que seguir siendo legible al 100 %.
 */
export const STATUS_GLYPHS: Readonly<Record<TaskStatus, string>> = {
  draft: '◌',
  queued: '◔',
  running: '◉',
  waiting_user: '▲',
  completed: '✓',
  failed: '✕',
  unknown: '?',
  archived: '▣',
}

export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  draft: 'Borrador',
  queued: 'En cola',
  running: 'Trabajando',
  waiting_user: 'Te espera',
  completed: 'Terminada',
  failed: 'Con error',
  unknown: 'Sin confirmar',
  archived: 'Archivada',
}

/** Frase corta que explica el estado sin jerga, para contadores y leyendas. */
export const STATUS_HINTS: Readonly<Record<TaskStatus, string>> = {
  draft: 'aún sin lanzar',
  queued: 'esperando turno',
  running: 'no necesitan nada',
  waiting_user: 'bloqueadas por ti',
  completed: 'sin revisar',
  failed: 'terminaron mal',
  unknown: 'no puedo saberlo',
  archived: 'ya revisadas',
}

export const PROVIDER_LABELS: Readonly<Record<Provider, string>> = {
  claude_code: 'Claude Code',
  claude_web: 'Claude',
  cowork: 'Cowork',
  chatgpt: 'ChatGPT',
  codex: 'Codex',
  gemini: 'Gemini',
  copilot: 'Copilot',
  other: 'Otra',
}

/**
 * Color de cada plataforma.
 *
 * En la oficina, el color del trabajador es su plataforma. El diseño original
 * usaba el «rol» de la tarea para esto, pero ese campo quedó como decisión
 * abierta (O7), así que se usa el dato que sí existe y cumple la misma función:
 * distinguir de un vistazo quién trabaja en qué herramienta.
 */
export const PROVIDER_COLORS: Readonly<Record<Provider, string>> = {
  claude_code: '#2C6E5B',
  claude_web: '#B4653A',
  cowork: '#8A5A3C',
  chatgpt: '#2F5FA0',
  codex: '#5B5486',
  gemini: '#7C6A4E',
  copilot: '#4A6FA5',
  other: '#8B8377',
}

export const CONFIDENCE_LABELS: Readonly<Record<StatusConfidence, string>> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

export const SOURCE_LABELS = {
  manual: 'Lo marcaste tú',
  local_event: 'Evento local',
  claude_hook: 'Hook de Claude Code',
  browser_extension: 'Extensión de navegador',
  process_monitor: 'Monitor de proceso',
} as const

/** Explicación larga de la fuente, para la ficha. */
export const SOURCE_DESCRIPTIONS = {
  manual: 'lo fijaste a mano, así que es la verdad por definición',
  local_event: 'lo comunicó una herramienta local por el receptor de eventos',
  claude_hook: 'lo comunicó Claude Code al terminar un paso',
  browser_extension: 'lo dedujo la extensión observando la página',
  process_monitor: 'lo dedujo el monitor observando el proceso',
} as const

export const SOURCE_GLYPHS = {
  manual: '✎',
  local_event: '⇢',
  claude_hook: '⎇',
  browser_extension: '◫',
  process_monitor: '⚙',
} as const

// ─── Grupos ──────────────────────────────────────────────────────────────────

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

export const GROUP_LABELS: Readonly<Record<TaskGroupKey, string>> = {
  attention: 'Necesitan tu atención',
  active: 'Trabajando ahora',
  unknown: 'Sin confirmar',
  completed: 'Terminadas',
  draft: 'Preparadas sin lanzar',
  archived: 'Archivadas',
}

/**
 * Orden por urgencia con el que se apilan las secciones de la lista de tareas.
 *
 * Primero quien está parado esperándote; después lo que no se puede confirmar;
 * luego los errores; y solo al final lo que ya no reclama nada.
 */
export const STATUS_URGENCY_ORDER: readonly TaskStatus[] = [
  'waiting_user',
  'unknown',
  'failed',
  'completed',
  'running',
  'queued',
  'draft',
]

// ─── Ordenación ──────────────────────────────────────────────────────────────

const byActivityDesc = (a: Task, b: Task): number => b.lastActivityAt.localeCompare(a.lastActivityAt)

/**
 * En lo que reclama atención se ordena al revés: lo que lleva más tiempo
 * esperando sale primero, porque es lo que más riesgo tiene de olvidarse.
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

  for (const task of tasks) groups[groupOf(task.status)].push(task)

  for (const key of Object.keys(groups) as TaskGroupKey[]) {
    groups[key].sort(key === 'attention' ? byActivityAsc : byActivityDesc)
  }

  return groups
}

/** Agrupa por estado exacto, en orden de urgencia. Alimenta la vista Tareas. */
export function groupTasksByStatus(tasks: readonly Task[]): { status: TaskStatus; tasks: Task[] }[] {
  return STATUS_URGENCY_ORDER.map((status) => ({
    status,
    tasks: tasks
      .filter((task) => task.status === status)
      .sort(status === 'waiting_user' || status === 'unknown' ? byActivityAsc : byActivityDesc),
  })).filter((section) => section.tasks.length > 0)
}

// ─── Cola de atención ────────────────────────────────────────────────────────

/**
 * Estados que reclaman una decisión del usuario, en el orden en que cuesta más
 * caro ignorarlos.
 */
export const ATTENTION_ORDER: readonly TaskStatus[] = [
  'waiting_user',
  'unknown',
  'failed',
  'completed',
]

/** Por qué esta tarea está reclamando atención, en lenguaje normal. */
export const ATTENTION_REASONS: Readonly<Partial<Record<TaskStatus, string>>> = {
  waiting_user: 'Está parada esperando algo tuyo.',
  unknown: 'No puedo confirmar en qué estado está. No supongo que siga trabajando.',
  failed: 'Terminó con error.',
  completed: 'Ha terminado y todavía no la has revisado.',
}

/**
 * La cola del Centro de atención.
 *
 * Dentro de cada estado, primero lo que lleva más tiempo parado.
 */
export function attentionQueue(tasks: readonly Task[]): Task[] {
  const rank = new Map(ATTENTION_ORDER.map((status, index) => [status, index]))

  return tasks
    .filter((task) => rank.has(task.status))
    .sort((a, b) => {
      const byStatus = (rank.get(a.status) ?? 99) - (rank.get(b.status) ?? 99)
      return byStatus !== 0 ? byStatus : byActivityAsc(a, b)
    })
}

// ─── La oficina ──────────────────────────────────────────────────────────────

/** Zonas de la planta. La geografía ES la regla: la posición comunica el estado. */
export type OfficeZone = 'office' | 'delivery' | 'work' | 'incidents' | 'reception'

const ZONE_OF_STATUS: Readonly<Record<TaskStatus, OfficeZone | null>> = {
  waiting_user: 'office', // de pie en tu puerta
  completed: 'delivery', // junto a la mesa de entregas
  running: 'work',
  unknown: 'work', // en su puesto, pero con la animación detenida
  failed: 'incidents',
  queued: 'reception',
  draft: 'reception',
  archived: null, // sale de la planta
}

export function zoneOf(status: TaskStatus): OfficeZone | null {
  return ZONE_OF_STATUS[status]
}

/**
 * Qué tareas tienen a alguien en la oficina, y en qué zona.
 *
 * Fuera quedan solo las archivadas: ya las retiraste de la vista activa. Los
 * borradores y la cola sí aparecen, atenuados, en recepción — están dentro,
 * pero todavía no trabajan.
 */
export function officeWorkers(tasks: readonly Task[]): { task: Task; zone: OfficeZone }[] {
  return tasks
    .map((task) => ({ task, zone: zoneOf(task.status) }))
    .filter((worker): worker is { task: Task; zone: OfficeZone } => worker.zone !== null)
    .sort((a, b) => a.task.createdAt.localeCompare(b.task.createdAt))
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface TaskFilters {
  search: string
  provider: Provider | 'all'
  /**
   * Filtrar por confianza es la auditoría de la mañana: enseña de golpe todo lo
   * que la aplicación cree pero no puede probar.
   */
  confidence: StatusConfidence | 'all'
  showArchived: boolean
}

export const EMPTY_FILTERS: TaskFilters = {
  search: '',
  provider: 'all',
  confidence: 'all',
  showArchived: false,
}

export function filterTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  const needle = filters.search.trim().toLowerCase()

  return tasks.filter((task) => {
    if (task.status === 'archived' && !filters.showArchived) return false
    if (filters.provider !== 'all' && task.provider !== filters.provider) return false
    if (filters.confidence !== 'all' && task.statusConfidence !== filters.confidence) return false
    if (needle) {
      const haystack = `${task.title} ${PROVIDER_LABELS[task.provider]}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

// ─── Resumen de cabecera ─────────────────────────────────────────────────────

export interface TaskSummary {
  running: number
  waiting: number
  completed: number
  failed: number
  unknown: number
  queued: number
  draft: number
  /** Todo lo que espera una decisión tuya. Es el número del distintivo lateral. */
  attention: number
  /** Todo lo no archivado. */
  total: number
}

export function summarise(tasks: readonly Task[]): TaskSummary {
  const count = (status: TaskStatus) => tasks.filter((task) => task.status === status).length

  const waiting = count('waiting_user')
  const unknown = count('unknown')
  const failed = count('failed')
  const completed = count('completed')

  return {
    running: count('running'),
    waiting,
    completed,
    failed,
    unknown,
    queued: count('queued'),
    draft: count('draft'),
    attention: waiting + unknown + failed + completed,
    total: tasks.filter((task) => task.status !== 'archived').length,
  }
}
