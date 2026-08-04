import { useState } from 'react'

interface CopyableCommandProps {
  command: string
}

/** Bloque de comando con botón de copiar. */
export function CopyableCommand({ command }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="command">
      <code className="command__text">{command}</code>
      <button type="button" className="btn btn--ghost btn--tiny" onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
