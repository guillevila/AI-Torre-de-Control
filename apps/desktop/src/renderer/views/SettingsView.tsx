import type { DevInfo, Settings, SettingsPatch } from '@torre/contracts'
import { formatBytes } from '../utils/format.js'

interface SettingsViewProps {
  settings: Settings
  onUpdate: (patch: SettingsPatch) => void
  devInfo: DevInfo | null
  onOpenFolder: () => void
  onExportCsv: () => void
}

/**
 * Ajustes.
 *
 * Regla que gobierna esta pantalla: **si un control aparece aquí, hace algo de
 * verdad**. Lo que todavía no existe se dice con todas las letras en lugar de
 * dibujar un interruptor que no está conectado a nada.
 *
 * Por eso faltan cosas que el diseño original contemplaba —sonido, contador en
 * el icono, tamaño de texto, ventana interna, caducidad del historial—: no
 * están construidas, así que no se fingen.
 */
export function SettingsView({
  settings,
  onUpdate,
  devInfo,
  onOpenFolder,
  onExportCsv,
}: SettingsViewProps) {
  return (
    <div className="settings" data-testid="settings-view">
      <section className="card">
        <h2 className="card__title">Notificaciones</h2>
        <div className="switches">
          <Toggle
            label="Cuando una tarea te espera"
            hint="Notificación del sistema"
            checked={settings.notifyWaitingUser}
            testId="toggle-waiting"
            onChange={(value) => onUpdate({ notifyWaitingUser: value })}
          />
          <Toggle
            label="Cuando una tarea termina"
            hint="Notificación del sistema"
            checked={settings.notifyCompleted}
            testId="toggle-completed"
            onChange={(value) => onUpdate({ notifyCompleted: value })}
          />
          <Toggle
            label="Cuando una tarea falla"
            hint="Notificación del sistema"
            checked={settings.notifyFailed}
            testId="toggle-failed"
            onChange={(value) => onUpdate({ notifyFailed: value })}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Pérdida de contacto</h2>
        <p className="card__text">
          Una tarea automática que lleva demasiado tiempo sin dar señales pasa a{' '}
          <strong>sin confirmar</strong> en vez de fingir que sigue viva. Lo que fijas tú a mano no
          caduca nunca.
        </p>
        <label className="field">
          <span className="field__label">Marcar como «sin confirmar» tras</span>
          <select
            className="input"
            value={String(settings.staleAfterMinutes)}
            data-testid="stale-minutes"
            onChange={(event) => onUpdate({ staleAfterMinutes: Number(event.target.value) })}
          >
            <option value="0">Nunca</option>
            <option value="15">15 minutos sin señal</option>
            <option value="30">30 minutos sin señal</option>
            <option value="60">1 hora sin señal</option>
            <option value="180">3 horas sin señal</option>
            <option value="480">8 horas sin señal</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">Al arrancar</h2>
        <div className="field">
          <span className="field__label">Sección inicial</span>
          <div className="segmented segmented--inline">
            {(
              [
                ['tower', 'Torre'],
                ['attention', 'Atención'],
                ['tasks', 'Tareas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-active={settings.startSection === value}
                onClick={() => onUpdate({ startSection: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Forma de ver las tareas</span>
          <div className="segmented segmented--inline">
            <button
              type="button"
              data-active={settings.startView === 'operations'}
              onClick={() => onUpdate({ startView: 'operations' })}
            >
              Operativa
            </button>
            <button
              type="button"
              data-active={settings.startView === 'office'}
              data-testid="start-office"
              onClick={() => onUpdate({ startView: 'office' })}
            >
              Oficina
            </button>
          </div>
        </div>
        <p className="card__text card__text--muted">
          Las animaciones siguen la preferencia de tu sistema operativo. Si tienes activado «reducir
          movimiento», la aplicación aplica los cambios de posición al instante y ninguna
          información depende del movimiento.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">Integraciones</h2>
        <p className="card__text">
          <strong>Ninguna está instalada todavía.</strong> Hoy los estados se fijan a mano o
          llegando un evento al receptor local. El canal por el que llegarán las integraciones ya
          está construido y probado; falta escribir quien los envíe.
        </p>
        <ul className="integration-list">
          {(devInfo?.integrations ?? []).map((integration, index) => (
            <li key={`${integration.provider}-${index}`}>
              <span>{integration.label}</span>
              <span className="tag">Próximamente</span>
            </li>
          ))}
        </ul>
        <p className="card__text card__text--muted">
          Cuando llegue el momento, instalar el hook de Claude Code modificará un archivo de
          configuración tuyo. Se te enseñará el cambio exacto y se guardará una copia antes de tocar
          nada.
        </p>
      </section>

      <section className="card card--wide">
        <h2 className="card__title">Privacidad y datos</h2>
        <p className="card__text">
          Todo vive en tu ordenador. La aplicación guarda <strong>títulos, estados, tiempos y
          enlaces</strong>. No guarda prompts, ni respuestas, ni el contenido de ninguna
          conversación, y no usa APIs de modelos de pago. El receptor de eventos escucha únicamente
          en <span className="mono">127.0.0.1</span> y exige una clave local.
        </p>
        {devInfo && (
          <pre className="codeblock mono">
            {devInfo.dataDirectory}
            {'\n'}torre.db · {formatBytes(devInfo.databaseBytes)}
          </pre>
        )}
        <div className="card__actions">
          <button type="button" className="btn btn--ghost" data-testid="open-folder" onClick={onOpenFolder}>
            Abrir la carpeta
          </button>
          <button type="button" className="btn btn--ghost" data-testid="export-csv" onClick={onExportCsv}>
            Exportar en CSV
          </button>
        </div>
        <p className="card__text card__text--muted">
          No hay copia de seguridad automática. Exportar en CSV o copiar el fichero{' '}
          <span className="mono">torre.db</span> son hoy las dos formas de no perder el histórico.
        </p>
      </section>
    </div>
  )
}

interface ToggleProps {
  label: string
  hint: string
  checked: boolean
  testId: string
  onChange: (value: boolean) => void
}

function Toggle({ label, hint, checked, testId, onChange }: ToggleProps) {
  return (
    // El identificador va en la etiqueta además de en el campo: el campo está
    // oculto a la vista (lo sustituye el interruptor dibujado), así que es la
    // etiqueta lo que se puede pulsar.
    <label className="switch" data-testid={`switch-${testId}`}>
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        <span className="switch__hint">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </label>
  )
}
