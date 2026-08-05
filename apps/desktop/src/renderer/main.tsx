import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { PopupApp } from './PopupApp.js'
// Las tipografías van empaquetadas dentro de la aplicación: no se pide nada a
// internet, ni siquiera una fuente.
import './assets/fonts/fonts.css'
import './styles/tokens.css'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el contenedor de la aplicación.')

// El mismo paquete sirve a las dos ventanas. `?ventana=aviso` es la ventanita
// que sale junto al puntero (D26); sin parámetro, la Torre de siempre. Se hace
// así —y no con un segundo empaquetado— para que compartan de verdad los
// componentes, los estilos y el puente con el proceso principal.
const esAviso = new URLSearchParams(window.location.search).get('ventana') === 'aviso'
if (esAviso) document.body.dataset['ventana'] = 'aviso'

createRoot(container).render(<StrictMode>{esAviso ? <PopupApp /> : <App />}</StrictMode>)
