import { useState } from 'react'
import type { TurnStep } from '@torre/contracts'
import { RichText } from './RichText.js'

/**
 * El turno paso a paso, como se lee en el chat del editor (D26-quater).
 *
 * Alterna lo que el asistente dice con lo que hace: cada herramienta es un
 * renglón —qué, sobre qué, cuánto cambia— y los cambios se despliegan en
 * formato diff. Eso es lo que convierte la tarjeta en algo con lo que se puede
 * decidir: sin ver qué ficheros se han tocado, «¿sigo?» no tiene respuesta.
 *
 * Lo que **no** puede haber aquí son los botones de aceptar o descartar del
 * editor. Cuando esta tarjeta aparece, el turno ya terminó y los cambios están
 * hechos: esto es lo ocurrido, no una propuesta pendiente.
 */
export function TurnSteps({ steps }: { steps: TurnStep[] }) {
  return (
    <div className="pasos" data-testid="turn-steps">
      {steps.map((paso, indice) =>
        paso.kind === 'text' ? (
          <RichText key={indice} source={paso.text} />
        ) : (
          <Herramienta key={indice} paso={paso} />
        ),
      )}
    </div>
  )
}

function Herramienta({ paso }: { paso: Extract<TurnStep, { kind: 'tool' }> }) {
  const [abierto, setAbierto] = useState(false)
  const tieneDiff = Boolean(paso.diff)
  // Del fichero se enseña el nombre, que es lo que se reconoce; la ruta entera
  // se queda en el título, al alcance del ratón pero sin ocupar el renglón.
  const corto = paso.target.split(/[\\/]/).pop() || paso.target

  return (
    <div className="paso" data-testid="turn-step-tool">
      <button
        type="button"
        className="paso__fila"
        disabled={!tieneDiff}
        aria-expanded={tieneDiff ? abierto : undefined}
        onClick={() => setAbierto((previo) => !previo)}
        title={paso.target || paso.name}
      >
        <span className="paso__punto" aria-hidden="true">
          {tieneDiff ? (abierto ? '▾' : '▸') : '·'}
        </span>
        <span className="paso__nombre">{paso.name}</span>
        {paso.target ? <span className="paso__objetivo mono">{corto}</span> : null}
        {paso.added !== null || paso.removed !== null ? (
          <span className="paso__cuentas mono">
            {paso.added ? <span className="paso__mas">+{paso.added}</span> : null}
            {paso.removed ? <span className="paso__menos">−{paso.removed}</span> : null}
          </span>
        ) : null}
      </button>

      {abierto && paso.diff ? <Diff texto={paso.diff} /> : null}
    </div>
  )
}

function Diff({ texto }: { texto: string }) {
  return (
    <pre className="diff mono" data-testid="turn-diff">
      {texto.split('\n').map((linea, indice) => {
        const signo = linea.startsWith('+') ? 'mas' : linea.startsWith('-') ? 'menos' : 'igual'
        return (
          <span key={indice} className={`diff__linea diff__linea--${signo}`}>
            {linea}
            {'\n'}
          </span>
        )
      })}
    </pre>
  )
}
