import type { HookActivityEntry } from '@torre/contracts'

/**
 * Las últimas señales recibidas del enlace, y qué se hizo con cada una.
 *
 * Existe por una lección concreta: cuando el enlace con Claude Code no
 * funcionaba, no había forma de saber si el problema era que **no llegaba
 * nada** o que llegaba y **se rechazaba**. Hicieron falta tres rondas de
 * diagnóstico leyendo la base de datos a mano para averiguarlo.
 *
 * Vive en memoria y se pierde al cerrar, igual que los permisos (D20). No es un
 * registro de auditoría: es una ventana para mirar mientras pasa.
 */
export class HookActivityLog {
  private readonly entries: HookActivityEntry[] = []

  constructor(private readonly limit = 40) {}

  record(entry: Omit<HookActivityEntry, 'at'>, at: string = new Date().toISOString()): void {
    this.entries.unshift({ ...entry, at })
    if (this.entries.length > this.limit) this.entries.length = this.limit
  }

  list(): HookActivityEntry[] {
    return [...this.entries]
  }
}
