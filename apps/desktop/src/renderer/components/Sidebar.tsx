import type { DevInfo } from '@torre/contracts'
import { PROVIDER_COLORS } from '@torre/domain'
import { formatBytes } from '../utils/format.js'

export type Section = 'tower' | 'attention' | 'tasks' | 'history' | 'settings'

interface NavItem {
  key: Section
  glyph: string
  label: string
}

const NAV: readonly NavItem[] = [
  { key: 'tower', glyph: '◍', label: 'Torre de control' },
  { key: 'attention', glyph: '◆', label: 'Centro de atención' },
  { key: 'tasks', glyph: '≡', label: 'Tareas' },
  { key: 'history', glyph: '▤', label: 'Historial' },
  { key: 'settings', glyph: '⚙', label: 'Ajustes' },
]

interface SidebarProps {
  section: Section
  onNavigate: (section: Section) => void
  onNew: () => void
  attentionCount: number
  devInfo: DevInfo | null
}

/**
 * Barra lateral: los cinco destinos de la aplicación.
 *
 * Profundidad máxima 2. La ficha y el alta rápida son capas sobre lo que estés
 * mirando, no destinos: nunca pierdes el contexto de dónde estabas.
 */
export function Sidebar({ section, onNavigate, onNew, attentionCount, devInfo }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Secciones">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true">
          ◍
        </span>
        <span className="sidebar__name">Torre de Control</span>
        <span className="tag tag--mono" title="Todo ocurre en este ordenador">
          local
        </span>
      </div>

      <button type="button" className="btn btn--primary btn--block" data-testid="new-task" onClick={onNew}>
        <span>＋ Nueva tarea</span>
        <span className="mono sidebar__shortcut">⌘N</span>
      </button>

      <ul className="sidebar__nav">
        {NAV.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="sidebar__link"
              data-active={section === item.key}
              data-testid={`nav-${item.key}`}
              aria-current={section === item.key ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sidebar__glyph" aria-hidden="true">
                {item.glyph}
              </span>
              <span className="sidebar__label">{item.label}</span>
              {item.key === 'attention' && attentionCount > 0 && (
                <span className="sidebar__badge mono" data-testid="attention-badge">
                  {attentionCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar__spacer" />

      <div className="sidebar__foot">
        <div className="overline">Integraciones</div>
        {/*
          Estado REAL de cada integración. Ninguna existe todavía y la pantalla
          lo dice: enseñar «instalado» aquí sería la mentira más cara del
          producto.
        */}
        {(devInfo?.integrations ?? []).map((integration, index) => (
          <div className="integration" key={`${integration.provider}-${index}`}>
            <span
              className="integration__dot"
              style={{ borderColor: PROVIDER_COLORS[integration.provider] }}
              aria-hidden="true"
            />
            <span className="integration__label">{integration.label}</span>
            <span className="integration__state">Próximamente</span>
          </div>
        ))}

        <div className="integration">
          <span
            className="integration__dot"
            data-on={devInfo?.eventServer.listening === true}
            aria-hidden="true"
          />
          <span className="integration__label">Receptor local</span>
          <span className="integration__state">
            {devInfo?.eventServer.listening ? `:${devInfo.eventServer.port}` : 'parado'}
          </span>
        </div>

        {devInfo && (
          <div className="sidebar__path mono">
            {devInfo.dataDirectory}
            <br />
            torre.db · {formatBytes(devInfo.databaseBytes)}
          </div>
        )}
      </div>
    </nav>
  )
}
