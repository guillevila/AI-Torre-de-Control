import { describe, expect, it } from 'vitest'
import { externalUrlSchema, taskSchema, TASK_STATUSES } from './task.js'

describe('validación de enlaces externos', () => {
  it('acepta http y https', () => {
    expect(externalUrlSchema.safeParse('https://claude.ai/chat/abc').success).toBe(true)
    expect(externalUrlSchema.safeParse('http://localhost:3000/x').success).toBe(true)
  })

  it('rechaza esquemas peligrosos', () => {
    for (const peligroso of [
      'javascript:alert(1)',
      'file:///C:/Windows/System32',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      expect(externalUrlSchema.safeParse(peligroso).success).toBe(false)
    }
  })

  it('rechaza texto que no es una URL', () => {
    expect(externalUrlSchema.safeParse('no soy una url').success).toBe(false)
    expect(externalUrlSchema.safeParse('').success).toBe(false)
  })
})

describe('modelo de tarea', () => {
  it('contempla los nueve estados normalizados', () => {
    expect([...TASK_STATUSES].sort()).toEqual([
      'archived',
      'completed',
      'draft',
      'failed',
      'queued',
      // El reposo de un proyecto: revisado, sin nada pendiente, pero vivo.
      'reviewed',
      'running',
      'unknown',
      'waiting_user',
    ])
  })

  it('no admite ningún campo con contenido de conversación (D5)', () => {
    const campos = Object.keys(taskSchema.shape)
    for (const prohibido of ['prompt', 'response', 'output', 'messages', 'transcript', 'content']) {
      expect(campos).not.toContain(prohibido)
    }
  })

  it('valida una tarea completa bien formada', () => {
    const result = taskSchema.safeParse({
      id: 'task-1',
      title: 'Estudio de mercado',
      provider: 'chatgpt',
      externalUrl: 'https://example.test/c/1',
      externalSessionId: null,
      sessionEnded: false,
      projectPath: null,
      status: 'running',
      statusSource: 'manual',
      statusConfidence: 'high',
      startedAt: '2026-08-03T12:00:00Z',
      finishedAt: null,
      lastActivityAt: '2026-08-03T12:00:00Z',
      createdAt: '2026-08-03T12:00:00Z',
      updatedAt: '2026-08-03T12:00:00Z',
      notes: null,
    })
    expect(result.success).toBe(true)
  })
})
