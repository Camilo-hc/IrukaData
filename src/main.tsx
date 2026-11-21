import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './ui/App'
import { createStorageHealth, IrukaDatabase } from './infrastructure/storage/database'
import './ui/styles.css'

const database = new IrukaDatabase()
const storageHealth = createStorageHealth(database)
const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el contenedor de IrukaData.')

// Composición: la UI recibe puertos; nunca conoce Dexie.
createRoot(container).render(
  <StrictMode>
    <HashRouter><App storageHealth={storageHealth} /></HashRouter>
  </StrictMode>,
)
