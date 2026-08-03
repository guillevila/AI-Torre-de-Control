import { useState, type FormEvent } from 'react'
import { PROVIDERS, type Provider, type Task, type TaskStatus } from '@torre/contracts'
import { PROVIDER_LABELS, STATUS_LABELS } from '@torre/domain'

/** Estados con los que tiene sentido dar de alta una tarea. */
const INITIAL_STATUSES: readonly TaskStatus[] = ['draft', 'queued', 'running', 'waiting_user']

interface TaskFormProps {
  /** Si viene una tarea, el formulario edita; si no, crea. */
  task?: Task | null
  onSubmit: (values: Record<string, unknown>) => void
  onCancel: () => void
}

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const editing = Boolean(task)

  const [title, setTitle] = useState(task?.title ?? '')
  const [provider, setProvider] = useState<Provider>(task?.provider ?? 'claude_code')
  const [externalUrl, setExternalUrl] = useState(task?.externalUrl ?? '')
  const [externalSessionId, setExternalSessionId] = useState(task?.externalSessionId ?? '')
  const [projectPath, setProjectPath] = useState(task?.projectPath ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>('draft')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nullable = (value: string) => (value.trim() === '' ? null : value.trim())

    const base = {
      title: title.trim(),
      provider,
      externalUrl: nullable(externalUrl),
      externalSessionId: nullable(externalSessionId),
      projectPath: nullable(projectPath),
      notes: nullable(notes),
    }

    onSubmit(editing ? { id: task?.id, ...base } : { ...base, status })
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={editing ? 'Editar tarea' : 'Nueva tarea'}>
      <form className="panel panel--form" onSubmit={handleSubmit} data-testid="task-form">
        <h2 className="panel__title">{editing ? 'Editar tarea' : 'Nueva tarea'}</h2>

        <label className="field">
          <span className="field__label">¿Qué has encargado?</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej.: Informe de proveedores del Q3"
            maxLength={200}
            required
            autoFocus
            data-testid="field-title"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">¿Dónde se está ejecutando?</span>
            <select
              className="select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              data-testid="field-provider"
            >
              {PROVIDERS.map((value) => (
                <option key={value} value={value}>
                  {PROVIDER_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {!editing && (
            <label className="field">
              <span className="field__label">Estado inicial</span>
              <select
                className="select"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                data-testid="field-status"
              >
                {INITIAL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className="field">
          <span className="field__label">
            Enlace a la conversación <span className="field__hint">(opcional)</span>
          </span>
          <input
            className="input"
            type="url"
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
            placeholder="https://…"
            data-testid="field-url"
          />
          <span className="field__hint">
            Es lo que te permitirá volver al resultado con un solo clic. Solo http:// o https://
          </span>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">
              Identificador de sesión <span className="field__hint">(opcional)</span>
            </span>
            <input
              className="input"
              value={externalSessionId}
              onChange={(event) => setExternalSessionId(event.target.value)}
              placeholder="Lo usarán las integraciones automáticas"
            />
          </label>

          <label className="field">
            <span className="field__label">
              Carpeta del proyecto <span className="field__hint">(opcional)</span>
            </span>
            <input
              className="input"
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
              placeholder="C:\ruta\del\proyecto"
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">
            Notas para ti <span className="field__hint">(opcional)</span>
          </span>
          <textarea
            className="input input--area"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Recordatorios tuyos. La aplicación nunca escribe aquí."
          />
        </label>

        <footer className="panel__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" data-testid="submit-task">
            {editing ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </footer>
      </form>
    </div>
  )
}
