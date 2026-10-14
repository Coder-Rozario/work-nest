import { Link, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"



const Sidebar = ({ logo, nav }) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem("worknest_token")
    localStorage.removeItem("worknest_user")
    localStorage.removeItem("worknest_remember_me")

    navigate("/login", { replace: true })
  }

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-blue-950 p-4 text-white lg:flex">
      <div className="mb-8 flex items-center gap-2">
        <img src={logo} alt="WorkNest logo" className="h-8" />
        <span className="text-xl font-semibold tracking-tight">
          Work<span className="text-green-400">Nest</span>
        </span>
      </div>

      <nav className="flex-1 overflow-hidden">
        <div className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon
            const linkClass = [
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              item.active ? "bg-white/10 text-white" : "text-blue-200 hover:bg-white/5 hover:text-white",
            ].join(" ")

            return (
              <Link key={item.label} to={item.to} className={linkClass}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-200 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
