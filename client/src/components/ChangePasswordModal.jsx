import { useState } from "react"
import { X, Lock, Eye, EyeOff } from "lucide-react"
import { authAPI } from "../services/api"

const ChangePasswordModal = ({ open, onClose }) => {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!open) return null

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const current = form.current_password.trim()
    const next = form.new_password.trim()
    const confirm = form.confirm_password.trim()

    if (!current || !next || !confirm) {
      setError("All fields are required.")
      return
    }

    if (next.length < 6) {
      setError("New password must be at least 6 characters long.")
      return
    }

    if (next !== confirm) {
      setError("New password and confirm password do not match.")
      return
    }

    try {
      setLoading(true)
      setError("")
      await authAPI.changePassword({
        current_password: current,
        new_password: next,
      })

      setForm({ current_password: "", new_password: "", confirm_password: "" })
      onClose()
      window.alert("Password updated successfully.")
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not update password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue-500"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue-500"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue-500"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordModal
