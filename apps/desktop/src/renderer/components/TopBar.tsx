import { forwardRef } from 'react'

export type ViewMode = 'operations' | 'office'

interface TopBarProps {
  title: string
  subtitle: string
  /** El conmutador solo aparece donde hay dos lecturas del mismo dato. */
  showSwitch: boolean
  view: ViewMode
  onView: (view: ViewMode) => void
  search: string
  onSearch: (value: string) => void
}

/**
 * Cabecera de la zona de contenido.
 *
 * El conmutador Operativa ⇄ Oficina es transversal: conserva la selección al
 * cambiar de lado, porque los dos lados son el mismo dato leído distinto.
 */
export const TopBar = forwardRef<HTMLInputElement, TopBarProps>(function TopBar(
  { title, subtitle, showSwitch, view, onView, search, onSearch },
  searchRef,
) {
  return (
    <header className="topbar">
      <div className="topbar__titles">
        <h1 className="topbar__title">{title}</h1>
        <p className="topbar__subtitle">{subtitle}</p>
      </div>

      {showSwitch && (
        <div className="segmented" role="tablist" aria-label="Forma de ver las tareas">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'operations'}
            data-active={view === 'operations'}
            data-testid="view-operations"
            onClick={() => onView('operations')}
          >
            Operativa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'office'}
            data-active={view === 'office'}
            data-testid="view-office"
            onClick={() => onView('office')}
          >
            Oficina
          </button>
        </div>
      )}

      <div className="search">
        <span className="search__glyph" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={searchRef}
          type="search"
          value={search}
          placeholder="Buscar tarea o plataforma"
          aria-label="Buscar tarea o plataforma"
          data-testid="search"
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
    </header>
  )
})
