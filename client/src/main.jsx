import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './index.css'
import AppRoutes from './Routes'
import Loading from './components/loading'

const AppBootstrap = () => {
  const [isBooting, setIsBooting] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 500)
    return () => clearTimeout(timer)
  }, [])

  if (isBooting) {
    return <Loading />
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

const rootElement = document.getElementById('root')

createRoot(rootElement).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
)
