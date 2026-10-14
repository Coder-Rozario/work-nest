import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import axios from "axios"
import logo from "../../assets/logo.svg"
import { ArrowRight, Briefcase, Building2, Mail, User, Users, Lock } from "lucide-react"
import { API_BASE_URL } from "../../config/env"

const API_BASE = API_BASE_URL

const roleDashboardRoute = (role) => {
  if (role === "manager") return "/manager/overview"
  if (role === "employee") return "/employee/overview"
  return "/admin/overview"
}

const Registration = () => {
  const navigate = useNavigate()

  // state variables for form fields
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [industry, setIndustry] = useState('')
  const [fullName, setFullName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)

  // messages and loading
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)


  // if user already logged in take to dashboard
  useEffect(() => {
    const t = localStorage.getItem("worknest_token")
    if (t) {
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


  // password strength check
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { valid: false, score: 0, msg: "Enter a password" }
    let score = 0
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return {
      valid: pwd.length >= 8,
      score,
      msg: pwd.length < 8 ? "Password must be at least 8 characters." : "",
    }
  }

  // form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    // check password match
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    // validate password strength
    const strength = getPasswordStrength(password)
    if (!strength.valid) {
      setErrorMessage(strength.msg)
      return
    }

    // check terms agreement
    if (!agreeToTerms) {
      setErrorMessage("Please agree to the Terms of Service and Privacy Policy.")
      return
    }

    try {
      setIsLoading(true)

      const registrationData = {
        company_name: companyName.trim(),
        company_size: companySize,
        industry: industry,
        full_name: fullName.trim(),
        work_email: workEmail.trim().toLowerCase(),
        password: password,
        confirm_password: confirmPassword,
        agree_to_terms: agreeToTerms,
      }

      // call register api
      const response = await axios.post(`${API_BASE}/api/auth/register`, registrationData)

      const token = response.data.token
      const user = response.data.user

      localStorage.setItem("worknest_token", token)
      localStorage.setItem("worknest_user", JSON.stringify(user))

      setSuccessMessage("Workspace created successfully!")

      setTimeout(() => {
        navigate(roleDashboardRoute(user.role || "admin"))
      }, 1000)

    } catch (error) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(error)
      }
      let errorText = "Registration failed. Please try again."

      if (error.response?.data?.message) {
        errorText = error.response.data.message
      } else if (error.response?.data?.errors?.length > 0) {
        errorText = error.response.data.errors[0].msg
      }

      setErrorMessage(errorText)
    }

    setIsLoading(false)
  }



  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      
      {/* left banner section */}
      <section className="hidden md:flex md:w-1/2 bg-blue-950 items-center justify-center">
        <div className="max-w-lg mx-12 p-8">
          <img src={logo} alt="logo" className="w-24" />
          <h1 className="text-5xl font-bold text-white mt-4">
            Work <span className="text-green-400">Nest</span>
          </h1>
          <p className="text-lg text-gray-300 mt-4 leading-relaxed">
            Bring your team's work into one nest.
          </p>
          <p className="text-blue-200 text-base mt-4">
            Work Nest replaces scattered tools with a single workspace built for remote teams to plan, track, and talk about their work.
          </p>

          <ul className="space-y-5 mt-8">
            <li className="flex gap-3">
              <Briefcase className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-blue-100">
                Assign and track tasks without switching tabs
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-blue-100">
                See what your team is working on in real time
              </span>
            </li>
            <li className="flex gap-3">
              <Mail className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-blue-100">
                Keep conversations with the work itself
              </span>
            </li>
          </ul>
        </div>
      </section>


      {/* right form section */}
      <div className="flex items-center justify-center p-6 md:w-1/2 w-full">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Create your workspace
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Set up your organization and start managing work.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* error msg */}
            {errorMessage != '' && (
              <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
                {errorMessage}
              </div>
            )}

            {/* success msg */}
            {successMessage != '' && (
              <div className="p-3 bg-green-100 text-green-700 rounded text-sm">
                {successMessage}
              </div>
            )}

            {/* company name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="ABC Studio"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            {/* company size and industry in 2 cols */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company size
                </label>
                <select
                  value={companySize}
                  onChange={(e) => {
                    setCompanySize(e.target.value)
                    setErrorMessage('')
                  }}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="">Select</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value)
                    setErrorMessage('')
                  }}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="">Select</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* full name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="Jane Rahman"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            {/* work email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Work email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => {
                    setWorkEmail(e.target.value)
                    setErrorMessage('')
                  }}
                  placeholder="jane@company.com"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            {/* password + confirm */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setErrorMessage('')
                    }}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>
            </div>

            {/* terms checkbox */}
            <label className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => {
                  setAgreeToTerms(e.target.checked)
                  setErrorMessage('')
                }}
                required
                className="mt-1 w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-500">
                I agree to the Terms of Service and Privacy Policy
              </span>
            </label>

            {/* submit btn */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-950 hover:bg-green-600 disabled:opacity-70 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? 'Creating workspace...' : 'Create workspace'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* login link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-blue-700 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Registration
