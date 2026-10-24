import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState, useRef } from "react"
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
import { connectRealtime, disconnectRealtime, subscribeRealtime } from "../services/realtime"

const resourceToPathMap = {
  messages: ["/admin/messages", "/manager/messages", "/employee/messages"],
  meetings: ["/admin/meetings", "/manager/meetings", "/employee/meetings"],
  tasks: ["/admin/tasks", "/manager/tasks", "/employee/my-tasks"],
  projects: ["/admin/projects", "/manager/projects", "/employee/my-projects"],
  attendance: ["/admin/time-attendance", "/manager/time-attendance", "/employee/time-log"],
  teams: ["/admin/teams", "/manager/my-team", "/employee/my-team"],
  employees: ["/admin/employees"],
  reports: ["/admin/reports", "/manager/reports"],
}

const navByRole = {
  admin: [
    { label: "Overview", icon: LayoutGrid, to: "/admin/overview" },
    { label: "Teams", icon: UserRound, to: "/Admin/teams", resource: "teams" },
    { label: "Employees", icon: Users, to: "/Admin/employees", resource: "employees" },
    { label: "Projects", icon: FolderKanban, to: "/Admin/projects", resource: "projects" },
    { label: "Time & Attendance", icon: CalendarClock, to: "/Admin/time-attendance", resource: "attendance" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/Admin/meetings", resource: "meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/Admin/messages", resource: "messages" },
    { label: "Reports", icon: BarChart3, to: "/Admin/reports", resource: "reports" },
  ],
  manager: [
    { label: "Overview", icon: LayoutGrid, to: "/manager/overview" },
    { label: "My Team", icon: Users, to: "/manager/my-team", resource: "teams" },
    { label: "Projects", icon: FolderKanban, to: "/manager/projects", resource: "projects" },
    { label: "Tasks", icon: ClipboardList, to: "/manager/tasks", resource: "tasks" },
    { label: "Time & Attendance", icon: CalendarClock, to: "/manager/time-attendance", resource: "attendance" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/manager/meetings", resource: "meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/manager/messages", resource: "messages" },
    { label: "Reports", icon: BarChart3, to: "/manager/reports", resource: "reports" },
  ],
  employee: [
    { label: "Overview", icon: LayoutGrid, to: "/employee/overview" },
    { label: "My Team", icon: Users, to: "/employee/my-team", resource: "teams" },
    { label: "My Tasks", icon: ClipboardList, to: "/employee/my-tasks", resource: "tasks" },
    { label: "My Projects", icon: FolderKanban, to: "/employee/my-projects", resource: "projects" },
    { label: "Time Log", icon: CalendarClock, to: "/employee/time-log", resource: "attendance" },
    { label: "Meetings", icon: BriefcaseBusiness, to: "/employee/meetings", resource: "meetings" },
    { label: "Messages", icon: MessageSquareText, to: "/employee/messages", resource: "messages" },
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
  const [notifications, setNotifications] = useState({})

  const pathRef = useRef(location.pathname)
  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  // Keeps one realtime stream open for every page rendered inside this layout.
  useEffect(() => {
    connectRealtime()
    
    const unsubscribe = subscribeRealtime((event) => {
      const resource = event.resource
      if (!resource) return

      // Don't notify if user is already on a path associated with this resource
      const associatedPaths = resourceToPathMap[resource] || []
      const isCurrentPathAssociated = associatedPaths.some(p => 
        pathRef.current.toLowerCase() === p.toLowerCase()
      )

      if (!isCurrentPathAssociated) {
        setNotifications(prev => ({
          ...prev,
          [resource]: true
        }))
      }
    })

    return () => {
      disconnectRealtime()
      unsubscribe()
    }
  }, [])

  // Clear notifications when path changes
  useEffect(() => {
    const currentPath = location.pathname.toLowerCase()
    let resourceToClear = null
    
    for (const [resource, paths] of Object.entries(resourceToPathMap)) {
      if (paths.some(p => p.toLowerCase() === currentPath)) {
        resourceToClear = resource
        break
      }
    }

    if (resourceToClear && notifications[resourceToClear]) {
      setNotifications(prev => {
        const next = { ...prev }
        delete next[resourceToClear]
        return next
      })
    }
  }, [location.pathname, notifications])

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
            // Silently ignore refresh failure if we already have saved data
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
      hasNotification: !!(item.resource && notifications[item.resource])
    }))
  }, [location.pathname, role, notifications])

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
