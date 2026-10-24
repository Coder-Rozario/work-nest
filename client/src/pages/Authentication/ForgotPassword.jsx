import { useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldCheck, Mail, User, Briefcase, KeyRound, RefreshCw, CheckCircle2 } from "lucide-react"
import { API_BASE_URL } from "../../config/env"

const MAX_RESEND_ATTEMPTS = 10
const CODE_LENGTH = 6

const roleDashboardRoute = (role) => {
  const normalizedRole = String(role || "").trim().toLowerCase()
  if (normalizedRole === "manager") return "/manager/overview"
  if (normalizedRole === "employee") return "/employee/overview"
  return "/admin/overview"
}

const ForgotPassword = () => {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [position, setPosition] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState("identify")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendRemaining, setResendRemaining] = useState(MAX_RESEND_ATTEMPTS)

  const clearFeedback = () => {
    setError("")
    setMessage("")
  }

  const extractError = (requestError, fallback) =>
    requestError.response?.data?.message || requestError.response?.data?.errors?.[0]?.msg || fallback

  const requestCode = async (isResend) => {
    clearFeedback()

    try {
      if (isResend) {
        setIsResending(true)
      } else {
        setIsLoading(true)
      }

      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, {
        name: name.trim(),
        email: email.trim(),
        position: position.trim(),
      })

      setStep("verify")
      setCode("")
      setResendRemaining(response.data?.resend_remaining ?? 0)
      setMessage(response.data?.message || "A verification code has been sent to your registered email.")
    } catch (requestError) {
      if (requestError.response?.data?.resend_remaining === 0) {
        setResendRemaining(0)
      }
      setError(extractError(requestError, "Could not send the verification code."))
    } finally {
      setIsLoading(false)
      setIsResending(false)
    }
  }

  const handleIdentify = async (e) => {
    e.preventDefault()

    if (!name.trim() || !email.trim() || !position.trim()) {
      setError("Please enter your name, email and position.")
      return
    }

    await requestCode(false)
  }

  const handleResend = () => {
    if (isResending || resendRemaining <= 0) return
    requestCode(true)
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    clearFeedback()

    if (code.trim().length !== CODE_LENGTH) {
      setError(`Please enter the ${CODE_LENGTH}-digit verification code.`)
      return
    }

    try {
      setIsLoading(true)

      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-reset-code`, {
        name: name.trim(),
        email: email.trim(),
        position: position.trim(),
        code: code.trim(),
      })

      const token = response.data?.token
      const user = response.data?.user

      if (!token || !user) {
        setError("Verification failed. Please try again.")
        return
      }

      // Verified identity grants direct access to the workspace.
      localStorage.setItem("worknest_token", token)
      localStorage.setItem("worknest_user", JSON.stringify(user))

      // Clear any existing login lock state
      localStorage.removeItem("worknest_lock_until")
      if (typeof document !== "undefined") {
        document.cookie = "worknest_locked=; path=/; max-age=0; SameSite=Lax"
      }

      navigate(roleDashboardRoute(user.role), { replace: true })
    } catch (requestError) {
      setError(extractError(requestError, "Could not verify the code."))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (value) => {
    setCode(value.replace(/\D/g, "").slice(0, CODE_LENGTH))
    setError("")
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-sm text-sky-300">
            <ShieldCheck className="h-4 w-4" />
            Secure account access
          </div>
          <h1 className="mt-3 text-2xl font-semibold">
            {step === "identify" ? "Verify your identity" : "Enter verification code"}
          </h1>
          <p className="mt-1 text-sm text-blue-200">
            {step === "identify"
              ? "Confirm your details to access your WorkNest account."
              : "Enter the code we sent to your registered email address."}
          </p>
        </div>

        <div className="p-6">
          {message && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === "identify" ? (
            <form onSubmit={handleIdentify} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setError("")
                    }}
                    placeholder="Jane Cooper"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError("")
                    }}
                    placeholder="jane@acmestudio.com"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value)
                      setError("")
                    }}
                    placeholder="Project Manager"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Sending code..." : "Send verification code"}
              </button>

              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Verification code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-center text-lg font-semibold tracking-[0.5em] text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Verifying..." : "Verify and continue"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || resendRemaining <= 0}
                  className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Resending..." : "Resend code"}
                </button>
                <span className="text-xs text-slate-500">
                  {resendRemaining > 0
                    ? `${resendRemaining} resend${resendRemaining > 1 ? "s" : ""} left`
                    : "Resend limit reached"}
                </span>
              </div>

              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
