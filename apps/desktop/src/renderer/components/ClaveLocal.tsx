import { useState } from 'react'

interface ClaveLocalProps {
  token: string | null
  port: number | null
}

/**
 * La clave local, donde de verdad hace falta.
 *
 * Estaba solo en el panel de diagnóstico, escondida tras un enlace al final de
 * Ajustes. Servía mientras nadie la necesitaba; en cuanto llegó la extensión de
 * navegador, que la pide para funcionar, esconderla dejó de tener sentido: la
 * primera vez que alguien la buscó, no la encontró.
 *
 * Nace oculta y hay que pulsar para verla. No por ceremonia: si enseñas la
 * pantalla a alguien o compartes una captura, la clave no sale sin que tú lo
 * decidas.
 */
export function ClaveLocal({ token, port }: ClaveLocalProps) {
  const [visible, setVisible] = useState(false)
  const [copiada, setCopiada] = useState(false)

  if (!token) {
    return (
      <p className="card__text card__text--muted" data-testid="clave-sin-receptor">
        El receptor local no está abierto, así que no hay clave que enseñar. Sin él, la extensión de
        navegador no puede registrar nada.
      </p>
    )
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 1600)
    } catch {
      setCopiada(false)
    }
  }

  return (
    <div className="clave" data-testid="clave-local">
      <div className="command">
        <code className="command__text" data-testid="clave-valor">
          {visible ? token : '•'.repeat(32)}
        </code>
        <button
          type="button"
          className="btn btn--ghost btn--tiny"
          data-testid="clave-ver"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Ocultar' : 'Ver'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--tiny"
          data-testid="clave-copiar"
          onClick={() => void copiar()}
        >
          {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <p className="card__text card__text--muted">
        Se genera sola, vive únicamente en tu ordenador y nunca se sube al repositorio. La necesita
        la <strong>extensión de navegador</strong>: pégala en sus Opciones una sola vez.
        {port !== null && <> La Torre escucha en el puerto {port}.</>}
      </p>
    </div>
  )
}
