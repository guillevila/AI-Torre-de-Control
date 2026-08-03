import type { StatusConfidence, StatusSource, TaskStatus } from '@torre/contracts'
import { CONFIDENCE_LABELS, SOURCE_LABELS, STATUS_LABELS } from '@torre/domain'

interface StatusPillProps {
  status: TaskStatus
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span className="pill" data-status={status} data-testid={`pill-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface ProvenanceProps {
  source: StatusSource
  confidence: StatusConfidence
}

/**
 * Procedencia del estado (D8 y D9).
 *
 * Se muestra SIEMPRE, no solo cuando hay dudas. El usuario tiene que poder
 * distinguir de un vistazo «esto lo marqué yo» de «esto lo dedujo una extensión
 * y podría estar equivocado», porque un estado incierto presentado como seguro
 * es peor que no tener estado.
 */
export function Provenance({ source, confidence }: ProvenanceProps) {
  return (
    <span className="provenance" data-confidence={confidence}>
      <span className="provenance__dot" aria-hidden="true" />
      {SOURCE_LABELS[source]} · {CONFIDENCE_LABELS[confidence]}
    </span>
  )
}
