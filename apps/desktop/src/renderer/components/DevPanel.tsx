import { useEffect, useState } from 'react'
import type { DevInfo } from '@torre/contracts'
import { formatBytes } from '../utils/format.js'
import { CopyableCommand } from './CopyableCommand.js'

interface DevPanelProps {
  onClose: () => void
}

/**
 * Panel del receptor local: dónde escucha y cómo enviarle un evento de prueba.
 *
 * No envía el evento desde aquí a propósito. Enviarlo desde una terminal
 * recorre exactamente el mismo camino que recorrerá mañana un hook de Claude
 * Code, así que lo que se prueba es el mecanismo de verdad y no un atajo
 * interno que daría una falsa sensación de que funciona.
 */
export function DevPanel({ onClose }: DevPanelProps) {
  const [info, setInfo] = useState<DevInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    void window.torre.getDevInfo().then((result) => {
      if (result.ok) setInfo(result.data)
      else setError(result.error)
    })
  }, [])

  return (
    <div className="overlay overlay--right" role="dialog" aria-modal="true" aria-label="Receptor local de eventos">
      {/*
        Va en oscuro: se abre desde dentro de Ajustes, que es una ventana
        oscura, y una hoja color papel saliendo de ella se lee como un fallo.
      */}
      <aside className="detail detail--oscuro" data-testid="dev-panel">
        <header className="detail__head">
          <div className="detail__heading">
            <div className="detail__titles">
              <h2 className="detail__title">Receptor local de eventos</h2>
              <p className="detail__meta">
                <span className="platform">Es por aquí por donde llegarán las integraciones</span>
              </p>
            </div>
            <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </header>

        <div className="detail__body">
          {error && <p className="banner">{error}</p>}
          {!info && !error && <p className="card__empty">Cargando…</p>}

          {info && (
            <>
              <dl className="times">
                <div>
                  <dt>Estado</dt>
                  <dd data-testid="dev-listening">
                    {info.eventServer.listening ? 'Escuchando' : 'No disponible'}
                  </dd>
                </div>
                <div>
                  <dt>Dirección</dt>
                  <dd className="mono">
                    {info.eventServer.host}
                    {info.eventServer.port ? `:${info.eventServer.port}` : ''}
                  </dd>
                </div>
              </dl>

              <section className="facts">
                <div className="fact fact--wide">
                  <span className="overline">Base de datos</span>
                  <span className="fact__value mono fact__url">
                    {info.databasePath} · {formatBytes(info.databaseBytes)}
                  </span>
                </div>
                <div className="fact fact--wide">
                  <span className="overline">Fichero de conexión</span>
                  <span className="fact__value mono fact__url">{info.eventServer.tokenPath}</span>
                </div>
              </section>

              <p className="card__text">
                Solo acepta conexiones desde este mismo ordenador y exige una clave local. Ni otro
                equipo de tu red ni una página web pueden enviarle nada.
              </p>

              {info.eventServer.token && (
                <section className="dev-hint">
                  <div className="overline">Clave local</div>
                  <div className="command">
                    <code className="command__text">
                      {showToken ? info.eventServer.token : `${'•'.repeat(24)} (oculta)`}
                    </code>
                    <button
                      type="button"
                      className="btn btn--quiet"
                      onClick={() => setShowToken((value) => !value)}
                    >
                      {showToken ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <p className="dev-hint__text">
                    Se genera sola y vive únicamente en tu carpeta de usuario. Nunca se sube al
                    repositorio.
                  </p>
                </section>
              )}

              <section className="dev-hint">
                <div className="overline">Enviar un evento de prueba</div>
                <p className="dev-hint__text">
                  Desde una terminal abierta en la carpeta del proyecto (el script lee la dirección
                  y la clave por ti):
                </p>
                <CopyableCommand command={'pnpm evento <id-de-la-tarea> completed'} />
                <p className="dev-hint__text">
                  Copia el identificador desde la ficha de cualquier tarea. Estados admitidos:
                  queued, running, waiting_user, completed, failed, unknown.
                </p>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
