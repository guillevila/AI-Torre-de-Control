import type { Task } from '@torre/contracts'

/**
 * Exportación de las tareas a CSV.
 *
 * Existe por el riesgo abierto más incómodo del proyecto: hoy no hay ninguna
 * forma de sacar tus datos de la aplicación. Esto la da, y de paso sirve de
 * copia de seguridad legible con cualquier hoja de cálculo.
 *
 * Exporta metadatos, nunca contenido de conversaciones: es literalmente lo
 * mismo que guarda la base de datos (D5).
 */

const COLUMNS = [
  'id',
  'titulo',
  'plataforma',
  'estado',
  'fuente',
  'confianza',
  'enlace',
  'sesion',
  'carpeta',
  'creada',
  'iniciada',
  'ultima_senal',
  'terminada',
  'notas',
] as const

/**
 * Neutraliza una celda que una hoja de cálculo podría interpretar como fórmula.
 *
 * Si un título empieza por `=`, `+`, `-` o `@`, Excel o LibreOffice lo
 * ejecutarían al abrir el fichero. Anteponer un apóstrofo lo convierte en texto
 * inofensivo sin perder lo que escribiste.
 */
function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function cell(value: string | null): string {
  if (value === null || value === '') return ''
  const safe = neutraliseFormula(value)
  // Comillas dobles duplicadas, y se entrecomilla siempre que haya separadores.
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function tasksToCsv(tasks: readonly Task[]): string {
  const rows = tasks.map((task) =>
    [
      task.id,
      task.title,
      task.provider,
      task.status,
      task.statusSource,
      task.statusConfidence,
      task.externalUrl,
      task.externalSessionId,
      task.projectPath,
      task.createdAt,
      task.startedAt,
      task.lastActivityAt,
      task.finishedAt,
      task.notes,
    ]
      .map((value) => cell(value ?? null))
      .join(','),
  )

  // BOM para que Excel en Windows abra los acentos correctamente.
  return `﻿${[COLUMNS.join(','), ...rows].join('\r\n')}\r\n`
}
