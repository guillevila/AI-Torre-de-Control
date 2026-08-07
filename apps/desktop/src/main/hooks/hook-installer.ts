import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HookPreview, HookStatus } from '@torre/contracts'
import hookSource from './claude-code-hook.mjs?raw'

/**
 * Instalación y desinstalación del enlace con Claude Code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA CLASE TOCA UN FICHERO QUE NO ES NUESTRO
 *
 * `~/.claude/settings.json` gobierna **todas** tus sesiones de Claude Code, no
 * solo las de este proyecto. La decisión D13 es clara: nada se toca sin
 * enseñarte antes el cambio exacto y sin dejar copia de seguridad.
 *
 * Por eso el flujo obligatorio es: `preview()` → lo ves → `install()`.
 * `install()` nunca se llama sin que hayas visto el resultado de `preview()`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * El script del enlace se copia a **tu carpeta de datos**, no se referencia
 * dentro del repositorio. Así puedes mover o borrar la carpeta del proyecto sin
 * dejar la configuración de Claude Code apuntando al vacío.
 */

/** Eventos que se enganchan, y por qué. */
const HOOKED_EVENTS = [
  {
    event: 'PermissionRequest',
    // Más que la espera de la Torre (90 s) y que la del propio script (100 s),
    // para que el que decida sea siempre el más interno.
    timeoutSeconds: 120,
    summary: 'Cuando Claude Code pida permiso, te lo enseña en la Torre y espera tu decisión.',
  },
  {
    event: 'UserPromptSubmit',
    timeoutSeconds: 10,
    summary: 'Cuando le pidas algo a Claude Code, la tarea pasa a «trabajando».',
  },
  {
    event: 'Stop',
    // Más que la espera de la Torre (180 s como mucho) y que la del propio
    // script (190 s), para que el que se rinda primero sea siempre el más
    // interno. Con los 10 s que tenía antes, Claude Code mataba el enlace a
    // media espera y la respuesta se perdía nada más escribirla.
    timeoutSeconds: 210,
    summary:
      'Cuando Claude Code termine un turno, la tarea pasa a «terminada» y va a la mesa de entregas, esperando que la revises. Si enciendes «contestar desde la Torre» en Ajustes, además te enseña lo que te ha dicho y espera tu respuesta.',
  },
  {
    event: 'Notification',
    timeoutSeconds: 10,
    summary:
      'Cuando Claude Code te pida algo, la tarea pasa a «te espera» y se planta en tu puerta.',
  },
  {
    event: 'SessionEnd',
    timeoutSeconds: 10,
    summary: 'Cuando la sesión acabe, la tarea pasa a «terminada».',
  },
] as const

const HOOK_FILENAME = 'claude-code-hook.mjs'

interface CommandHook {
  type: string
  command?: string
  args?: string[]
  timeout?: number
  [key: string]: unknown
}

interface HookGroup {
  matcher?: string
  hooks?: CommandHook[]
  [key: string]: unknown
}

export class HookInstaller {
  private readonly claudeDir: string
  private readonly settingsPath: string
  private readonly hookScriptPath: string
  private lastBackupPath: string | null = null

  constructor(private readonly userDataDir: string, claudeHome?: string) {
    this.claudeDir = claudeHome ?? join(homedir(), '.claude')
    this.settingsPath = join(this.claudeDir, 'settings.json')
    this.hookScriptPath = join(userDataDir, HOOK_FILENAME)
  }

  /**
   * Estado real, leído del disco cada vez.
   *
   * Nunca se recuerda «lo instalamos la última vez»: si lo quitas a mano por
   * fuera, la Torre tiene que enterarse.
   */
  status(): HookStatus {
    const settings = this.readSettings()
    const installed = this.countOurEntries(settings) > 0
    return {
      installed,
      needsUpdate: installed && this.isOutdated(settings),
      settingsPath: this.settingsPath,
      settingsExists: existsSync(this.settingsPath),
      hookScriptPath: this.hookScriptPath,
      hookScriptExists: existsSync(this.hookScriptPath),
      lastBackupPath: this.lastBackupPath,
    }
  }

  /**
   * ¿Lo instalado corresponde a esta versión de la aplicación?
   *
   * Se comprueban las dos cosas que pueden quedarse atrás: el contenido del
   * script y la lista de eventos enganchados. Un enlace de una versión anterior
   * puede traducir mal los estados sin dar ninguna señal de que va mal.
   */
  private isOutdated(settings: Record<string, unknown>): boolean {
    if (!existsSync(this.hookScriptPath)) return true

    try {
      if (readFileSync(this.hookScriptPath, 'utf8') !== hookSource) return true
    } catch {
      return true
    }

    const hooks = this.hooksObject(settings)
    return HOOKED_EVENTS.some((entry) => {
      const groups = Array.isArray(hooks[entry.event]) ? (hooks[entry.event] as HookGroup[]) : []
      return !groups.some((group) => (group.hooks ?? []).some((hook) => this.isOurs(hook)))
    })
  }

  /** El cambio exacto, para que lo compares tú mismo antes de aceptarlo (D13). */
  preview(): HookPreview {
    const current = this.readSettings()
    const next = this.withOurHooks(structuredClone(current))
    return {
      settingsPath: this.settingsPath,
      before: this.serialise(current),
      after: this.serialise(next),
      backupPath: this.backupPath(),
      summary: HOOKED_EVENTS.map((entry) => entry.summary),
    }
  }

  install(): HookStatus {
    // 1. El script, en tu carpeta de datos. Se reescribe siempre para que una
    //    versión vieja no conviva con una aplicación nueva.
    mkdirSync(this.userDataDir, { recursive: true })
    writeFileSync(this.hookScriptPath, hookSource, 'utf8')

    // 2. Copia de seguridad ANTES de tocar nada (D13).
    this.backup()

    // 3. Los ajustes, conservando todo lo que ya hubiera.
    mkdirSync(this.claudeDir, { recursive: true })
    const next = this.withOurHooks(this.readSettings())
    writeFileSync(this.settingsPath, this.serialise(next), 'utf8')

    return this.status()
  }

  uninstall(): HookStatus {
    this.backup()

    const settings = this.readSettings()
    const hooks = this.hooksObject(settings)

    for (const key of Object.keys(hooks)) {
      const groups = Array.isArray(hooks[key]) ? (hooks[key] as HookGroup[]) : []
      const cleaned = groups
        .map((group) => ({
          ...group,
          hooks: (group.hooks ?? []).filter((hook) => !this.isOurs(hook)),
        }))
        // Un grupo que se queda sin hooks se retira: dejarlo vacío ensuciaría
        // la configuración del usuario con restos nuestros.
        .filter((group) => (group.hooks?.length ?? 0) > 0)

      if (cleaned.length > 0) hooks[key] = cleaned
      else delete hooks[key]
    }

    if (Object.keys(hooks).length === 0) delete (settings as Record<string, unknown>)['hooks']
    else (settings as Record<string, unknown>)['hooks'] = hooks

    writeFileSync(this.settingsPath, this.serialise(settings), 'utf8')
    return this.status()
  }

  // ─── Interno ───────────────────────────────────────────────────────────────

  /**
   * Lee los ajustes de Claude Code.
   *
   * Si el fichero no existe se devuelve un objeto vacío. Si existe pero está
   * corrupto se lanza: sobrescribir un JSON que no entendemos podría
   * cargarse configuración que el usuario tardó en montar.
   */
  private readSettings(): Record<string, unknown> {
    if (!existsSync(this.settingsPath)) return {}
    const raw = readFileSync(this.settingsPath, 'utf8').trim()
    if (raw === '') return {}
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('no es un objeto')
      }
      return parsed as Record<string, unknown>
    } catch (error) {
      throw new Error(
        `Tu ${this.settingsPath} no es un JSON válido (${
          error instanceof Error ? error.message : 'error desconocido'
        }). No se toca nada: arréglalo o haz una copia y bórralo, y vuelve a intentarlo.`,
      )
    }
  }

  private hooksObject(settings: Record<string, unknown>): Record<string, unknown> {
    const hooks = settings['hooks']
    return typeof hooks === 'object' && hooks !== null && !Array.isArray(hooks)
      ? (hooks as Record<string, unknown>)
      : {}
  }

  /** ¿Este hook es nuestro? Se reconoce por apuntar a nuestro script. */
  private isOurs(hook: CommandHook): boolean {
    const args = Array.isArray(hook.args) ? hook.args : []
    if (args.some((arg) => String(arg) === this.hookScriptPath)) return true
    // Instalaciones antiguas podían llevar la ruta dentro del propio comando.
    return typeof hook.command === 'string' && hook.command.includes(HOOK_FILENAME)
  }

  private countOurEntries(settings: Record<string, unknown>): number {
    const hooks = this.hooksObject(settings)
    let count = 0
    for (const value of Object.values(hooks)) {
      if (!Array.isArray(value)) continue
      for (const group of value as HookGroup[]) {
        for (const hook of group.hooks ?? []) if (this.isOurs(hook)) count += 1
      }
    }
    return count
  }

  /**
   * Añade nuestros hooks conservando los que ya hubiera.
   *
   * Nunca se sustituye la lista de un evento: se añade al final. Si el usuario
   * ya tenía sus propios automatismos, siguen funcionando igual.
   */
  private withOurHooks(settings: Record<string, unknown>): Record<string, unknown> {
    const node = resolveNodePath()
    const hooks = this.hooksObject(settings)

    for (const entry of HOOKED_EVENTS) {
      const existing = Array.isArray(hooks[entry.event]) ? (hooks[entry.event] as HookGroup[]) : []

      // Se quitan los nuestros de una instalación anterior antes de añadir el
      // nuevo, para no acumular duplicados al reinstalar.
      const withoutOurs = existing
        .map((group) => ({
          ...group,
          hooks: (group.hooks ?? []).filter((hook) => !this.isOurs(hook)),
        }))
        .filter((group) => (group.hooks?.length ?? 0) > 0)

      withoutOurs.push({
        hooks: [
          {
            type: 'command',
            command: node,
            // Forma directa: sin intérprete de comandos de por medio, así que
            // funciona igual aunque no haya bash en el PATH.
            args: [this.hookScriptPath],
            timeout: entry.timeoutSeconds,
          },
        ],
      })

      hooks[entry.event] = withoutOurs
    }

    settings['hooks'] = hooks
    return settings
  }

  private backupPath(): string {
    return `${this.settingsPath}.torre-backup.json`
  }

  private backup(): void {
    if (!existsSync(this.settingsPath)) return
    const target = this.backupPath()
    copyFileSync(this.settingsPath, target)
    this.lastBackupPath = target
  }

  private serialise(settings: Record<string, unknown>): string {
    return `${JSON.stringify(settings, null, 2)}\n`
  }
}

/**
 * Ruta absoluta de Node.
 *
 * Se resuelve al instalar y se guarda tal cual, en lugar de confiar en que
 * «node» esté en el PATH del intérprete que Claude Code use para lanzar hooks
 * —que no tiene por qué ser el mismo que el de tu terminal.
 *
 * OJO: no se puede usar `process.execPath`, que aquí es el ejecutable de
 * Electron, no el de Node.
 */
function resolveNodePath(): string {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const output = execFileSync(finder, ['node'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const first = output.split(/\r?\n/).find((line) => line.trim().length > 0)
    if (first) return first.trim()
  } catch {
    // No se encontró: se deja el nombre a secas y que lo resuelva quien ejecute.
  }
  return 'node'
}
