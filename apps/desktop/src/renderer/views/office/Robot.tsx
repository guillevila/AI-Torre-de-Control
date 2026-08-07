import type { Task } from '@torre/contracts'
import { PROVIDER_ROBOT } from '@torre/domain'

/**
 * El robot de la fábrica.
 *
 * Viene del documento de diseño «Oficina Fábrica». Se dibuja entero con divs y
 * degradados —ni una imagen— para que escale sin pixelarse y para no meter
 * ficheros binarios en un repositorio público.
 *
 * Lo que comunica, y cómo:
 *
 *   El COLOR del cuerpo  → qué herramienta lo lleva (naranja Claude, verde
 *                          ChatGPT, morado Codex).
 *   El COLOR de los ojos → si algo va mal: ámbar cuando te espera, rojo cuando
 *                          ha fallado. Cian el resto del tiempo.
 *   El MOVIMIENTO        → si está trabajando de verdad. Solo se mueve quien
 *                          trabaja: nada de animación decorativa.
 *
 * Los tres son independientes, así que quitando el color la pantalla se sigue
 * leyendo —la regla de la paleta que gobierna toda la aplicación—.
 */

export type RobotSize = 'work' | 'delivery' | 'backlog'

interface RobotProps {
  task: Task
  size: RobotSize
  /** Desfase de la animación, para que no parpadeen todos a la vez. */
  phase: number
}

/** Color de los ojos. Es la señal de alarma, así que manda sobre la marca. */
function eyeColor(status: Task['status']): string {
  if (status === 'failed') return '#ff6a52'
  if (status === 'waiting_user') return '#ffbe5c'
  if (status === 'unknown') return '#ffbe5c'
  if (status === 'completed') return '#7ee04a'
  if (status === 'reviewed') return '#6bd7ff'
  return '#7fe8ff'
}

export function Robot({ task, size, phase }: RobotProps) {
  const colores = PROVIDER_ROBOT[task.provider]
  const trabajando = task.status === 'running'

  /*
   * Todo lo variable viaja por variables CSS.
   *
   * Así la hoja de estilos define la FORMA una sola vez —son unas veinte piezas
   * por robot— y aquí solo se decide el color y si se mueve. Cambiar el dibujo
   * no obliga a tocar este archivo.
   */
  const variables = {
    '--robot-dot': colores.dot,
    '--robot-body': colores.body,
    '--robot-shade': colores.shade,
    '--robot-eye': eyeColor(task.status),
    '--robot-phase': `${phase * 0.55}s`,
    // Solo se mueve quien trabaja. Si alguien se balancea, algo está pasando.
    '--robot-bob': trabajando ? 'robot-bob 3.4s ease-in-out infinite' : 'none',
    '--robot-spark': trabajando ? 'robot-spark 1.6s ease-out infinite' : 'none',
    '--robot-swap-a': trabajando ? 'robot-swap-a 4.6s ease-in-out infinite' : 'none',
    '--robot-swap-b': trabajando ? 'robot-swap-b 4.6s ease-in-out infinite' : 'none',
  } as React.CSSProperties

  return (
    <span className={`robot robot--${size}`} style={variables} aria-hidden="true">
      <span className="robot__body" />
      <span className="robot__arm robot__arm--left" />
      <span className="robot__arm robot__arm--right" />
      <span className="robot__belt" />
      <span className="robot__head" />
      <span className="robot__visor" />

      {/* Los ojos y el símbolo se alternan: solo mientras trabaja de verdad. */}
      <span className="robot__eye robot__eye--left" />
      <span className="robot__eye robot__eye--right" />
      <span className="robot__code">&lt;/&gt;</span>

      <span className="robot__ear robot__ear--left" />
      <span className="robot__ear robot__ear--right" />
      <span className="robot__antenna" />
      <span className="robot__bulb" />

      {size === 'work' && <span className="robot__spark" />}
      {size === 'backlog' && (
        <span className="robot__zzz">
          z<span>z</span>
        </span>
      )}
    </span>
  )
}
