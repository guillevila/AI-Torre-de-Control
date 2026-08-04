import type { Provider, StatusConfidence, StatusSource, TaskStatus } from '@torre/contracts'
import {
  CONFIDENCE_LABELS,
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  SOURCE_DESCRIPTIONS,
  SOURCE_GLYPHS,
  SOURCE_LABELS,
  STATUS_GLYPHS,
  STATUS_LABELS,
} from '@torre/domain'

/**
 * Indicadores de estado, procedencia y plataforma.
 *
 * Todos comparten la misma regla: el color nunca va solo. Cada uno lleva glifo
 * o texto, de modo que quitando el color la pantalla siga siendo legible.
 */

// ─── Estado ──────────────────────────────────────────────────────────────────

/** Cuadrado con el glifo del estado. Va al principio de cada fila. */
export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className="badge"
      data-status={status}
      data-testid={`badge-${status}`}
      title={STATUS_LABELS[status]}
      aria-label={STATUS_LABELS[status]}
    >
      {STATUS_GLYPHS[status]}
    </span>
  )
}

/** Etiqueta completa: glifo + palabra. */
export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className="pill" data-status={status} data-testid={`pill-${status}`}>
      <span aria-hidden="true">{STATUS_GLYPHS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Confianza ───────────────────────────────────────────────────────────────

const FILLED: Record<StatusConfidence, number> = { high: 3, medium: 2, low: 1 }

/**
 * Tres barras + palabra, nunca solo color.
 *
 * Es el indicador más importante de la pantalla después del propio estado:
 * distingue lo que la aplicación sabe de lo que solo supone (D8).
 */
export function ConfidenceBars({
  confidence,
  showLabel = true,
}: {
  confidence: StatusConfidence
  showLabel?: boolean
}) {
  const filled = FILLED[confidence]
  return (
    <span
      className="confidence"
      data-confidence={confidence}
      data-testid={`confidence-${confidence}`}
      title={`Confianza ${CONFIDENCE_LABELS[confidence]}`}
    >
      <span className="confidence__bars" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className="confidence__bar" data-on={index < filled} />
        ))}
      </span>
      {showLabel && <span className="confidence__label">{CONFIDENCE_LABELS[confidence]}</span>}
    </span>
  )
}

// ─── Plataforma ──────────────────────────────────────────────────────────────

export function PlatformChip({ provider }: { provider: Provider }) {
  return (
    <span className="platform" data-testid={`platform-${provider}`}>
      <span
        className="platform__dot"
        style={{ background: PROVIDER_COLORS[provider] }}
        aria-hidden="true"
      />
      {PROVIDER_LABELS[provider]}
    </span>
  )
}

// ─── Fuente del estado ───────────────────────────────────────────────────────

export function SourceLabel({ source }: { source: StatusSource }) {
  return (
    <span className="source" title={SOURCE_DESCRIPTIONS[source]}>
      <span className="source__glyph" aria-hidden="true">
        {SOURCE_GLYPHS[source]}
      </span>
      {SOURCE_LABELS[source]}
    </span>
  )
}

// ─── Señal de trabajo ────────────────────────────────────────────────────────

/**
 * Las tres barras que laten mientras algo trabaja.
 *
 * Con `frozen` se quedan quietas: es lo que se usa en «sin confirmar», porque
 * la quietud es información (D9). Preferimos un hueco visible a una animación
 * que miente.
 */
export function WorkPulse({ frozen = false }: { frozen?: boolean }) {
  return (
    <span className="pulse" data-frozen={frozen} aria-hidden="true">
      <span className="pulse__bar" />
      <span className="pulse__bar" />
      <span className="pulse__bar" />
    </span>
  )
}
