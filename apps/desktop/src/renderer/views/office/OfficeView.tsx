import type { RecentActivityEntry, Task } from '@torre/contracts'
import {
  attentionQueue,
  factoryFloor,
  FACTORY_CAPACITY,
  PROVIDER_ROBOT,
  STATUS_LABELS,
  summarise,
} from '@torre/domain'
import { Worker } from './Worker.js'

interface OfficeViewProps {
  tasks: Task[]
  /** Cambios de estado recientes. Alimentan el pulso de la consola. */
  activity: RecentActivityEntry[]
  onSelect: (task: Task) => void
  /**
   * Las dos únicas salidas de la fábrica, porque aquí no hay barra lateral.
   *
   * La rueda lleva a Ajustes; la consola de mando, al detalle de todo. Van
   * dentro de la propia planta a propósito: una sala de control no tiene menús
   * alrededor.
   */
  onOpenSettings: () => void
  onOpenTower: () => void
}

/**
 * Vista Oficina — la fábrica.
 *
 * Implementa el documento de diseño «Oficina Fábrica»: una nave oscura de sala
 * de control, con tres zonas y un robot por tarea.
 *
 *   ZONA DE TRABAJO → lo que sigue vivo: trabajando, esperándote, con error,
 *                     en cola. El robot se mueve solo si trabaja de verdad.
 *   ENTREGAS        → terminadas, esperando que las revises.
 *   BACKLOG         → revisadas. Duermen, pero no se han ido.
 *
 * Sigue siendo **una proyección de los mismos datos** que la lista (D10, D11):
 * no tiene estado propio ni lógica propia. El reparto por naves lo decide
 * `factoryFloor` en el dominio, así que las dos pantallas no pueden discrepar.
 *
 * ── Dos cosas del diseño que aquí se dicen distinto, a propósito ────────────
 *
 * El diseño ponía bajo cada robot una frase del tipo «Analizando requisitos», y
 * en la consola un medidor de «PRODUCTIVIDAD 80%».
 *
 * Lo primero exigiría saber qué está haciendo la herramienta por dentro, y esta
 * aplicación no lee conversaciones. Lo segundo era un número inventado.
 *
 * En su lugar va lo que sí sabemos: el nombre del proyecto, y un porcentaje que
 * se calcula de verdad. Un dato inventado en una pantalla de control es peor
 * que un hueco vacío: se cree.
 */
export function OfficeView({
  tasks,
  activity,
  onSelect,
  onOpenSettings,
  onOpenTower,
}: OfficeViewProps) {
  const planta = factoryFloor(tasks)
  const resumen = summarise(tasks)
  const atencion = attentionQueue(tasks)
  const pendiente = atencion[0]

  const enNave = (lista: Task[], proveedor: 'anthropic' | 'openai') =>
    lista.filter((t) =>
      proveedor === 'anthropic'
        ? t.provider === 'claude_code' || t.provider === 'claude_web' || t.provider === 'cowork'
        : t.provider === 'chatgpt' || t.provider === 'codex',
    ).length

  return (
    <div className="factory" data-testid="office-view">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <header className="factory__top">
        <div className="fpanel factory__brand">
          <span className="brandbot" aria-hidden="true">
            <span className="brandbot__visor" />
            <span className="brandbot__screen" />
            <span className="brandbot__eye brandbot__eye--l" />
            <span className="brandbot__eye brandbot__eye--r" />
            <span className="brandbot__antenna" />
            <span className="brandbot__bulb" />
          </span>
          <span className="factory__brand-text">
            <span className="factory__brand-name">TORRE DE CONTROL</span>
            <span className="factory__brand-sub">Supervisa. Decide. Impulsa.</span>
          </span>
        </div>

        <div className="fpanel factory__counters">
          <span className="factory__working">
            TRABAJANDO{' '}
            <span className="mono">
              {resumen.running} / {FACTORY_CAPACITY.work}
            </span>
          </span>
          <Marca color={PROVIDER_ROBOT.claude_code.dot} nombre="Claude" />
          <Marca color={PROVIDER_ROBOT.chatgpt.dot} nombre="ChatGPT" />
          <Marca color={PROVIDER_ROBOT.codex.dot} nombre="Codex" />
        </div>

        <div className="fpanel factory__delivery-head">
          <span className="crate" aria-hidden="true">
            <span className="crate__box" />
            <span className="crate__lid" />
            <span className="crate__tape" />
          </span>
          <span className="factory__delivery-text">
            <span className="factory__delivery-name">ENTREGAS</span>
            <span className="factory__delivery-sub">Listo para revisión</span>
          </span>
          <span className="mono factory__delivery-count">
            {resumen.completed} / {FACTORY_CAPACITY.delivery}
          </span>
          {planta.hidden.delivery > 0 && (
            <span className="fbadge fbadge--warm">+{planta.hidden.delivery} fuera de vista</span>
          )}
          <span className="factory__delivery-check">✓</span>
        </div>

        {/* La rueda: la única salida a los ajustes desde aquí. */}
        <button
          type="button"
          className="fpanel factory__gear"
          onClick={onOpenSettings}
          title="Ajustes"
          aria-label="Abrir los ajustes"
          data-testid="factory-settings"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      {/* ── Naves ────────────────────────────────────────────────────────── */}
      <div className="factory__floor">
        <div className="factory__left">
          <section className="fzone fzone--work">
            <div className="fzone__head">
              <span className="fzone__glyph fzone__glyph--work">✳</span>
              <span>
                <span className="fzone__title">ZONA DE TRABAJO</span>
                <span className="fzone__sub">Donde ocurre la magia</span>
              </span>
              {planta.hidden.work > 0 && (
                <span className="fbadge fbadge--warm">+{planta.hidden.work} fuera de vista</span>
              )}
            </div>

            <div className="fgrid fgrid--work">
              {planta.work.map((task, i) => (
                <Worker key={task.id} task={task} bay="work" slot={i} onSelect={onSelect} />
              ))}
            </div>

            {planta.work.length === 0 && (
              <p className="factory__empty" data-testid="office-empty">
                La nave está parada. Cuando delegues una tarea aparecerá aquí un robot
                trabajando en ella.
              </p>
            )}
          </section>

          <Consola
            resumen={resumen}
            activity={activity}
            anthropic={enNave(planta.work, 'anthropic')}
            openai={enNave(planta.work, 'openai')}
            pendiente={pendiente}
            onSelect={onSelect}
            onOpenTower={onOpenTower}
          />
        </div>

        <div className="factory__right">
          <section className="fzone fzone--delivery">
            <div className="fgrid fgrid--delivery">
              {planta.delivery.map((task, i) => (
                <Worker key={task.id} task={task} bay="delivery" slot={i} onSelect={onSelect} />
              ))}
            </div>
            {planta.delivery.length === 0 && (
              <p className="factory__empty factory__empty--small">
                Nada en la mesa de entregas.
              </p>
            )}
          </section>

          <div className="fpanel factory__backlog-head">
            <span className="moon" aria-hidden="true">
              <span className="moon__shape" />
            </span>
            <span className="factory__backlog-text">
              <span className="factory__backlog-name">
                BACKLOG <span className="factory__backlog-mode">(MODO DESCANSO)</span>
              </span>
              <span className="factory__backlog-sub">Recargando energías…</span>
            </span>
            <span className="mono factory__backlog-count">
              {resumen.reviewed} / {FACTORY_CAPACITY.backlog}
            </span>
            {planta.hidden.backlog > 0 && (
              <span className="fbadge fbadge--cool">+{planta.hidden.backlog} fuera de vista</span>
            )}
            <span className="mono factory__zzz">
              z<span>z</span>
            </span>
          </div>

          <section className="fzone fzone--backlog">
            <div className="fgrid fgrid--backlog">
              {planta.backlog.map((task, i) => (
                <Worker key={task.id} task={task} bay="backlog" slot={i} onSelect={onSelect} />
              ))}
            </div>
            {planta.backlog.length === 0 && (
              <p className="factory__empty factory__empty--small">
                Nadie descansando: nada revisado todavía.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ── Leyenda ──────────────────────────────────────────────────────── */}
      <footer className="fpanel factory__legend">
        <Marca color={PROVIDER_ROBOT.claude_code.dot} nombre="Claude" />
        <Marca color={PROVIDER_ROBOT.chatgpt.dot} nombre="ChatGPT" />
        <Marca color={PROVIDER_ROBOT.codex.dot} nombre="Codex" />
        <span className="factory__legend-sep" />
        <span className="flegend"><span className="flegend__ring" />{STATUS_LABELS.queued}</span>
        <span className="flegend"><span className="flegend__ico flegend__ico--run">✳</span>{STATUS_LABELS.running}</span>
        <span className="flegend"><span className="flegend__ico flegend__ico--wait">⧗</span>{STATUS_LABELS.waiting_user}</span>
        <span className="flegend"><span className="flegend__check">✓</span>{STATUS_LABELS.completed}</span>
        <span className="flegend"><span className="flegend__ico flegend__ico--fail">⚠</span>{STATUS_LABELS.failed} / {STATUS_LABELS.unknown}</span>
        <span className="flegend"><span className="flegend__box">✓</span>{STATUS_LABELS.reviewed}</span>
      </footer>
    </div>
  )
}

function Marca({ color, nombre }: { color: string; nombre: string }) {
  return (
    <span className="fmark">
      <span className="fmark__dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {nombre}
    </span>
  )
}

/* ── La consola de mando ─────────────────────────────────────────────────── */

interface ConsolaProps {
  resumen: ReturnType<typeof summarise>
  activity: RecentActivityEntry[]
  anthropic: number
  openai: number
  pendiente: Task | undefined
  onSelect: (task: Task) => void
  onOpenTower: () => void
}

/** Cuántos tramos tiene el pulso, y cuánto abarca cada uno. */
const TRAMOS = 12
const TRAMO_MS = 30 * 60 * 1000

/**
 * El pulso de la fábrica: cuántos cambios de estado ha habido por tramo.
 *
 * Sale del historial real. El diseño traía una línea decorativa con puntos
 * inventados; esto cuenta lo que de verdad ha pasado en las últimas seis horas.
 */
function pulso(activity: RecentActivityEntry[]): number[] {
  const ahora = Date.now()
  const tramos = new Array<number>(TRAMOS).fill(0)

  for (const entrada of activity) {
    const cuando = Date.parse(entrada.at)
    if (Number.isNaN(cuando)) continue
    const atras = Math.floor((ahora - cuando) / TRAMO_MS)
    if (atras < 0 || atras >= TRAMOS) continue
    tramos[TRAMOS - 1 - atras] = (tramos[TRAMOS - 1 - atras] ?? 0) + 1
  }

  return tramos
}

function Consola({
  resumen,
  activity,
  anthropic,
  openai,
  pendiente,
  onSelect,
  onOpenTower,
}: ConsolaProps) {
  const tramos = pulso(activity)
  const techo = Math.max(1, ...tramos)
  const puntos = tramos
    .map((n, i) => `${(i / (TRAMOS - 1)) * 160},${66 - (n / techo) * 58}`)
    .join(' ')

  /*
   * El porcentaje que SÍ se puede calcular.
   *
   * El diseño ponía «PRODUCTIVIDAD 80%», que sería un número inventado: esta
   * aplicación no mide el rendimiento de nadie. Lo que sí sabe es qué parte del
   * trabajo no está esperándote, y eso es justo lo que quieres de un vistazo.
   */
  const tranquilo = resumen.total === 0 ? 0 : Math.round(((resumen.total - resumen.attention) / resumen.total) * 100)

  return (
    <section className="fconsole">
      {/*
        El rótulo de la consola es la puerta al detalle.
        Desde la fábrica se ve lo esencial; para verlo TODO se entra aquí.
      */}
      <button
        type="button"
        className="fconsole__head"
        onClick={onOpenTower}
        title="Ver todo en detalle"
        data-testid="factory-tower"
      >
        <span className="fconsole__title">TORRE DE CONTROL</span>
        <span className="fconsole__sub">Tu centro de mando · pulsa para verlo todo →</span>
      </button>

      <div className="fconsole__panels">
        <article className="fcard fcard--left">
          <div className="fcard__label">RESUMEN</div>
          <div className="fcard__rows">
            <Fila color={PROVIDER_ROBOT.claude_code.dot} nombre="Claude" valor={anthropic} />
            <Fila color={PROVIDER_ROBOT.chatgpt.dot} nombre="ChatGPT / Codex" valor={openai} />
          </div>
          <div className="fcard__totals">
            <Total etiqueta="TRABAJANDO" valor={`${resumen.running} / ${FACTORY_CAPACITY.work}`} />
            <Total etiqueta="ESPERANDO TU DECISIÓN" valor={resumen.waiting} tono="warm" />
            <Total etiqueta="ERRORES" valor={resumen.failed} />
          </div>
        </article>

        <article className="fcard">
          <div className="fcard__label">ACTIVIDAD DE LAS ÚLTIMAS 6 H</div>
          <div className="fcard__pulse">
            <svg viewBox="0 0 160 70" width="176" height="78" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={puntos} fill="none" stroke="#3ad6c8" strokeWidth="2" />
            </svg>
            <div
              className="fdonut"
              style={{ background: `conic-gradient(#3ad6c8 0 ${tranquilo}%, #16262a ${tranquilo}% 100%)` }}
            >
              <span className="fdonut__value mono">{tranquilo}%</span>
            </div>
          </div>
          <div className="fcard__foot">NO TE RECLAMA NADA</div>
        </article>

        <article className="fcard fcard--right">
          <div className="fcard__label">DECISIONES PENDIENTES</div>
          {pendiente ? (
            <>
              <div className="fpending">
                <span className="fpending__status">{STATUS_LABELS[pendiente.status]}</span>
                <span className="fpending__title">{pendiente.title}</span>
              </div>
              <button type="button" className="fbtn" onClick={() => onSelect(pendiente)}>
                Revisar
              </button>
            </>
          ) : (
            <div className="fcard__calm">Nada espera una decisión tuya.</div>
          )}
        </article>
      </div>

      <span className="fconsole__strip" aria-hidden="true" />
    </section>
  )
}

function Fila({ color, nombre, valor }: { color: string; nombre: string; valor: number }) {
  return (
    <div className="frow">
      <span className="frow__dot" style={{ background: color }} />
      {nombre}
      <span className="frow__value mono">{valor}</span>
    </div>
  )
}

function Total({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string
  valor: number | string
  tono?: 'warm'
}) {
  return (
    <div className="ftotal">
      {etiqueta}
      <span className={`ftotal__value mono${tono ? ` ftotal__value--${tono}` : ''}`}>{valor}</span>
    </div>
  )
}
