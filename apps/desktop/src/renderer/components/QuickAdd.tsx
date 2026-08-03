import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PROVIDERS, type Provider, type Task, type TaskStatus } from '@torre/contracts'
import { detectProvider, PROVIDER_COLORS, PROVIDER_LABELS, STATUS_GLYPHS } from '@torre/domain'

/** Plataformas que se ofrecen de un toque. El resto vive en el desplegable. */
const QUICK_PROVIDERS: readonly Provider[] = [
  'chatgpt',
  'claude_web',
  'claude_code',
  'cowork',
  'codex',
]

interface QuickAddProps {
  /** Si viene una tarea, el formulario edita en lugar de crear. */
  editing?: Task | null
  onSubmit: (values: Record<string, unknown>) => void
  onCancel: () => void
}

/**
 * Alta rápida.
 *
 * Objetivo: menos de 15 segundos. Un campo, Enter, y ya está. Todo lo demás
 * —plataforma, enlace, carpeta, notas— es opcional y se puede rellenar después
 * desde la ficha.
 *
 * La plataforma se deduce del dominio del enlace en cuanto lo pegas, pero
 * siempre se puede cambiar: es una ayuda, no una imposición.
 */
export function QuickAdd({ editing, onSubmit, onCancel }: QuickAddProps) {
  const isEditing = Boolean(editing)

  const [title, setTitle] = useState(editing?.title ?? '')
  const [provider, setProvider] = useState<Provider>(editing?.provider ?? 'chatgpt')
  const [providerTouched, setProviderTouched] = useState(isEditing)
  const [url, setUrl] = useState(editing?.externalUrl ?? '')
  const [status, setStatus] = useState<TaskStatus>('running')
  const [showMore, setShowMore] = useState(false)
  const [session, setSession] = useState(editing?.externalSessionId ?? '')
  const [folder, setFolder] = useState(editing?.projectPath ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const detected = useMemo(() => (url.trim() ? detectProvider(url) : null), [url])

  // Si el enlace revela la plataforma y el usuario no la ha elegido a mano,
  // se rellena sola.
  useEffect(() => {
    if (detected && !providerTouched) setProvider(detected)
  }, [detected, providerTouched])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nullable = (value: string) => (value.trim() === '' ? null : value.trim())

    const base = {
      title: title.trim(),
      provider,
      externalUrl: nullable(url),
      externalSessionId: nullable(session),
      projectPath: nullable(folder),
      notes: nullable(notes),
    }

    onSubmit(isEditing ? { id: editing?.id, ...base } : { ...base, status })
  }

  return (
    <div className="overlay overlay--top" role="dialog" aria-modal="true" aria-label={isEditing ? 'Editar tarea' : 'Nueva tarea'}>
      <form className="quick" onSubmit={handleSubmit} data-testid="task-form">
        <div className="quick__body">
          <div className="quick__head">
            <span className="quick__label">{isEditing ? 'Editar tarea' : 'Nueva tarea'}</span>
            <span className="quick__hint mono">Enter para guardar · Esc para cerrar</span>
            <button type="button" className="btn btn--icon" onClick={onCancel} aria-label="Cerrar">
              ✕
            </button>
          </div>

          <input
            className="quick__title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="¿Qué le has encargado?"
            maxLength={200}
            required
            autoFocus
            data-testid="field-title"
          />

          <div className="quick__field">
            <span className="quick__legend">Plataforma</span>
            <div className="chips">
              {QUICK_PROVIDERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  data-active={provider === value}
                  data-testid={`chip-${value}`}
                  style={{ '--chip': PROVIDER_COLORS[value] } as React.CSSProperties}
                  onClick={() => {
                    setProvider(value)
                    setProviderTouched(true)
                  }}
                >
                  {PROVIDER_LABELS[value]}
                </button>
              ))}
              <select
                className="chip chip--select"
                value={QUICK_PROVIDERS.includes(provider) ? '' : provider}
                data-testid="field-provider"
                aria-label="Otra plataforma"
                onChange={(event) => {
                  if (!event.target.value) return
                  setProvider(event.target.value as Provider)
                  setProviderTouched(true)
                }}
              >
                <option value="">Otra…</option>
                {PROVIDERS.filter((value) => !QUICK_PROVIDERS.includes(value)).map((value) => (
                  <option key={value} value={value}>
                    {PROVIDER_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="quick__cols">
            <div className="quick__field">
              <span className="quick__legend">Enlace a la conversación</span>
              <div className="quick__url">
                <input
                  className="input"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                  data-testid="field-url"
                />
                {detected && !providerTouched && (
                  <span className="quick__detected" data-testid="platform-detected">
                    Plataforma detectada
                  </span>
                )}
              </div>
            </div>

            {!isEditing && (
              <div className="quick__field quick__field--narrow">
                <span className="quick__legend">Estado inicial</span>
                <div className="segmented segmented--inline">
                  <button
                    type="button"
                    data-active={status === 'running'}
                    data-testid="initial-running"
                    onClick={() => setStatus('running')}
                  >
                    {STATUS_GLYPHS.running} Trabajando
                  </button>
                  <button
                    type="button"
                    data-active={status === 'draft'}
                    data-testid="initial-draft"
                    onClick={() => setStatus('draft')}
                  >
                    {STATUS_GLYPHS.draft} Borrador
                  </button>
                </div>
              </div>
            )}
          </div>

          {showMore ? (
            <div className="quick__more">
              <label className="field">
                <span className="field__label">Identificador de sesión</span>
                <input
                  className="input"
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                  placeholder="Lo usarán las integraciones automáticas"
                />
              </label>
              <label className="field">
                <span className="field__label">Carpeta del proyecto</span>
                <input
                  className="input"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="C:\ruta\del\proyecto"
                />
              </label>
              <label className="field field--wide">
                <span className="field__label">Notas para ti</span>
                <textarea
                  className="input input--area"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Recordatorios tuyos. La aplicación nunca escribe aquí."
                />
              </label>
            </div>
          ) : (
            <button type="button" className="quick__more-toggle" onClick={() => setShowMore(true)}>
              ＋ Añadir sesión, carpeta o notas <span className="mono">opcional</span>
            </button>
          )}
        </div>

        <footer className="quick__foot">
          <span className="quick__note">
            Se registra con fuente <strong>manual</strong> y confianza <strong>alta</strong>: lo has
            dicho tú.
          </span>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" data-testid="submit-task">
            {isEditing ? 'Guardar' : 'Registrar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
