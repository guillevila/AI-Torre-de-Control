import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HookInstaller } from './hook-installer.js'

/**
 * Tests del instalador.
 *
 * Es la clase que toca un fichero que NO es nuestro: `~/.claude/settings.json`
 * gobierna todas las sesiones de Claude Code del usuario. Lo que se comprueba
 * aquí es exactamente lo que promete la decisión D13: que no se pisa nada, que
 * queda copia, y que desinstalar deja el fichero como estaba.
 */

let dataDir: string
let claudeHome: string
let installer: HookInstaller

const settingsPath = () => join(claudeHome, 'settings.json')
const readSettings = () => JSON.parse(readFileSync(settingsPath(), 'utf8'))

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'torre-data-'))
  claudeHome = mkdtempSync(join(tmpdir(), 'torre-claude-'))
  installer = new HookInstaller(dataDir, claudeHome)
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(claudeHome, { recursive: true, force: true })
})

describe('estado', () => {
  it('parte de no instalado', () => {
    const status = installer.status()
    expect(status.installed).toBe(false)
    expect(status.settingsExists).toBe(false)
  })

  it('lee del disco cada vez, no recuerda lo que hizo', () => {
    installer.install()
    expect(installer.status().installed).toBe(true)

    // Alguien lo quita por fuera, a mano.
    writeFileSync(settingsPath(), JSON.stringify({}), 'utf8')
    expect(installer.status().installed).toBe(false)
  })
})

describe('enseñar el cambio antes de tocar nada (D13)', () => {
  it('el previo no escribe absolutamente nada', () => {
    installer.preview()
    expect(existsSync(settingsPath())).toBe(false)
  })

  it('enseña el antes, el después y dónde queda la copia', () => {
    const preview = installer.preview()
    expect(preview.settingsPath).toBe(settingsPath())
    expect(preview.backupPath).toContain('torre-backup')
    expect(preview.summary.length).toBeGreaterThan(0)
    expect(JSON.parse(preview.after).hooks.PermissionRequest).toBeDefined()
  })

  it('el después incluye los cuatro eventos que se enganchan', () => {
    const after = JSON.parse(installer.preview().after)
    expect(Object.keys(after.hooks).sort()).toEqual([
      'Notification',
      'PermissionRequest',
      'SessionEnd',
      'Stop',
    ])
  })
})

describe('instalar', () => {
  it('escribe el script en la carpeta de datos, no en el repositorio', () => {
    const status = installer.install()
    expect(status.hookScriptExists).toBe(true)
    expect(status.hookScriptPath.startsWith(dataDir)).toBe(true)
    expect(readFileSync(status.hookScriptPath, 'utf8')).toContain('AI Torre de Control')
  })

  it('invoca el script en forma directa, sin intérprete de comandos', () => {
    installer.install()
    const hook = readSettings().hooks.PermissionRequest[0].hooks[0]
    expect(hook.type).toBe('command')
    expect(Array.isArray(hook.args)).toBe(true)
    expect(hook.args[0]).toContain('claude-code-hook.mjs')
  })

  it('da al permiso un tiempo mayor que el que espera la Torre', () => {
    installer.install()
    const permiso = readSettings().hooks.PermissionRequest[0].hooks[0]
    // La Torre espera 90 s y el script 100 s: Claude Code debe esperar más que
    // ambos, o mataría el hook antes de que nadie pudiera decidir.
    expect(permiso.timeout).toBeGreaterThan(100)
  })

  it('CONSERVA los automatismos que el usuario ya tuviera', () => {
    mkdirSync(claudeHome, { recursive: true })
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        model: 'opus',
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'mi-script-personal.sh' }] }],
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'auditar.sh' }] }],
        },
      }),
      'utf8',
    )

    installer.install()
    const settings = readSettings()

    // Lo suyo sigue ahí, intacto.
    expect(settings.model).toBe('opus')
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('auditar.sh')
    const stopCommands = settings.hooks.Stop.flatMap((g: { hooks: { command: string }[] }) =>
      g.hooks.map((h) => h.command),
    )
    expect(stopCommands).toContain('mi-script-personal.sh')
    // Y lo nuestro se ha añadido al final.
    expect(settings.hooks.Stop.length).toBe(2)
  })

  it('guarda copia de seguridad antes de escribir', () => {
    mkdirSync(claudeHome, { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify({ model: 'opus' }), 'utf8')

    const status = installer.install()
    expect(status.lastBackupPath).toBeTruthy()
    expect(JSON.parse(readFileSync(status.lastBackupPath as string, 'utf8')).model).toBe('opus')
  })

  it('reinstalar no duplica entradas', () => {
    installer.install()
    installer.install()
    installer.install()

    const groups = readSettings().hooks.PermissionRequest
    const total = groups.flatMap((g: { hooks: unknown[] }) => g.hooks).length
    expect(total).toBe(1)
  })

  it('se niega a tocar un fichero que no entiende', () => {
    mkdirSync(claudeHome, { recursive: true })
    writeFileSync(settingsPath(), '{ esto no es json', 'utf8')

    expect(() => installer.install()).toThrow(/no es un JSON válido/)
    // Y lo deja exactamente como estaba.
    expect(readFileSync(settingsPath(), 'utf8')).toBe('{ esto no es json')
  })
})

describe('desinstalar', () => {
  it('quita lo nuestro y deja lo del usuario', () => {
    mkdirSync(claudeHome, { recursive: true })
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'mi-script-personal.sh' }] }] },
      }),
      'utf8',
    )

    installer.install()
    const status = installer.uninstall()

    expect(status.installed).toBe(false)
    const settings = readSettings()
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('mi-script-personal.sh')
    expect(settings.hooks.PermissionRequest).toBeUndefined()
  })

  it('deja el fichero limpio si no había nada más', () => {
    installer.install()
    installer.uninstall()
    expect(readSettings().hooks).toBeUndefined()
  })

  it('también hace copia antes de quitar', () => {
    installer.install()
    const status = installer.uninstall()
    expect(status.lastBackupPath).toBeTruthy()
  })
})
