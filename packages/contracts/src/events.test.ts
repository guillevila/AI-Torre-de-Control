import { describe, expect, it } from 'vitest'
import { localEventSchema } from './events.js'

/**
 * Estos tests son la garantía de dos promesas del producto:
 *  - solo entran eventos bien formados;
 *  - por un evento NUNCA puede colarse contenido de una conversación (D5).
 */

const validEvent = {
  type: 'status_changed',
  taskId: 'task-0001',
  status: 'completed',
  source: 'local_event',
  confidence: 'high',
  timestamp: '2026-08-03T12:00:00Z',
}

describe('validación de eventos locales', () => {
  it('acepta el evento del contrato', () => {
    const result = localEventSchema.safeParse(validEvent)
    expect(result.success).toBe(true)
  })

  it('rechaza un estado que no existe en el modelo normalizado', () => {
    const result = localEventSchema.safeParse({ ...validEvent, status: 'terminado' })
    expect(result.success).toBe(false)
  })

  it('rechaza una fuente inventada', () => {
    const result = localEventSchema.safeParse({ ...validEvent, source: 'telepatia' })
    expect(result.success).toBe(false)
  })

  it('rechaza un nivel de confianza inválido', () => {
    const result = localEventSchema.safeParse({ ...validEvent, confidence: 'altisima' })
    expect(result.success).toBe(false)
  })

  it('rechaza una marca de tiempo que no es una fecha', () => {
    const result = localEventSchema.safeParse({ ...validEvent, timestamp: 'ayer por la tarde' })
    expect(result.success).toBe(false)
  })

  it('rechaza un tipo de evento desconocido', () => {
    const result = localEventSchema.safeParse({ ...validEvent, type: 'ejecutar_comando' })
    expect(result.success).toBe(false)
  })

  it('rechaza el evento entero si trae campos de más', () => {
    // Este es el caso importante: alguien intentando adjuntar el contenido
    // de la conversación a un evento de estado.
    const result = localEventSchema.safeParse({
      ...validEvent,
      prompt: 'texto de la conversación',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza un identificador de tarea vacío', () => {
    const result = localEventSchema.safeParse({ ...validEvent, taskId: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza lo que no es un objeto', () => {
    expect(localEventSchema.safeParse('completado').success).toBe(false)
    expect(localEventSchema.safeParse(null).success).toBe(false)
    expect(localEventSchema.safeParse([validEvent]).success).toBe(false)
  })
})
