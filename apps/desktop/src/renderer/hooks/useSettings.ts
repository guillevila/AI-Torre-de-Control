import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '@torre/contracts'

/**
 * Ajustes locales.
 *
 * Se cargan una vez al arrancar y se guardan en cuanto cambian: no hay botón de
 * «Guardar» porque cada interruptor hace algo de verdad de inmediato.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    void window.torre.getSettings().then((result) => {
      if (!alive) return
      if (result.ok) setSettings(result.data)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const update = useCallback(async (patch: SettingsPatch) => {
    const result = await window.torre.updateSettings(patch)
    if (result.ok) setSettings(result.data)
    return result
  }, [])

  return { settings, loaded, update }
}
