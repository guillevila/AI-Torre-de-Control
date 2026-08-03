/**
 * Formateo de tiempos en lenguaje natural.
 *
 * Lo que importa de un vistazo es cuánto lleva algo sin dar señales, no la hora
 * exacta. La hora exacta vive en la ficha.
 */

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'fecha desconocida'

  const seconds = Math.round((now - then) / 1000)
  if (seconds < 0) return 'ahora mismo'
  if (seconds < 60) return 'hace un momento'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`

  return new Date(then).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Cronómetro: cuánto lleva en marcha, en formato monoespaciado.
 *
 * Se muestra vivo solo mientras la tarea trabaja; en cuanto termina, se congela
 * en la duración final.
 */
export function elapsed(fromIso: string | null, toIso: string | null, now = Date.now()): string {
  if (!fromIso) return '—'
  const from = Date.parse(fromIso)
  if (Number.isNaN(from)) return '—'

  const to = toIso ? Date.parse(toIso) : now
  const minutes = Math.max(0, Math.floor((to - from) / 60000))

  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}

/** Hora corta (14:32), para el historial y la actividad reciente. */
export function clockTime(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '—'
  return new Date(parsed).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** Fecha y hora completas, para la ficha. */
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

/** Día + hora, para las líneas del historial que no son de hoy. */
export function dayAndClock(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '—'
  const date = new Date(parsed)
  const isToday = new Date().toDateString() === date.toDateString()
  return isToday
    ? clockTime(iso)
    : `${date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${clockTime(iso)}`
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
