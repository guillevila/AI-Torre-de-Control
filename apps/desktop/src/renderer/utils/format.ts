/**
 * Formateo de fechas en lenguaje natural.
 *
 * Se prefiere «hace 5 min» a una marca de tiempo completa porque lo que importa
 * de un vistazo es cuánto lleva una tarea sin dar señales, no la hora exacta.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'fecha desconocida'

  const seconds = Math.round((now - then) / 1000)
  if (seconds < 0) return 'ahora mismo'
  if (seconds < 60) return 'hace menos de un minuto'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`

  return new Date(then).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Fecha y hora completas, para la ficha de detalle. */
export function fullDateTime(iso: string | null): string {
  if (!iso) return '—'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '—'
  return new Date(parsed).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Duración legible entre dos instantes. */
export function duration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return '—'
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return '—'

  const minutes = Math.round((to - from) / 60000)
  if (minutes < 1) return 'menos de un minuto'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
