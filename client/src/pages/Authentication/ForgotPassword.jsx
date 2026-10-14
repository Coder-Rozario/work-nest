import { useState } from "react"
import axios from "axios"
import { Link } from "react-router-dom"
import { ArrowLeft, CheckCircle2, ShieldCheck, Mail, Lock, KeyRound } from "lucide-react"
import { API_BASE_URL } from "../../config/env"

const ForgotPassword = () => {
  const [email, setEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState("request")
  const [generatedCode, setGeneratedCode] = useState("")

  const clearState = () => {
    setError("")
    setMessage("")
  }

  const handleRequestCode = async (e) => {
    e.preventDefault()
    clearState()

    if (!email.trim()) {
      setError("Please enter your work email.")
      return
    }

    try {
      setIsLoading(true)
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email })

      if (response.data?.reset_code) {
        setGeneratedCode(response.data.reset_code)
        setStep("reset")
        setMessage(`Reset code generated. It expires in ${response.data.expires_in_minutes || 15} minutes.`)
      } else {
        setStep("reset")
        setMessage("If this account exists, a reset code has been generated. Please continue.")
      }
    } catch (requestError) {
      const responseMessage = requestError.response?.data?.message || requestError.response?.data?.errors?.[0]?.msg || "Unable to generate reset code."
      setError(responseMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    clearState()

    if (!email.trim()) {
      setError("Please enter your email.")
      return
    }

    if (!resetCode.trim() || resetCode.length < 6) {
      setError("Please enter the 6-digit reset code.")
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    try {
      setIsLoading(true)
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email,
        reset_code: resetCode,
        new_password: newPassword,
      })

      setMessage(response.data?.message || "Password reset successful.")
      setStep("done")
      setGeneratedCode("")
      setResetCode("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (resetError) {
      const responseMessage = resetError.response?.data?.message || "Could not reset password."
      setError(responseMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-950 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-sm text-blue-200">
            <ShieldCheck className="h-4 w-4" />
            Secure password recovery
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Reset your password</h1>
        </div>

        <div className="p-6">
          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {generatedCode && step === "reset" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="h-4 w-4" />
                Your reset code
              </div>
              <div className="mt-2 text-2xl font-bold tracking-[0.35em]">{generatedCode}</div>
            </div>
          )}

          {step === "done" ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center text-green-600">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <p className="text-lg font-medium text-slate-800">Password updated successfully.</p>
              <p className="text-sm text-slate-500">You can now sign in with your new password.</p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={step === "request" ? handleRequestCode : handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              {step === "reset" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Reset code</label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Please wait..." : step === "request" ? "Send reset code" : "Set new password"}
              </button>

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
