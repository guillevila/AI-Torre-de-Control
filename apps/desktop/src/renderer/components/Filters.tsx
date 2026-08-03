import { PROVIDERS, type Provider } from '@torre/contracts'
import {
  GROUP_LABELS,
  GROUP_ORDER,
  PROVIDER_LABELS,
  type TaskFilters,
  type TaskGroupKey,
} from '@torre/domain'

interface FiltersProps {
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
}

export function Filters({ filters, onChange }: FiltersProps) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="filters" data-testid="filters">
      <input
        className="input input--search"
        type="search"
        value={filters.search}
        placeholder="Buscar por título…"
        onChange={(event) => set({ search: event.target.value })}
        data-testid="filter-search"
      />

      <select
        className="select"
        value={filters.provider}
        onChange={(event) => set({ provider: event.target.value as Provider | 'all' })}
        data-testid="filter-provider"
      >
        <option value="all">Todas las herramientas</option>
        {PROVIDERS.map((provider) => (
          <option key={provider} value={provider}>
            {PROVIDER_LABELS[provider]}
          </option>
        ))}
      </select>

      <select
        className="select"
        value={filters.group}
        onChange={(event) => set({ group: event.target.value as TaskGroupKey | 'all' })}
        data-testid="filter-group"
      >
        <option value="all">Todos los grupos</option>
        {GROUP_ORDER.map((group) => (
          <option key={group} value={group}>
            {GROUP_LABELS[group]}
          </option>
        ))}
      </select>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={filters.showArchived}
          onChange={(event) => set({ showArchived: event.target.checked })}
          data-testid="filter-archived"
        />
        Ver archivadas
      </label>
    </div>
  )
}
