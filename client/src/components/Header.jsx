import { Link } from "react-router-dom"
import { getAssetUrl } from "../config/env"

const getDisplayName = (user) => {
  if (!user) return "User"

  const candidates = [
    user.full_name,
    user.fullName,
    [user.first_name, user.last_name].filter(Boolean).join(" "),
    user.name,
    user.email,
  ]

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "unknown") {
      return value.trim()
    }
  }

  return "User"
}

const getRoleLabel = (role) => {
  if (role === "admin") return "Admin"
  if (role === "manager") return "Manager"
  return "Employee"
}

const getDefaultTitle = (role, currentUser) => {
  if (role === "admin") return `${currentUser.company || "Company"} overview`
  if (role === "manager") return "Team overview"
  return "Your overview"
}

const getProfileRoute = (role) => {
  if (role === "admin") return "/Admin/profile"
  if (role === "manager") return "/manager/profile"
  return "/employee/my-profile"
}

const getProfilePhoto = (user) => {
  const photo = user?.profile_photo || user?.avatar || user?.photo || user?.profilePhoto || ""
  return photo ? getAssetUrl(photo) : ""
}

const Header = ({ role, currentUser, pageTitle, pageSubtitle }) => {
  const userName = getDisplayName(currentUser)
  const companyName = currentUser?.company || currentUser?.company_name || "Company"
  const firstLetter = userName.charAt(0).toUpperCase()
  const profileRoute = getProfileRoute(role)
  const profilePhoto = getProfilePhoto(currentUser)

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 lg:px-6">
      <div className="min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-600 sm:text-[11px]">
          {getRoleLabel(role)}
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-[2.2rem]">
          {pageTitle || getDefaultTitle(role, { company: companyName })}
        </h1>

        {pageSubtitle != null && pageSubtitle !== "" && (
          <p className="mt-2 text-sm text-slate-500 sm:text-base">{pageSubtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <Link to={profileRoute} className="flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-slate-100">
          {profilePhoto ? (
            <img src={profilePhoto} alt={userName} className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-r from-blue-700 to-green-500 text-sm font-medium text-white">
              {firstLetter}
            </div>
          )}
          <span className="hidden text-sm font-medium text-slate-700 sm:block">{userName}</span>
        </Link>
      </div>
    </header>
  )
}

export default Header
