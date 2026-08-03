import { useEffect, useState } from 'react'

/**
 * Reloj que hace avanzar los tiempos de la pantalla.
 *
 * Sin esto, «hace 3 min» y los cronómetros se quedarían congelados en el valor
 * que tenían al dibujarse: solo cambiarían cuando alguna tarea cambiase, que es
 * justo cuando NO hace falta. El diseño pide un cronómetro vivo, y esto es lo
 * que lo mantiene vivo.
 *
 * Treinta segundos es suficiente porque todo se muestra con resolución de
 * minutos, y es lo bastante barato como para no notarse.
 */
export function useClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
