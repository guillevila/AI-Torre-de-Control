import type { Task } from '@torre/contracts'

/**
 * Fabricante de tareas para los tests.
 *
 * Datos deliberadamente ficticios (D15 y sección 13 de SYSTEM_VISION: los datos
 * de desarrollo y test nunca son reales).
 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
    id: 'task-0001',
    title: 'Tarea de prueba',
    provider: 'claude_code',
    externalUrl: null,
    externalSessionId: null,
    sessionEnded: false,
    sessionTitle: null,
    projectPath: null,
    status: 'draft',
    statusSource: 'manual',
    statusConfidence: 'high',
    startedAt: null,
    finishedAt: null,
    lastActivityAt: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    notes: null,
  }
  return { ...base, ...overrides }
}
