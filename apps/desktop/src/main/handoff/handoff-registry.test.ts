import { describe, expect, it, vi } from 'vitest'
import { HandoffRegistry } from './handoff-registry.js'

/**
 * El registro es lo que impide que un turno de Claude Code se quede colgado
 * esperando a una persona que no está mirando (D21).
 *
 * Importa más aquí que en los permisos: mientras esto espera, Claude está
 * PARADO. Un fallo en estos tests no es una molestia, es una herramienta que se
 * queda congelada.
 */

const entrega = (requestId = 'req-12345678') => ({
  requestId,
  taskId: 'task-1',
  taskTitle: 'Migrar la base de datos',
  message: 'He migrado las tres tablas. ¿Sigo con los índices?',
  cwd: 'C:/proyecto',
  requestedAt: '2026-08-06T10:00:00.000Z',
})

describe('transmitir lo que escribes', () => {
  it('devuelve tu respuesta tal cual', async () => {
    const registry = new HandoffRegistry({ timeoutMs: 60_000 })
    const pendiente = registry.await(entrega())

    expect(registry.reply('req-12345678', 'Sí, sigue con los índices')).toBe(true)
    await expect(pendiente).resolves.toMatchObject({
      outcome: 'reply',
      reply: 'Sí, sigue con los índices',
    })
  })

  it('soltar deja que el turno termine sin decir nada', async () => {
    const registry = new HandoffRegistry({ timeoutMs: 60_000 })
    const pendiente = registry.await(entrega())

    expect(registry.release('req-12345678')).toBe(true)
    await expect(pendiente).resolves.toMatchObject({ outcome: 'release', reply: null })
  })

  it('avisa de que no pudo transmitir si la entrega ya no existe', () => {
    const registry = new HandoffRegistry({ timeoutMs: 60_000 })
    // Devolver false es lo que permite decirle al usuario que su texto se ha
    // perdido, en vez de tragárselo y fingir que llegó.
    expect(registry.reply('req-inexistente', 'hola')).toBe(false)
  })
})

describe('nadie se queda esperando para siempre (D21)', () => {
  it('suelta el turno cuando se agota el tiempo', async () => {
    vi.useFakeTimers()
    try {
      const registry = new HandoffRegistry({ timeoutMs: 1_000 })
      const pendiente = registry.await(entrega())

      vi.advanceTimersByTime(1_000)

      await expect(pendiente).resolves.toMatchObject({ outcome: 'release', reply: null })
      expect(registry.list()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('al cerrar la aplicación suelta todo lo retenido', async () => {
    const registry = new HandoffRegistry({ timeoutMs: 60_000 })
    const uno = registry.await(entrega('req-11111111'))
    const dos = registry.await(entrega('req-22222222'))

    registry.releaseAll()

    await expect(uno).resolves.toMatchObject({ outcome: 'release' })
    await expect(dos).resolves.toMatchObject({ outcome: 'release' })
    expect(registry.list()).toHaveLength(0)
  })

  it('una entrega repetida libera a la anterior en vez de dejarla colgada', async () => {
    const registry = new HandoffRegistry({ timeoutMs: 60_000 })
    const primera = registry.await(entrega())
    const segunda = registry.await(entrega())

    await expect(primera).resolves.toMatchObject({ outcome: 'release' })
    expect(registry.list()).toHaveLength(1)

    registry.reply('req-12345678', 'vale')
    await expect(segunda).resolves.toMatchObject({ outcome: 'reply' })
  })
})

describe('la cuenta atrás que se ve es la de verdad', () => {
  it('calcula el vencimiento con el tiempo configurado', () => {
    const registry = new HandoffRegistry({
      timeoutMs: 30_000,
      now: () => Date.parse('2026-08-06T10:00:00.000Z'),
    })
    void registry.await(entrega())

    expect(registry.list()[0]?.expiresAt).toBe('2026-08-06T10:00:30.000Z')
  })

  it('cambiar el ajuste no altera la cuenta de lo que ya estaba esperando', () => {
    // Bajarle el tiempo a alguien que está escribiendo sería mentirle: el
    // número que mira bajar dejaría de corresponder con lo que va a pasar.
    let ahora = Date.parse('2026-08-06T10:00:00.000Z')
    const registry = new HandoffRegistry({ timeoutMs: 120_000, now: () => ahora })
    void registry.await(entrega('req-11111111'))

    registry.setTimeout(15_000)
    ahora += 1_000
    void registry.await(entrega('req-22222222'))

    const [vieja, nueva] = registry.list()
    expect(vieja?.expiresAt).toBe('2026-08-06T10:02:00.000Z')
    expect(nueva?.expiresAt).toBe('2026-08-06T10:00:16.000Z')
  })
})

describe('la interfaz se entera de los cambios', () => {
  it('avisa al registrar y al resolver', async () => {
    const cambios: number[] = []
    const registry = new HandoffRegistry({
      timeoutMs: 60_000,
      onChange: (pending) => cambios.push(pending.length),
    })

    const pendiente = registry.await(entrega())
    registry.reply('req-12345678', 'sigue')
    await pendiente

    expect(cambios).toEqual([1, 0])
  })
})
