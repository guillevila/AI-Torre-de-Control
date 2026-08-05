import { useState } from 'react'
import { analizarMarkdown, type Bloque, type Fragmento } from '../utils/markdown.js'

/**
 * La respuesta del asistente, con el formato que tiene en VSCode (D26-bis).
 *
 * Cada bloque se convierte en elementos de React uno a uno. **En ningún punto
 * se inyecta HTML**: un mensaje que contenga `<script>` se ve como texto,
 * porque no hay ningún camino por el que una cadena llegue a interpretarse
 * como marcado. Es lo que permite enseñar contenido de una conversación sin
 * abrir un agujero.
 */
export function RichText({ source }: { source: string }) {
  const bloques = analizarMarkdown(source)

  return (
    <div className="rich" data-testid="rich-text">
      {bloques.map((bloque, indice) => (
        <BloqueVista key={indice} bloque={bloque} />
      ))}
    </div>
  )
}

function BloqueVista({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case 'codigo':
      return <BloqueCodigo bloque={bloque} />

    case 'titulo': {
      // El nivel del título gobierna el tamaño, no la jerarquía del documento:
      // esto vive dentro de una tarjeta, no es el índice de la página.
      const clase = `rich__titulo rich__titulo--${bloque.nivel}`
      return (
        <p className={clase}>
          <Fragmentos partes={bloque.partes} />
        </p>
      )
    }

    case 'lista':
      return bloque.ordenada ? (
        <ol className="rich__lista">
          {bloque.puntos.map((punto, indice) => (
            <li key={indice}>
              <Fragmentos partes={punto} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="rich__lista">
          {bloque.puntos.map((punto, indice) => (
            <li key={indice}>
              <Fragmentos partes={punto} />
            </li>
          ))}
        </ul>
      )

    case 'cita':
      return (
        <blockquote className="rich__cita">
          <Fragmentos partes={bloque.partes} />
        </blockquote>
      )

    default:
      return (
        <p className="rich__parrafo">
          <Fragmentos partes={bloque.partes} />
        </p>
      )
  }
}

function BloqueCodigo({ bloque }: { bloque: Extract<Bloque, { tipo: 'codigo' }> }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = (): void => {
    void navigator.clipboard
      .writeText(bloque.texto)
      .then(() => {
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 1500)
      })
      .catch(() => {
        /* si el sistema no deja copiar, el texto sigue seleccionable a mano */
      })
  }

  return (
    <div className="rich__codigo" data-testid="rich-code">
      <div className="rich__codigo-barra">
        <span className="rich__lenguaje">{bloque.lenguaje ?? 'código'}</span>
        <button type="button" className="rich__copiar" onClick={copiar} title="Copiar el bloque">
          {copiado ? 'copiado' : 'copiar'}
        </button>
      </div>
      <pre className="mono">
        <code>{bloque.texto}</code>
      </pre>
    </div>
  )
}

function Fragmentos({ partes }: { partes: Fragmento[] }) {
  return (
    <>
      {partes.map((parte, indice) => {
        switch (parte.tipo) {
          case 'codigo':
            return (
              <code key={indice} className="rich__enlinea mono">
                {parte.texto}
              </code>
            )
          case 'fuerte':
            return <strong key={indice}>{parte.texto}</strong>
          case 'enfasis':
            return <em key={indice}>{parte.texto}</em>
          default:
            return <span key={indice}>{parte.texto}</span>
        }
      })}
    </>
  )
}
