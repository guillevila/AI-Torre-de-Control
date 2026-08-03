import { useEffect, useState } from 'react'
import type { DevInfo } from '@torre/contracts'
import { CopyableCommand } from './CopyableCommand.js'

interface DevPanelProps {
  onClose: () => void
}

/**
 * Panel de desarrollo: enseña dónde escucha el receptor local y cómo enviarle
 * un evento de prueba.
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
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Panel de desarrollo">
      <aside className="panel panel--detail" data-testid="dev-panel">
        <header className="panel__head">
          <h2 className="panel__title">Receptor local de eventos</h2>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {error && <p className="alert">{error}</p>}
        {!info && !error && <p className="muted">Cargando…</p>}

        {info && (
          <>
            <dl className="datalist">
              <div>
                <dt>Estado</dt>
                <dd data-testid="dev-listening">
                  {info.eventServer.listening ? 'Escuchando' : 'No disponible'}
                </dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>
                  {info.eventServer.host}
                  {info.eventServer.port ? `:${info.eventServer.port}` : ''}
                </dd>
              </div>
              <div className="datalist__wide">
                <dt>Base de datos</dt>
                <dd className="datalist__url">{info.databasePath}</dd>
              </div>
              <div className="datalist__wide">
                <dt>Fichero de conexión</dt>
                <dd className="datalist__url">{info.eventServer.tokenPath}</dd>
              </div>
            </dl>

            <p className="dev-hint__text">
              Solo acepta conexiones desde este mismo ordenador y exige una clave local. Ni otro
              equipo de tu red ni una página web pueden enviarle nada.
            </p>

            {info.eventServer.token && (
              <section className="dev-hint">
                <h3 className="notes__title">Clave local</h3>
                <div className="command">
                  <code className="command__text">
                    {showToken
                      ? info.eventServer.token
                      : '•'.repeat(24) + ' (oculta)'}
                  </code>
                  <button
                    type="button"
                    className="btn btn--ghost btn--tiny"
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
              <h3 className="notes__title">Enviar un evento de prueba</h3>
              <p className="dev-hint__text">
                Desde una terminal abierta en la carpeta del proyecto (el script lee la dirección y
                la clave por ti):
              </p>
              <CopyableCommand command={'pnpm evento <id-de-la-tarea> completed'} />
              <p className="dev-hint__text">
                Copia el identificador desde la ficha de cualquier tarea. Estados admitidos:
                queued, running, waiting_user, completed, failed, unknown.
              </p>
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
