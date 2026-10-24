import { useEffect, useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import logo from "../../assets/logo.svg"
import {Mail, Lock, Eye, EyeOff, ArrowRight, LayoutGrid, Briefcase, Users} from "lucide-react"
import { API_BASE_URL } from "../../config/env"

const API_BASE = API_BASE_URL

const roleDashboardRoute = (role) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "manager") return "/manager/overview"
  if (normalizedRole === "employee") return "/employee/overview"
  return "/admin/overview"
}

const LOCK_COOKIE_NAME = "worknest_locked"

const getCookieValue = (name) => {
  if (typeof document === "undefined") {
    return ""
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ""
}

const hasLockCookie = () => getCookieValue(LOCK_COOKIE_NAME) === "1"

const invalidCredentialsMessage = "Invalid email or password."

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const Login = () => {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0)

  // Initialize lock state from localStorage
  useEffect(() => {
    const lockUntil = localStorage.getItem("worknest_lock_until")
    if (lockUntil) {
      const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000)
      if (remaining > 0) {
        setLockTimeRemaining(remaining)
        setErrorMessage(`Too many failed attempts. Please try again in ${Math.ceil(remaining / 60)} minutes.`)
      } else {
        localStorage.removeItem("worknest_lock_until")
        if (typeof document !== "undefined") {
          document.cookie = `${LOCK_COOKIE_NAME}=; path=/; max-age=0`
        }
      }
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (lockTimeRemaining <= 0) return

    const interval = setInterval(() => {
      setLockTimeRemaining((prev) => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval(interval)
          localStorage.removeItem("worknest_lock_until")
          if (typeof document !== "undefined") {
            document.cookie = `${LOCK_COOKIE_NAME}=; path=/; max-age=0`
          }
          setErrorMessage("")
          return 0
        }
        
        // Update error message with remaining minutes
        if (next % 60 === 0 || prev === lockTimeRemaining) {
          setErrorMessage(`Too many failed attempts. Please try again in ${Math.ceil(next / 60)} minutes.`)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [lockTimeRemaining])

  useEffect(() => {
    if (hasLockCookie() || lockTimeRemaining > 0) {
      localStorage.removeItem("worknest_token")
      localStorage.removeItem("worknest_user")
      localStorage.removeItem("worknest_remember_me")

      if (hasLockCookie() && lockTimeRemaining <= 0) {
        const fifteenMins = 15 * 60
        setLockTimeRemaining(fifteenMins)
        localStorage.setItem("worknest_lock_until", (Date.now() + fifteenMins * 1000).toString())
        setErrorMessage("Too many failed attempts. Please try again in 15 minutes.")
      }
      return
    }

    const tok = localStorage.getItem("worknest_token")
    if (tok != null) {
      let role = "admin"
      try {
        const saved = localStorage.getItem("worknest_user")
        if (saved) role = JSON.parse(saved).role || "admin"
      } catch {
        role = "admin"
      }
      navigate(roleDashboardRoute(role), { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage("")

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !isValidEmail(trimmedEmail) || !trimmedPassword) {
      setErrorMessage(invalidCredentialsMessage)
      return
    }

    if (lockTimeRemaining > 0) {
      setErrorMessage(`Too many failed attempts. Please try again in ${Math.ceil(lockTimeRemaining / 60)} minutes.`)
      return
    }

    try {
      setIsLoading(true)

      const loginData = { email: trimmedEmail, password }

      const response = await axios.post(`${API_BASE}/api/auth/login`, loginData, {
        withCredentials: true,
      })

      const token = response.data.token
      const user = response.data.user
      localStorage.setItem("worknest_token", token)
      localStorage.setItem("worknest_user", JSON.stringify(user))

      if (rememberMe) {
        localStorage.setItem("worknest_remember_me", "true")
      }

      navigate(roleDashboardRoute(user.role || "admin"))

    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(error)
      }

      let errorText = invalidCredentialsMessage

      if (error.response?.data?.locked) {
        const fifteenMins = 15 * 60
        setLockTimeRemaining(fifteenMins)
        localStorage.setItem("worknest_lock_until", (Date.now() + fifteenMins * 1000).toString())
        
        localStorage.removeItem("worknest_token")
        localStorage.removeItem("worknest_user")
        localStorage.removeItem("worknest_remember_me")
        if (typeof document !== "undefined") {
          document.cookie = `${LOCK_COOKIE_NAME}=1; path=/; max-age=900; SameSite=Lax`
        }
        errorText = `Too many failed attempts. Please try again in ${Math.ceil(fifteenMins / 60)} minutes.`
      }

      setErrorMessage(errorText)
    }

    setIsLoading(false)
  }

  const togglePwdVisibility = () => {
    setShowPassword((curr) => !curr)
  }

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col bg-blue-950 text-white p-12 relative overflow-hidden">
        <div>
          <img src={logo} alt="logo" className="h-28 w-auto" />
          <div className="flex items-center gap-2">
            <span className="text-6xl font-semibold tracking-tight">
              Work<span className="text-green-400">Nest</span>
            </span>
          </div>
          <p className="text-s uppercase tracking-widest text-blue-300 mt-1 ">
            Work together, grow together
          </p>
        </div>

        <div className="max-w-md my-auto">
          <h1 className="text-4xl font-semibold leading-tight mb-4">
            Welcome back to your team's workspace.
          </h1>
          <p className="text-blue-200 text-base mb-8">
            Log in to access your projects, track task updates, and keep collaborating with your remote team seamlessly.
          </p>

          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span className="text-sm text-blue-100">
                Check pending tasks and project updates
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Users className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span className="text-sm text-blue-100">
                Connect with team members in real time
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-linear-to-r from-blue-700 to-green-500 flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>

            <span className="text-3xl font-semibold tracking-tight text-blue-950">
              Work<span className="text-green-600">Nest</span>
            </span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            Sign in to WorkNest
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            Enter your email and password to access your workspace.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage != "" && (
              <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Work email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="jane@acmestudio.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-700 font-medium hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={togglePwdVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword == true ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <span className="text-sm text-slate-500">
                Remember me for 30 days
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || lockTimeRemaining > 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-950 hover:bg-green-600 disabled:opacity-70 disabled:hover:bg-blue-950 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isLoading ? 'Signing in...' : lockTimeRemaining > 0 ? `Locked (${Math.ceil(lockTimeRemaining / 60)}m)` : 'Sign in to workspace'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Need an account?{' '}
            <Link to="/registration" className="text-blue-700 hover:underline font-medium">
              Create workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
