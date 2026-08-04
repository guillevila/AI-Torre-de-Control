/// <reference types="vite/client" />
import type { TorreBridge } from '@torre/contracts'

declare global {
  interface Window {
    /** Puente expuesto por el preload. Única vía de la interfaz hacia el sistema. */
    torre: TorreBridge
  }
}

export {}
