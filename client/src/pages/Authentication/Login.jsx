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



const Login = () => {
  const navigate = useNavigate()

  // state variables for login form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState(() => hasLockCookie() ? "Too many failed attempts. Please try again in 15 minutes." : "")
  const [isLoading, setIsLoading] = useState(false)

  // check if user already logged in
  useEffect(() => {
    if (hasLockCookie()) {
      localStorage.removeItem("worknest_token")
      localStorage.removeItem("worknest_user")
      localStorage.removeItem("worknest_remember_me")
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


  // submit form function
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage("")

    if (hasLockCookie()) {
      setErrorMessage("Too many failed attempts. Please try again in 15 minutes.")
      localStorage.removeItem("worknest_token")
      localStorage.removeItem("worknest_user")
      localStorage.removeItem("worknest_remember_me")
      return
    }

    try {
      setIsLoading(true)

      const loginData = { email, password }

      // api call to backend
      const response = await axios.post(`${API_BASE}/api/auth/login`, loginData, {
        withCredentials: true,
      })

      // save token and user to local storage
      const token = response.data.token
      const user = response.data.user
      localStorage.setItem("worknest_token", token)
      localStorage.setItem("worknest_user", JSON.stringify(user))

      if (rememberMe) {
        localStorage.setItem("worknest_remember_me", "true")
      }

      // redirect based on user role
      navigate(roleDashboardRoute(user.role || "admin"))

    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(error)
      }
      let errorText = "Login failed. Please try again."

      if (error.response?.data?.message) {
        errorText = error.response.data.message
      }

      if (error.response?.data?.locked) {
        localStorage.removeItem("worknest_token")
        localStorage.removeItem("worknest_user")
        localStorage.removeItem("worknest_remember_me")
        if (typeof document !== "undefined") {
          document.cookie = `${LOCK_COOKIE_NAME}=1; path=/; max-age=900; SameSite=Lax`
        }
      }

      setErrorMessage(errorText)
    }

    setIsLoading(false)
  }


  // eye button click handler
  const togglePwdVisibility = () => {
    setShowPassword((curr) => !curr)
  }



  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white">
      
      {/* left side - banner */}
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

      {/* right side - form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* mobile logo */}
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
            
            {/* show error */}
            {errorMessage != "" && (
              <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
                {errorMessage}
              </div>
            )}

            {/* email input */}
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

            {/* password input */}
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

            {/* remember me checkbox */}
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

            {/* submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-950 hover:bg-green-600 disabled:opacity-70 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign in to workspace'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* registration link */}
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
