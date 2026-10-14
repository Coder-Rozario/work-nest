import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FolderKanban,
  LayoutGrid,
  MessageSquareText,
  UserRound,
  Users,
} from "lucide-react"

import Header from "../components/Header"
import Sidebar from "../components/Sidebar"
import logo from "../assets/logo.svg"
import { authAPI } from "../services/api"

const navByRole = {
  admin: [
    { label: "Overview", icon: LayoutGrid, to: "/admin/overview" },
    { label: "Teams", icon: UserRound, to: "/Admin/teams" },
    { label: "Employees", icon: Users, to: "/Admin/employees" },
    { label: "Projects", icon: FolderKanban, to: "/Admin/projects" },
    { label: "Time & Attendance", icon: CalendarClock, to: "/Admin/time-attendance" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/Admin/meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/Admin/messages" },
    { label: "Reports", icon: BarChart3, to: "/Admin/reports" },
  ],
  manager: [
    { label: "Overview", icon: LayoutGrid, to: "/manager/overview" },
    { label: "My Team", icon: Users, to: "/manager/my-team" },
    { label: "Projects", icon: FolderKanban, to: "/manager/projects" },
    { label: "Tasks", icon: ClipboardList, to: "/manager/tasks" },
    { label: "Time & Attendance", icon: CalendarClock, to: "/manager/time-attendance" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/manager/meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/manager/messages" },
    { label: "Reports", icon: BarChart3, to: "/manager/reports" },
  ],
  employee: [
    { label: "Overview", icon: LayoutGrid, to: "/employee/overview" },
    { label: "My Team", icon: Users, to: "/employee/my-team" },
    { label: "My Tasks", icon: ClipboardList, to: "/employee/my-tasks" },
    { label: "My Projects", icon: FolderKanban, to: "/employee/my-projects" },
    { label: "Time Log", icon: CalendarClock, to: "/employee/time-log" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/employee/meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/employee/messages" },
  ],
}

const pageTitles = {
  "/admin/overview": { title: "Overview", subtitle: "Overview of your organization and key metrics." },
  "/Admin/employees": { title: "Employees & Roles", subtitle: "Manage employee records and role assignments." },
  "/Admin/teams": { title: "Teams", subtitle: "Manage teams, members, and responsibilities." },
  "/Admin/projects": { title: "Projects", subtitle: "Manage and track all projects." },
  "/Admin/tasks": { title: "Tasks", subtitle: "Monitor task progress across the organization." },
  "/Admin/time-attendance": { title: "Time & Attendance", subtitle: "Track work hours and attendance records." },
  "/Admin/meetings": { title: "Meetings", subtitle: "Schedule and manage team meetings." },
  "/Admin/messages": { title: "Messages", subtitle: "Send and receive team messages." },
  "/Admin/reports": { title: "Reports", subtitle: "Organization statistics and analytics." },
  "/Admin/profile": { title: "Profile", subtitle: "Manage your personal and work profile details." },
  "/Admin/settings": { title: "Profile", subtitle: "Manage your personal and work profile details." },
  "/manager/overview": { title: "Overview", subtitle: "Team performance and dashboard overview." },
  "/manager/my-team": { title: "My Team", subtitle: "Manage your team members and workloads." },
  "/manager/projects": { title: "Projects", subtitle: "Track team projects and delivery status." },
  "/manager/tasks": { title: "Tasks", subtitle: "Review and manage team task progress." },
  "/manager/time-attendance": { title: "Time & Attendance", subtitle: "Monitor employee time and attendance." },
  "/manager/meetings": { title: "Meetings", subtitle: "Plan and manage team meetings." },
  "/manager/messages": { title: "Messages", subtitle: "Communicate with your team." },
  "/manager/reports": { title: "Reports", subtitle: "Review team performance and reports." },
  "/manager/profile": { title: "Profile", subtitle: "Manage your personal and work profile details." },
  "/manager/settings": { title: "Profile", subtitle: "Manage your personal and work profile details." },
  "/employee/overview": { title: "Overview", subtitle: "Your daily work summary and updates." },
  "/employee/my-team": { title: "My Team", subtitle: "See who is working with you in your assigned team." },
  "/employee/my-tasks": { title: "My Tasks", subtitle: "All assigned tasks and current progress." },
  "/employee/my-projects": { title: "My Projects", subtitle: "Projects assigned to you with details and progress." },
  "/employee/time-log": { title: "Time Log", subtitle: "Clock in, clock out, and track working hours." },
  "/employee/meetings": { title: "Meetings", subtitle: "View and manage upcoming team meetings." },
  "/employee/messages": { title: "Messages", subtitle: "Communicate with your team and managers." },
  "/employee/my-profile": { title: "Profile", subtitle: "Manage your personal and work profile details." },
  "/employee/profile": { title: "Profile", subtitle: "Manage your personal and work profile details." },
}

const getRoleFromPath = (path) => {
  if (path.startsWith("/manager")) return "manager"
  if (path.startsWith("/employee")) return "employee"
  return "admin"
}

const PageLayouts = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedUser = JSON.parse(localStorage.getItem("worknest_user") || "null")
        const token = localStorage.getItem("worknest_token")

        if (!token) {
          navigate("/login", { replace: true })
          return
        }

        const refreshUser = async () => {
          const response = await authAPI.getMe()
          const user = response?.user || response || {}
          localStorage.setItem("worknest_user", JSON.stringify(user))
          setCurrentUser(user)
        }

        if (savedUser?.id) {
          setCurrentUser(savedUser)

          try {
            await refreshUser()
          } catch {
            // no-op
          }

          setIsLoadingUser(false)
          return
        }

        await refreshUser()
      } catch {
        localStorage.removeItem("worknest_token")
        localStorage.removeItem("worknest_user")
        navigate("/login", { replace: true })
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()
  }, [navigate])

  const role = useMemo(() => getRoleFromPath(location.pathname), [location.pathname])
  const pageMeta = pageTitles[location.pathname] || {
    title: "Overview",
    subtitle: "Overview of your organization and key metrics.",
  }

  const nav = useMemo(() => {
    const items = navByRole[role] || navByRole.admin
    return items.map((item) => ({
      ...item,
      active: location.pathname === item.to,
    }))
  }, [location.pathname, role])

  if (isLoadingUser) {
    return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-600">Loading workspace...</div>
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar logo={logo} nav={nav} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          role={role}
          currentUser={currentUser || { name: "User", company: "Company" }}
          pageTitle={pageMeta.title}
          pageSubtitle={pageMeta.subtitle}
        />

        <main className="flex-1 w-full overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PageLayouts
