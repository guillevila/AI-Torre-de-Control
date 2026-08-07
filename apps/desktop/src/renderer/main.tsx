import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
// Las tipografías van empaquetadas dentro de la aplicación: no se pide nada a
// internet, ni siquiera una fuente.
import './assets/fonts/fonts.css'
import './styles/tokens.css'
import './styles/app.css'
// La fábrica va aparte: es la única pantalla oscura y tiene su propia paleta.
import './styles/factory.css'

const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el contenedor de la aplicación.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
