import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_SETTINGS, settingsPatchSchema, settingsSchema, type Settings } from '@torre/contracts'

/**
 * Ajustes locales, guardados en un JSON dentro de la carpeta del usuario.
 *
 * Si el fichero no existe, está corrupto o trae valores imposibles, se vuelve a
 * los valores por defecto sin molestar: unos ajustes ilegibles no deben impedir
 * abrir la aplicación.
 */
export class SettingsStore {
  private current: Settings

  constructor(private readonly filePath: string) {
    this.current = this.read()
  }

  get(): Settings {
    return this.current
  }

  update(rawPatch: unknown): Settings {
    const patch = settingsPatchSchema.parse(rawPatch)
    this.current = settingsSchema.parse({ ...this.current, ...patch })
    this.write()
    return this.current
  }

  private read(): Settings {
    try {
      const parsed = settingsSchema.safeParse(JSON.parse(readFileSync(this.filePath, 'utf8')))
      if (parsed.success) return parsed.data
      console.warn('[torre] Ajustes ilegibles; se usan los valores por defecto.')
    } catch {
      // Todavía no existe: es lo normal en el primer arranque.
    }
    return { ...DEFAULT_SETTINGS }
  }

  private write(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, `${JSON.stringify(this.current, null, 2)}\n`, 'utf8')
    } catch (error) {
      console.error('[torre] No se pudieron guardar los ajustes:', error)
    }
  }
}
