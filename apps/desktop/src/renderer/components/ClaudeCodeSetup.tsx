import { useCallback, useEffect, useState } from 'react'
import type { HookActivityEntry, HookPreview, HookStatus } from '@torre/contracts'
import { clockTime } from '../utils/format.js'

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
  const [activity, setActivity] = useState<HookActivityEntry[]>([])
  /**
   * Acabas de instalar o actualizar en esta misma visita.
   *
   * Se guarda para poder recordarte lo único que la aplicación NO puede hacer
   * por ti: reiniciar tus sesiones abiertas de Claude Code.
   */
  const [justInstalled, setJustInstalled] = useState(false)

  const refresh = useCallback(async () => {
    const result = await window.torre.hookStatus()
    if (result.ok) setStatus(result.data)
    else setError(result.error)
  }, [])

  const refreshActivity = useCallback(async () => {
    const result = await window.torre.hookActivity()
    if (result.ok) setActivity(result.data)
  }, [])

  useEffect(() => {
    void refresh()
    void refreshActivity()
    // Se refresca solo: mientras miras esta pantalla puedes lanzar algo en
    // Claude Code y ver aparecer la señal aquí.
    const timer = setInterval(() => void refreshActivity(), 3_000)
    return () => clearInterval(timer)
  }, [refresh, refreshActivity])

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
      setJustInstalled(true)
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

          {/*
            El paso que la aplicación no puede dar por ti, y el que más caro
            sale olvidar: Claude Code lee qué avisos tiene que mandar UNA sola
            vez, al abrir la sesión. Si acabas de instalar o actualizar, las
            sesiones que ya tenías abiertas siguen ciegas por mucho que aquí
            ponga «instalado» — y desde fuera parece que el enlace no funciona.
          */}
          {justInstalled && (
            <div className="banner banner--warm" data-testid="hook-restart">
              <span>
                <strong>Falta un paso, y solo puedes darlo tú: reinicia Claude Code.</strong> Los
                avisos se leen al abrir la sesión. Las que tengas abiertas ahora mismo seguirán sin
                avisar a la Torre aunque aquí ya ponga «instalado». Ciérralas y vuelve a abrirlas —
                también las de dentro de tu editor.
              </span>
            </div>
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

          {/*
            La ventana que evita diagnosticar a ciegas: aquí se ve si el enlace
            está hablando con la Torre, y qué se hace con cada señal.
          */}
          <div className="hook-activity" data-testid="hook-activity">
            <div className="overline">Señales recibidas del enlace</div>
            {activity.length === 0 ? (
              <p className="card__text card__text--muted">
                Todavía no ha llegado nada. Escribe algo en Claude Code dentro de un proyecto y
                debería aparecer aquí en segundos. Si no aparece, la causa casi siempre es la misma:{' '}
                <strong>esa sesión se abrió antes de instalar el enlace</strong>. Ciérrala y vuelve
                a abrirla. Si aun así sigue vacío, el enlace no está llegando a la Torre y el
                problema está antes de esta aplicación.
              </p>
            ) : (
              <ol className="hook-activity__list">
                {activity.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} data-ok={entry.accepted}>
                    <span className="mono hook-activity__time">{clockTime(entry.at)}</span>
                    <span className="hook-activity__event">{entry.event}</span>
                    <span className="hook-activity__detail">
                      {entry.taskTitle ? `${entry.taskTitle} — ` : ''}
                      {entry.detail}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
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
