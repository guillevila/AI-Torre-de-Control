/**
 * Comparación de rutas de proyecto.
 *
 * Es la vía principal para saber a qué tarea pertenece una sesión de Claude
 * Code: la sesión dice desde qué carpeta trabaja, y se busca la tarea que tenga
 * esa misma carpeta.
 *
 * Se normaliza a lo bruto —barras iguales, sin barra final, en minúsculas—
 * porque el objetivo es casar `C:\Proyectos\Torre` con `c:/proyectos/torre/`,
 * no distinguir dos carpetas que solo se diferencien en mayúsculas. Ese caso no
 * existe en la práctica, y confundirlas es inofensivo; no casarlas, no.
 */
export function normalizeProjectPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

export function samePath(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return normalizeProjectPath(a) === normalizeProjectPath(b)
}

/** Nombre de la carpeta, para titular una tarea creada automáticamente. */
export function folderName(path: string): string {
  const normalized = normalizeProjectPath(path)
  const last = normalized.split('/').filter(Boolean).pop()
  return last ?? path
}
