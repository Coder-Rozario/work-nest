import { CheckSquare, Clock, Calendar, MessageSquare, ChevronRight, Play, Pause, BriefcaseBusiness, UserCheck, FolderKanban } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useEffect, useState, useMemo } from "react"
import { employeeAPI, messageAPI, meetingAPI, timeAttendanceAPI } from "../../services/api"

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-violet-50 text-violet-700",
  "Revision Required": "bg-rose-50 text-rose-700",
  Approved: "bg-green-50 text-green-700",
  Assigned: "bg-slate-100 text-slate-700",
}

const formatDurationFriendly = (totalMinutes) => {
  const minutes = Number(totalMinutes || 0)
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins"
  if (minutes < 60) return `${Math.round(minutes)} mins`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? "" : "s"}`
  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`
}

const EmployeeOverview = () => {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState({})
  const [tasks, setTasks] = useState([])
  const [messages, setMessages] = useState([])
  const [meetings, setMeetings] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [expandedTask, setExpandedTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [isClocked, setIsClocked] = useState(false)
  const [activeLogId, setActiveLogId] = useState(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const [dashData, tasksData, convData, mtData, attendanceResp] = await Promise.all([
          employeeAPI.getDashboard(),
          employeeAPI.getTasks(),
          messageAPI.getConversations().catch(() => []),
          meetingAPI.getMeetings().catch(() => []),
          timeAttendanceAPI.getRecords().catch(() => [])
        ])

        const records = (attendanceResp && Array.isArray(attendanceResp.records)) ? attendanceResp.records : (Array.isArray(attendanceResp) ? attendanceResp : [])
        const open = records.find((entry) => entry.check_in && !entry.check_out)
        setIsClocked(Boolean(open))
        setActiveLogId(open ? open.id : null)

        setDashboard(dashData && typeof dashData === "object" ? dashData : {})
        setTasks((Array.isArray(tasksData) ? tasksData : []).slice(0, 4))
        setMessages((Array.isArray(convData) ? convData : []).slice(0, 2))
        setMeetings((Array.isArray(mtData) ? mtData : []).slice(0, 2))
        setAttendanceRecords(records.slice(0, 5))
      } catch {
        setDashboard({})
        setTasks([])
        setMessages([])
        setMeetings([])
        setAttendanceRecords([])
        setIsClocked(false)
        setActiveLogId(null)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleClockToggle = async () => {
    try {
      setClocking(true)
      if (!isClocked) {
        const res = await timeAttendanceAPI.addRecord({ check_in: new Date().toISOString(), check_out: null, note: "Clock in" })
        if (res && res.id) setActiveLogId(res.id)
        setIsClocked(true)
      } else {
        const sessionId = activeLogId || attendanceRecords.find((log) => log.check_in && !log.check_out)?.id
        if (sessionId) {
          await timeAttendanceAPI.updateRecord(sessionId, { check_out: new Date().toISOString(), note: "Clock out" })
        }
        setIsClocked(false)
        setActiveLogId(null)
      }
      const updatedDashboard = await employeeAPI.getDashboard().catch(() => ({}))
      const updatedTasks = await employeeAPI.getTasks().catch(() => [])
      const updatedConv = await messageAPI.getConversations().catch(() => [])
      const updatedMeetings = await meetingAPI.getMeetings().catch(() => [])
      const updatedRecordsResp = await timeAttendanceAPI.getRecords().catch(() => [])
      const updatedRecords = (updatedRecordsResp && Array.isArray(updatedRecordsResp.records)) ? updatedRecordsResp.records : (Array.isArray(updatedRecordsResp) ? updatedRecordsResp : [])
      const open = updatedRecords.find((entry) => entry.check_in && !entry.check_out)
      setDashboard(updatedDashboard && typeof updatedDashboard === "object" ? updatedDashboard : {})
      setTasks((Array.isArray(updatedTasks) ? updatedTasks : []).slice(0, 4))
      setMessages((Array.isArray(updatedConv) ? updatedConv : []).slice(0, 2))
      setMeetings((Array.isArray(updatedMeetings) ? updatedMeetings : []).slice(0, 2))
      setAttendanceRecords(updatedRecords.slice(0, 5))
      setIsClocked(Boolean(open))
      setActiveLogId(open ? open.id : null)
    } catch {
      window.alert("Could not update clock status. Please try again.")
    } finally {
      setClocking(false)
    }
  }

  const stats = useMemo(() => {
    const submitted = tasks.filter((t) => t.status === "Submitted").length
    const approved = tasks.filter((t) => t.status === "Approved").length
    const totalMinutes = attendanceRecords.reduce((sum, record) => {
      const diff = record.check_in && record.check_out ? (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000 : 0
      return sum + Math.max(0, diff)
    }, 0)
    return [
      { label: "Assigned Tasks", value: dashboard?.assigned_tasks ?? 0, icon: CheckSquare },
      { label: "In Progress", value: dashboard?.in_progress ?? 0, icon: Clock },
      { label: "Submitted", value: submitted, icon: Calendar },
      { label: "Approved", value: approved, icon: MessageSquare },
      { label: "Worked Time", value: formatDurationFriendly(totalMinutes), icon: UserCheck },
    ]
  }, [dashboard, tasks, attendanceRecords])

  const managerFeedback = tasks.filter((t) => t.status === "Revision Required" || t.status === "Submitted")

  if (loading) {
    return <div className="p-6 text-center">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Personal overview</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Your quick view</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate("/employee/my-tasks")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <BriefcaseBusiness className="h-4 w-4" />
              My tasks
            </button>
            <button onClick={() => navigate("/employee/my-projects")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FolderKanban className="h-4 w-4" />
              Projects
            </button>
            <button onClick={() => navigate("/employee/time-log")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserCheck className="h-4 w-4" />
              Attendance
            </button>
            <button onClick={handleClockToggle} disabled={clocking} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isClocked ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
              {isClocked ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isClocked ? "Clock Out" : "Clock In"}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">My tasks</h2>
            <p className="mt-1 text-xs text-slate-500">Current assigned and active work</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {tasks.length > 0 ? (
              tasks.map((task, idx) => (
                <li key={task.id || idx} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => { setExpandedTask(expandedTask === idx ? null : idx); navigate("/employee/my-tasks") }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.project_name || "No project"} · Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : "N/A"}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[task.status] || statusStyles.Assigned}`}>
                        {task.status || "Assigned"}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition ${expandedTask === idx ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {expandedTask === idx && (
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <p className="mb-1"><span className="font-medium">Progress:</span> {task.progress || 0}% complete</p>
                      <p><span className="font-medium">Manager feedback:</span> {task.manager_feedback || "No review comments yet."}</p>
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No tasks assigned</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Manager feedback</h2>
            <p className="mt-1 text-xs text-slate-500">Latest review updates</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {managerFeedback.length > 0 ? (
              managerFeedback.map((task) => (
                <li key={task.id} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/employee/my-tasks")}>
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500">{task.status} · Waiting for action.</p>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No pending feedback</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Attendance</h2>
            <p className="mt-1 text-xs text-slate-500">Recent work sessions</p>
          </div>
          <div className="space-y-4 p-5">
            {attendanceRecords.length > 0 ? (
              attendanceRecords.map((record) => {
                const totalMinutes = record.check_in && record.check_out ? (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000 : 0
                return (
                  <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{record.created_at ? new Date(record.created_at).toLocaleDateString() : "Recent session"}</p>
                        <p className="text-xs text-slate-500">{record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No check-in"} - {record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Open"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">{formatDurationFriendly(totalMinutes)}</span>
                    </div>
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
            <p className="mt-1 text-xs text-slate-500">Current delivery status</p>
          </div>
          <div className="space-y-4 p-5">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent messages</h2>
            <p className="mt-1 text-xs text-slate-500">Latest team conversations</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {messages.length > 0 ? (
              messages.map((message, idx) => {
                const sender = message.full_name || message.sender_name || message.sender || "User"
                const content = message.content || message.last_message || message.encrypted_text || message.preview || "No message"
                const time = message.last_message_at || message.created_at || ""
                return (
                  <li key={message.id || idx} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/employee/messages")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{sender}</p>
                        <p className="text-xs text-slate-500">{content}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{time ? new Date(time).toLocaleDateString() : ""}</span>
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
            <p className="mt-1 text-xs text-slate-500">Your next planned meetings</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {meetings.length > 0 ? (
              meetings.map((meeting) => {
                const dateStr = meeting.meeting_date || meeting.date || ""
                const timeStr = meeting.meeting_time || meeting.time || ""
                const scheduled = [dateStr, timeStr].filter(Boolean).join(" ") || "Scheduled"
                return (
                  <li key={meeting.id} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/employee/meetings")}>
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
    </div>
  )
}

export default EmployeeOverview
