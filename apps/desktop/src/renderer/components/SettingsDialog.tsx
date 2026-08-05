import { useEffect, useRef } from 'react'
import type { DevInfo, Settings, SettingsPatch } from '@torre/contracts'
import { SettingsView } from '../views/SettingsView.js'

interface SettingsDialogProps {
  settings: Settings
  onUpdate: (patch: SettingsPatch) => void
  devInfo: DevInfo | null
  onOpenFolder: () => void
  onExportCsv: () => void
  onOpenDevPanel: () => void
  onClose: () => void
}

/**
 * Ajustes, en una ventana flotante.
 *
 * Antes eran una sección más: pulsabas Ajustes y la aplicación te sacaba de
 * donde estabas. Desde la fábrica eso era especialmente malo —la nave ocupa la
 * pantalla entera, así que tocar un interruptor te obligaba a abandonarla y
 * volver—. Y encima el panel de opciones dejaba fuera el receptor local de
 * eventos, que colgaba aparte: había que saber que existía.
 *
 * Ahora es una sola superficie flotante con TODAS las opciones dentro,
 * incluido el receptor. Se abre encima de lo que estuvieras mirando y se
 * cierra dejándote justo ahí.
 *
 * Es el mismo `SettingsView` de siempre, no una copia: si mañana se añade un
 * ajuste, aparece aquí sin tocar nada. Lo único que cambia es el marco.
 */
export function SettingsDialog({
  settings,
  onUpdate,
  devInfo,
  onOpenFolder,
  onExportCsv,
  onOpenDevPanel,
  onClose,
}: SettingsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // El foco entra en la ventana al abrirse. Sin esto, quien navega con teclado
  // seguiría pulsando cosas de debajo sin verlas.
  useEffect(() => closeRef.current?.focus(), [])

  return (
    <div
      className="setdlg-overlay"
      data-testid="settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes"
      // Pulsar fuera cierra; pulsar dentro no. Se compara el objetivo con el
      // propio fondo, así que un clic que empieza dentro y termina fuera
      // —arrastrando para seleccionar texto— no cierra por accidente.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="setdlg">
        <header className="setdlg__head">
          <span className="setdlg__glyph" aria-hidden="true">
            ⚙
          </span>
          <div className="setdlg__titles">
            <h2 className="setdlg__title">Ajustes</h2>
            <p className="setdlg__sub">Avisos, integraciones, datos y privacidad</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="setdlg__close"
            data-testid="settings-close"
            aria-label="Cerrar ajustes"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="setdlg__body">
          <SettingsView
            settings={settings}
            onUpdate={onUpdate}
            devInfo={devInfo}
            onOpenFolder={onOpenFolder}
            onExportCsv={onExportCsv}
          />
        </div>

        <footer className="setdlg__foot">
          <p className="setdlg__note">
            Los cambios se guardan solos, según los tocas. No hay botón de guardar.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="open-dev-panel"
            onClick={onOpenDevPanel}
          >
            Ver el receptor local de eventos
          </button>
        </footer>
      </div>
    </div>
  )
}
