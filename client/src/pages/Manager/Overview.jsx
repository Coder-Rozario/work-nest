import { Users, CheckSquare, Calendar, TrendingUp, ChevronRight, BriefcaseBusiness, UserCheck, FolderKanban, Clock3 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useEffect, useState, useMemo, useRef } from "react"
import { managerAPI, messageAPI, meetingAPI, timeAttendanceAPI } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

const statusStyles = {
  Assigned: "bg-slate-100 text-slate-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-violet-50 text-violet-700",
  Approved: "bg-green-50 text-green-700",
  "Revision Required": "bg-rose-50 text-rose-700",
}

const xorDecrypt = (input) => {
  const text = String(input ?? "")
  if (!text.trim()) return ""
  if (text.length % 2 !== 0) return text

  let result = ""
  const ENCRYPTION_KEY = "worknest_secure_v1"
  for (let i = 0; i < text.length; i += 2) {
    const hexPair = text.slice(i, i + 2)
    if (!/^[0-9a-fA-F]{2}$/.test(hexPair)) return text
    const byte = parseInt(hexPair, 16)
    const keyCode = ENCRYPTION_KEY.charCodeAt((i / 2) % ENCRYPTION_KEY.length)
    result += String.fromCharCode(byte ^ keyCode)
  }
  return result
}

const decodeMessageText = (value) => {
  const text = String(value ?? "")
  const decoded = xorDecrypt(text)
  if (decoded && decoded.trim()) return decoded.trim()
  return text && text.trim() ? text.trim() : "No messages yet"
}

const formatDurationFriendly = (totalMinutes) => {
  const minutes = Number(totalMinutes || 0)
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins"
  if (minutes < 60) return `${Math.round(minutes)} mins`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? "" : "s"}`
  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`
}

const formatDisplayDate = (value) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const formatDisplayTime = (value) => {
  if (!value) return ""
  
  // Handle HH:mm:ss or HH:mm format
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
    const [h, m] = value.split(':')
    let hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12 || 12
    return `${hour}:${m} ${ampm}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const ManagerOverview = () => {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [tasks, setTasks] = useState([])
  const [messages, setMessages] = useState([])
  const [meetings, setMeetings] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const isMountedRef = useRef(true)

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const [dashData, tasksData, conversationsData, meetingsData, attendanceResp] = await Promise.all([
        managerAPI.getDashboard(),
        managerAPI.getTeamTasks(),
        messageAPI.getConversations().catch(() => []),
        meetingAPI.getMeetings().catch(() => []),
        timeAttendanceAPI.getRecords().catch(() => [])
      ])

      const records = (attendanceResp && Array.isArray(attendanceResp.records)) ? attendanceResp.records : (Array.isArray(attendanceResp) ? attendanceResp : [])

      if (isMountedRef.current) {
        setDashboard(dashData && typeof dashData === "object" ? dashData : {})
        setTasks((Array.isArray(tasksData) ? tasksData : []).slice(0, 4))
        setMessages((Array.isArray(conversationsData) ? conversationsData : []).slice(0, 2))
        setMeetings((Array.isArray(meetingsData) ? meetingsData : []).slice(0, 2))
        setAttendanceRecords(records.slice(0, 5))
      }
    } catch {
      if (isMountedRef.current) {
        setDashboard({})
        setTasks([])
        setMessages([])
        setMeetings([])
        setAttendanceRecords([])
      }
    } finally {
      if (isMountedRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    const timerId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    const intervalId = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)

    return () => {
      isMountedRef.current = false
      window.clearTimeout(timerId)
      window.clearInterval(intervalId)
    }
  }, [])

  useRealtime(["tasks", "projects", "meetings", "employees", "attendance"], () => { void loadDashboard({ silent: true }) })

  const assigneeName = (task) => task.full_name || task.assignee || "Unassigned"

  const stats = useMemo(() => {
    const submittedCount = tasks.filter((t) => t.status === "Submitted" || t.status === "Under Review").length
    const approvedCount = tasks.filter((t) => t.status === "Approved").length
    const totalMinutes = attendanceRecords.reduce((sum, record) => {
      let diff = 0
      if (record.check_in && record.check_out) {
        diff = (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000
      } else if (record.check_in && !record.check_out) {
        diff = (Date.now() - new Date(record.check_in).getTime()) / 60000
      }
      return sum + Math.max(0, diff)
    }, 0)
    return [
      { label: "Team Members", value: dashboard?.team_members ?? 0, icon: Users },
      { label: "Active Tasks", value: dashboard?.active_tasks ?? 0, icon: CheckSquare },
      { label: "Submitted", value: submittedCount, icon: Calendar },
      { label: "Approved", value: approvedCount, icon: TrendingUp },
      { label: "Worked Time", value: formatDurationFriendly(totalMinutes), icon: Clock3 },
    ]
  }, [dashboard, tasks, attendanceRecords, tick])

  const pendingReviews = tasks.filter((t) => t.status === "Submitted" || t.status === "Revision Required")

  if (loading) {
    return <div className="p-6 text-center">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Team overview</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Manager snapshot</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate("/manager/tasks")} className="worknest-primary-btn">
              <BriefcaseBusiness className="h-4 w-4" />
              Tasks
            </button>
            <button onClick={() => navigate("/manager/projects")} className="worknest-secondary-btn">
              <FolderKanban className="h-4 w-4" />
              Projects
            </button>
            <button onClick={() => navigate("/manager/time-attendance")} className="worknest-secondary-btn">
              <UserCheck className="h-4 w-4" />
              Time Attendance
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">{item.label}</span>
                <Icon className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-xl font-semibold text-slate-900">{item.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent messages</h2>
            <p className="mt-1 text-xs text-slate-500">Latest team conversations</p>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {messages.length > 0 ? (
              messages.map((message, idx) => {
                const sender = message.full_name || message.sender_name || message.sender || "User"
                const content = decodeMessageText(message.content || message.last_message || message.encrypted_text || message.preview || "No message")
                const time = message.last_message_at || message.created_at || message.createdAt || ""
                return (
                  <li key={message.id || idx} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/manager/messages")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{sender}</p>
                        <p className="text-xs text-slate-600 wrap-break-word">{content}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatDisplayDate(time)}</span>
                    </div>
                  </li>
                )
              })
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No messages</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming meetings</h2>
            <p className="mt-1 text-xs text-slate-500">Planned meetings for the team</p>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {meetings.length > 0 ? (
              meetings.map((meeting) => {
                const dateStr = formatDisplayDate(meeting.meeting_date || meeting.date)
                const timeStr = formatDisplayTime(meeting.meeting_time || meeting.time)
                const scheduled = [dateStr, timeStr].filter(Boolean).join(" · ") || "Scheduled"
                return (
                  <li key={meeting.id} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/manager/meetings")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{meeting.title || meeting.topic || "Meeting"}</p>
                        <p className="text-xs text-slate-500">{scheduled}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                  </li>
                )
              })
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No upcoming meetings</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Team tasks</h2>
            <p className="mt-1 text-xs text-slate-500">Your team landings and current workload</p>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <li key={task.id} className="cursor-pointer flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/manager/tasks")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">{assigneeName(task)} · Due {formatDisplayDate(task.due_date) || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[task.status] || statusStyles.Assigned}`}>
                      {task.status || "Assigned"}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{task.progress || 0}%</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No tasks</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Pending reviews</h2>
            <p className="mt-1 text-xs text-slate-500">Tasks needing manager action</p>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {pendingReviews.length > 0 ? (
              pendingReviews.map((task) => (
                <li key={task.id} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/manager/tasks")}>
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500">{assigneeName(task)} · {task.status}</p>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No pending reviews</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Attendance & workload</h2>
            <p className="mt-1 text-xs text-slate-500">Team attendance summary</p>
          </div>
          <div className="max-h-72 space-y-4 overflow-y-auto p-5">
            {attendanceRecords.length > 0 ? (
              attendanceRecords.map((record) => {
                const status = record.check_in ? "Present" : "Absent"
                let totalMinutes = 0
                if (record.check_in && record.check_out) {
                  totalMinutes = (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000
                } else if (record.check_in && !record.check_out) {
                  totalMinutes = (Date.now() - new Date(record.check_in).getTime()) / 60000
                }
                return (
                  <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{record.full_name || "Unknown employee"}</p>
                        <p className="text-xs text-slate-500">{formatDisplayTime(record.check_in) || "No check-in"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${status === "Present" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Worked time: {formatDurationFriendly(totalMinutes)}</p>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-500">No attendance records</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Project progress</h2>
            <p className="mt-1 text-xs text-slate-500">Current team delivery health</p>
          </div>
          <div className="max-h-72 space-y-4 overflow-y-auto p-5">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div key={task.id || task.title}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-800">{task.title}</span>
                    <span className="text-xs font-medium text-slate-500">{Number(task.progress || 0)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-linear-to-r from-blue-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, Number(task.progress || 0)))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No project progress data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerOverview
