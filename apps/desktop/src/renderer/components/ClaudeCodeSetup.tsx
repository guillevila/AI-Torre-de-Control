import { useCallback, useEffect, useState } from 'react'
import type { HookPreview, HookStatus } from '@torre/contracts'

/**
 * Instalación del enlace con Claude Code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA PANTALLA EXISTE POR LA DECISIÓN D13
 *
 * Instalar el enlace modifica `~/.claude/settings.json`, que gobierna **todas**
 * tus sesiones de Claude Code, no solo las de este proyecto. Por eso el botón
 * de instalar **no aparece** hasta que has visto el cambio exacto: el fichero
 * antes, el fichero después y dónde queda la copia de seguridad.
 *
 * No es un trámite. Es la diferencia entre una herramienta que te pide permiso
 * y una que se instala sola en tu entorno de trabajo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ClaudeCodeSetup() {
  const [status, setStatus] = useState<HookStatus | null>(null)
  const [preview, setPreview] = useState<HookPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const result = await window.torre.hookStatus()
    if (result.ok) setStatus(result.data)
    else setError(result.error)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const showPreview = async () => {
    setError(null)
    const result = await window.torre.hookPreview()
    if (result.ok) setPreview(result.data)
    else setError(result.error)
  }

  const install = async () => {
    setBusy(true)
    const result = await window.torre.hookInstall()
    setBusy(false)
    if (result.ok) {
      setStatus(result.data)
      setPreview(null)
    } else setError(result.error)
  }

  const uninstall = async () => {
    setBusy(true)
    const result = await window.torre.hookUninstall()
    setBusy(false)
    if (result.ok) setStatus(result.data)
    else setError(result.error)
  }

  return (
    <section className="card card--wide" data-testid="claude-setup">
      <h2 className="card__title">Enlace con Claude Code</h2>

      {error && (
        <p className="alert" role="alert" data-testid="hook-error">
          {error}
        </p>
      )}

      {status?.installed ? (
        <>
          {status.needsUpdate ? (
            <div className="banner banner--warm" data-testid="hook-outdated">
              <span>
                <strong>Hay una versión nueva del enlace.</strong> La que tienes instalada es
                anterior y puede traducir mal los estados. Actualízala para que la Torre refleje lo
                que de verdad hace Claude Code.
              </span>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                data-testid="hook-update"
                onClick={() => void install()}
              >
                Actualizar ahora
              </button>
            </div>
          ) : (
            <p className="card__text">
              <strong data-testid="hook-installed">Instalado y al día.</strong> Cuando Claude Code
              pida permiso, termine o te reclame, esta Torre se entera y te avisa.
            </p>
          )}
          <pre className="codeblock mono">{status.settingsPath}</pre>
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              data-testid="hook-uninstall"
              onClick={() => void uninstall()}
            >
              Desinstalar el enlace
            </button>
          </div>
          <p className="card__text card__text--muted">
            Al desinstalar se quitan solo las entradas de esta aplicación. Cualquier otro
            automatismo tuyo se queda intacto, y se guarda otra copia de seguridad antes de tocar
            nada.
          </p>
        </>
      ) : (
        <>
          <p className="card__text">
            <strong data-testid="hook-not-installed">No está instalado.</strong> Hoy Claude Code no
            avisa a la Torre de nada.
          </p>

          {!preview ? (
            <>
              <p className="card__text card__text--muted">
                Instalarlo modifica un fichero de configuración tuyo que afecta a{' '}
                <strong>todas</strong> tus sesiones de Claude Code, no solo a este proyecto. Antes
                de tocar nada se te enseña el cambio exacto.
              </p>
              <div className="card__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="hook-preview"
                  onClick={() => void showPreview()}
                >
                  Ver el cambio exacto
                </button>
              </div>
            </>
          ) : (
            <div className="hookdiff" data-testid="hook-diff">
              <p className="card__text">Esto es lo que se hará, y nada más:</p>
              <ul className="hookdiff__summary">
                {preview.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              <div className="hookdiff__panes">
                <div>
                  <span className="overline">Ahora</span>
                  <pre className="codeblock mono codeblock--scroll" data-testid="hook-before">
                    {preview.before.trim() === '{}' || preview.before.trim() === ''
                      ? '(el fichero todavía no existe)'
                      : preview.before}
                  </pre>
                </div>
                <div>
                  <span className="overline">Después</span>
                  <pre className="codeblock mono codeblock--scroll" data-testid="hook-after">
                    {preview.after}
                  </pre>
                </div>
              </div>

              <p className="card__text card__text--muted">
                Copia de seguridad en <span className="mono">{preview.backupPath}</span>. Se guarda
                antes de escribir, siempre.
              </p>

              <div className="card__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  data-testid="hook-install"
                  onClick={() => void install()}
                >
                  Entiendo el cambio, instalar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
