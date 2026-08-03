import type { RecentActivityEntry, Task, TaskStatus } from '@torre/contracts'
import {
  attentionQueue,
  PROVIDER_COLORS,
  STATUS_GLYPHS,
  STATUS_HINTS,
  STATUS_LABELS,
  summarise,
} from '@torre/domain'
import { StatusBadge, WorkPulse } from '../components/Indicators.js'
import { clockTime, elapsed, relativeTime } from '../utils/format.js'

interface TowerViewProps {
  tasks: Task[]
  activity: RecentActivityEntry[]
  onOpen: (task: Task) => void
  onGoAttention: () => void
  onGoOffice: () => void
}

/** Los cinco contadores de la cabecera, en el orden del diseño. */
const COUNTERS: readonly TaskStatus[] = ['running', 'waiting_user', 'completed', 'failed', 'unknown']

/** Los contadores hablan en plural; el resto de la interfaz, en singular. */
const COUNTER_LABELS: Partial<Record<TaskStatus, string>> = {
  running: 'Trabajando',
  waiting_user: 'Te esperan',
  completed: 'Terminadas',
  failed: 'Con error',
  unknown: 'Sin confirmar',
}

/**
 * Torre de control: la pantalla de arranque.
 *
 * Reparto de superficie deliberado: a la izquierda y más grande, lo que te
 * reclama; a la derecha, lo que solo informa. En menos de diez segundos y sin
 * leer una frase completa: cuántos trabajan, cuántos te reclaman, qué ha
 * terminado y qué no se puede confirmar.
 */
export function TowerView({ tasks, activity, onOpen, onGoAttention, onGoOffice }: TowerViewProps) {
  const summary = summarise(tasks)
  const attention = attentionQueue(tasks)
  const running = tasks
    .filter((task) => task.status === 'running')
    .sort((a, b) => a.startedAt?.localeCompare(b.startedAt ?? '') ?? 0)

  const counts: Record<TaskStatus, number> = {
    running: summary.running,
    waiting_user: summary.waiting,
    completed: summary.completed,
    failed: summary.failed,
    unknown: summary.unknown,
    queued: summary.queued,
    draft: summary.draft,
    archived: 0,
  }

  return (
    <div className="tower" data-testid="tower-view">
      <div className="counters" data-testid="counters">
        {COUNTERS.map((status) => (
          <article className="counter" data-status={status} key={status} data-testid={`counter-${status}`}>
            <div className="counter__top">
              <span className="counter__value">{counts[status]}</span>
              <span className="counter__glyph" aria-hidden="true">
                {STATUS_GLYPHS[status]}
              </span>
            </div>
            <div className="counter__label">{COUNTER_LABELS[status] ?? STATUS_LABELS[status]}</div>
            <div className="counter__hint">{STATUS_HINTS[status]}</div>
          </article>
        ))}
      </div>

      <div className="tower__grid">
        <section className="attention-panel" aria-label="Requiere tu atención">
          <header className="attention-panel__head">
            <div>
              <h2 className="attention-panel__title">Requiere tu atención</h2>
              <p className="attention-panel__sub">
                {attention.length === 0
                  ? 'Nada espera una decisión tuya'
                  : `${attention.length} ${attention.length === 1 ? 'tarea espera' : 'tareas esperan'} una decisión tuya`}
              </p>
            </div>
            {attention.length > 0 && (
              <button type="button" className="btn btn--warm" onClick={onGoAttention}>
                Ver el centro de atención →
              </button>
            )}
          </header>

          {attention.length === 0 ? (
            <div className="calm" data-testid="tower-calm">
              <p className="calm__title">Nada te espera</p>
              <p className="calm__text">
                {summary.running > 0
                  ? `${summary.running} ${summary.running === 1 ? 'tarea trabaja' : 'tareas trabajan'} por su cuenta. Te aviso cuando alguna necesite algo.`
                  : 'No hay nada en marcha ahora mismo.'}
              </p>
            </div>
          ) : (
            <ul className="mini-list">
              {attention.map((task) => (
                <li key={task.id}>
                  <button type="button" className="mini" onClick={() => onOpen(task)} data-status={task.status}>
                    <StatusBadge status={task.status} />
                    <span className="mini__main">
                      <span className="mini__title">{task.title}</span>
                      <span className="mini__meta">
                        <span
                          className="platform__dot"
                          style={{ background: PROVIDER_COLORS[task.provider] }}
                          aria-hidden="true"
                        />
                        {relativeTime(task.lastActivityAt)}
                      </span>
                    </span>
                    <span className="mini__chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="tower__side">
          <section className="card">
            <header className="card__head">
              <h2 className="card__title">Trabajando ahora</h2>
              <button type="button" className="btn btn--quiet" onClick={onGoOffice}>
                Ver la oficina
              </button>
            </header>
            {running.length === 0 ? (
              <p className="card__empty">Ninguna tarea en marcha.</p>
            ) : (
              <ul className="running-list">
                {running.map((task) => (
                  <li key={task.id}>
                    <button type="button" className="running-row" onClick={() => onOpen(task)}>
                      <WorkPulse />
                      <span className="running-row__title">{task.title}</span>
                      <span className="mono running-row__time">
                        {elapsed(task.startedAt, null)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card card--grow">
            <h2 className="card__title">Actividad reciente</h2>
            {activity.length === 0 ? (
              <p className="card__empty">
                Todavía no ha pasado nada. Aquí irán apareciendo los cambios de estado.
              </p>
            ) : (
              <ol className="activity" data-testid="activity">
                {activity.map((entry) => (
                  <li className="activity__item" key={entry.id} data-status={entry.toStatus}>
                    <span className="activity__time mono">{clockTime(entry.at)}</span>
                    <span className="activity__track" aria-hidden="true">
                      <span className="activity__dot" />
                    </span>
                    <span className="activity__text">
                      {entry.taskTitle} → {STATUS_LABELS[entry.toStatus].toLowerCase()}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
