import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
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

export default AppBootstrap
