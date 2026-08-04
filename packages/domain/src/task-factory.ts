import {
  createTaskInputSchema,
  updateTaskInputSchema,
  type Task,
  type UpdateTaskInput,
} from '@torre/contracts'

/**
 * Construcción y edición de tareas.
 *
 * `id` y `now` se reciben como parámetros en lugar de generarse dentro. Es lo
 * que permite que los tests comprueben el resultado exacto sin depender del
 * reloj ni del azar.
 */

export interface TaskCreationContext {
  id: string
  now: string
}

export function createTask(rawInput: unknown, ctx: TaskCreationContext): Task {
  const input = createTaskInputSchema.parse(rawInput)
  const started = input.status !== 'draft' ? ctx.now : null

  return {
    id: ctx.id,
    title: input.title,
    provider: input.provider,
    externalUrl: input.externalUrl,
    externalSessionId: input.externalSessionId,
    projectPath: input.projectPath,
    status: input.status,
    // Por omisión, manual y alta: el caso normal es que la registres tú, y de
    // eso no hay duda. Quien la cree por otra vía debe decirlo, porque la
    // primera línea del historial nace de aquí y tiene que ser verdad (D8).
    statusSource: input.statusSource,
    statusConfidence: input.statusConfidence,
    startedAt: started,
    finishedAt: null,
    lastActivityAt: ctx.now,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    notes: input.notes,
  }
}

/**
 * Edita los datos descriptivos de una tarea.
 *
 * A propósito NO puede tocar `status`, `statusSource` ni `statusConfidence`:
 * para eso existe la máquina de estados. Si se pudiera cambiar el estado desde
 * aquí habría dos caminos distintos para lo mismo, que es justo lo que evitamos.
 */
export function applyTaskUpdate(task: Task, rawInput: unknown, now: string): Task {
  const input: UpdateTaskInput = updateTaskInputSchema.parse(rawInput)

  return {
    ...task,
    title: input.title ?? task.title,
    provider: input.provider ?? task.provider,
    externalUrl: input.externalUrl !== undefined ? input.externalUrl : task.externalUrl,
    externalSessionId:
      input.externalSessionId !== undefined ? input.externalSessionId : task.externalSessionId,
    projectPath: input.projectPath !== undefined ? input.projectPath : task.projectPath,
    notes: input.notes !== undefined ? input.notes : task.notes,
    updatedAt: now,
  }
}
