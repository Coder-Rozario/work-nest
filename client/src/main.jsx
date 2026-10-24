import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppBootstrap from './AppBootstrap'

const rootElement = document.getElementById('root')

createRoot(rootElement).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
)
