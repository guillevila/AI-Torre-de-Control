import { describe, expect, it, vi } from 'vitest'
import { PermissionRegistry } from './permission-registry.js'

/**
 * El registro es la pieza que hace cumplir D21: nadie se queda colgado
 * esperando a la Torre. Estos tests son la prueba de que esa salvaguarda existe
 * de verdad y no solo en el ADR.
 */

const request = (requestId = 'req-12345678') => ({
  requestId,
  taskId: 'task-1',
  taskTitle: 'Refactor de facturación',
  toolName: 'Bash',
  detail: 'rm -rf ./dist',
  cwd: 'C:/proyecto',
  requestedAt: '2026-08-04T10:00:00.000Z',
})

describe('transmitir la decisión del usuario', () => {
  it('devuelve «allow» cuando aceptas', async () => {
    const registry = new PermissionRegistry()
    const pending = registry.await(request())

    expect(registry.decide('req-12345678', 'allow')).toBe(true)
    await expect(pending).resolves.toMatchObject({ outcome: 'allow' })
  })

  it('devuelve «deny» cuando rechazas', async () => {
    const registry = new PermissionRegistry()
    const pending = registry.await(request())

    registry.decide('req-12345678', 'deny')
    await expect(pending).resolves.toMatchObject({ outcome: 'deny' })
  })

  it('avisa de que no pudo transmitir si la petición ya no existe', () => {
    const registry = new PermissionRegistry()
    expect(registry.decide('req-inexistente', 'allow')).toBe(false)
  })

  it('no se puede decidir dos veces la misma petición', async () => {
    const registry = new PermissionRegistry()
    const pending = registry.await(request())

    expect(registry.decide('req-12345678', 'allow')).toBe(true)
    expect(registry.decide('req-12345678', 'deny')).toBe(false)
    await expect(pending).resolves.toMatchObject({ outcome: 'allow' })
  })
})

describe('la salvaguarda del tiempo de espera (D21)', () => {
  it('se rinde sola y devuelve «timeout»', async () => {
    vi.useFakeTimers()
    const registry = new PermissionRegistry({ timeoutMs: 90_000 })
    const pending = registry.await(request())

    vi.advanceTimersByTime(90_001)
    await expect(pending).resolves.toMatchObject({ outcome: 'timeout' })
    vi.useRealTimers()
  })

  it('al rendirse deja de estar pendiente', async () => {
    vi.useFakeTimers()
    const registry = new PermissionRegistry({ timeoutMs: 1_000 })
    const pending = registry.await(request())
    expect(registry.list()).toHaveLength(1)

    vi.advanceTimersByTime(1_001)
    await pending
    expect(registry.list()).toHaveLength(0)
    vi.useRealTimers()
  })

  it('publica cuándo dejará de esperar, para poder enseñar la cuenta atrás', () => {
    const registry = new PermissionRegistry({ timeoutMs: 90_000, now: () => 1_000 })
    void registry.await(request())

    expect(registry.list()[0]?.expiresAt).toBe(new Date(91_000).toISOString())
  })
})

describe('al cerrar la aplicación', () => {
  it('libera todo lo pendiente para no dejar sesiones colgadas', async () => {
    const registry = new PermissionRegistry()
    const uno = registry.await(request('req-aaaaaaaa'))
    const dos = registry.await(request('req-bbbbbbbb'))

    registry.releaseAll()

    await expect(uno).resolves.toMatchObject({ outcome: 'timeout' })
    await expect(dos).resolves.toMatchObject({ outcome: 'timeout' })
    expect(registry.list()).toHaveLength(0)
  })
})

describe('peticiones repetidas', () => {
  it('un reintento con el mismo identificador libera al anterior', async () => {
    const registry = new PermissionRegistry()
    const primera = registry.await(request())
    const segunda = registry.await(request())

    // La primera se resuelve sola para que nadie se quede esperando.
    await expect(primera).resolves.toMatchObject({ outcome: 'timeout' })
    expect(registry.list()).toHaveLength(1)

    registry.decide('req-12345678', 'allow')
    await expect(segunda).resolves.toMatchObject({ outcome: 'allow' })
  })
})

describe('avisos a la interfaz', () => {
  it('publica la lista cada vez que cambia', async () => {
    const cambios: number[] = []
    const registry = new PermissionRegistry({ onChange: (list) => cambios.push(list.length) })

    const pending = registry.await(request())
    registry.decide('req-12345678', 'allow')
    await pending

    expect(cambios).toEqual([1, 0])
  })

  it('lo que se publica lleva el comando íntegro, para poder decidir', () => {
    const registry = new PermissionRegistry()
    void registry.await(request())

    expect(registry.list()[0]?.detail).toBe('rm -rf ./dist')
  })
})
