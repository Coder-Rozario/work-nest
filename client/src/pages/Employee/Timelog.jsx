import { useEffect, useState } from "react"
import { Clock, Play, Pause, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import { employeeAPI, timeAttendanceAPI } from "../../services/api"

function formatDurationFriendly(totalMinutes) {
  const minutes = Number(totalMinutes)

  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins"

  if (minutes < 60) {
    return `${Math.round(minutes)} mins`
  }

  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return `${hours} hr${hours === 1 ? "" : "s"}`
  }

  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`
}

function formatTime(value) {
  if (!value) return "-"
  try {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }
  } catch {
    // Ignore invalid timestamp formatting issues.
  }

  if (typeof value === "string") {
    const time = value.replace("T", " ").replace("Z", "")
    const dt = new Date(time)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }
    return value.slice(0, 5) || "-"
  }

  return "-"
}

function formatDate(value) {
  if (!value) return "Unknown"
  try {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }
  } catch {
    // Ignore invalid date formatting issues.
  }

  if (typeof value === "string") {
    return value.slice(0, 10)
  }

  return "Unknown"
}

// Convert a "HH:MM" (24-hour) office-time string to 12-hour format with AM/PM.
function formatOfficeTime(value) {
  if (!value) return "-"
  const match = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  let h = parseInt(match[1], 10)
  const m = match[2]
  if (Number.isNaN(h)) return value
  const period = h >= 12 ? "PM" : "AM"
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${period}`
}

// Calculate the office shift length in hours from start/end "HH:MM" strings.
// Handles overnight shifts (e.g. 20:00 - 10:00 = 14 hours).
function getOfficeDurationHours(start, end) {
  if (!start || !end) return 8
  const [sh, sm] = String(start).split(":").map((n) => parseInt(n, 10) || 0)
  const [eh, em] = String(end).split(":").map((n) => parseInt(n, 10) || 0)
  let startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  const diff = endMinutes - startMinutes
  if (diff <= 0) return 8
  return Math.round((diff / 60) * 10) / 10
}

function getSessionHours(log) {
  const safeMinutes = Number.isFinite(Number(log?.duration_minutes)) ? Number(log.duration_minutes) : 0

  if (log?.check_in && log?.check_out) {
    try {
      const diff = new Date(log.check_out).getTime() - new Date(log.check_in).getTime()
      if (Number.isFinite(diff) && diff > 0) {
        return Math.round((diff / 3600000) * 10) / 10
      }
    } catch {
      // Ignore invalid timestamp differences.
    }
  }

  if (log?.check_in && !log?.check_out) {
    try {
      const diff = Date.now() - new Date(log.check_in).getTime()
      if (Number.isFinite(diff) && diff > 0) {
        return Math.round((diff / 3600000) * 10) / 10
      }
    } catch {
      // Ignore invalid live session timing.
    }
  }

  if (safeMinutes > 0) {
    return Math.round((safeMinutes / 60) * 10) / 10
  }

  return 0
}

function getSessionMinutes(log) {
  const safeMinutes = Number.isFinite(Number(log?.duration_minutes)) ? Math.round(Number(log.duration_minutes)) : 0

  if (log?.check_in && log?.check_out) {
    try {
      const diff = new Date(log.check_out).getTime() - new Date(log.check_in).getTime()
      if (Number.isFinite(diff) && diff > 0) {
        return Math.round(diff / 60000)
      }
    } catch {
      // Ignore invalid timestamp differences.
    }
  }

  if (log?.check_in && !log?.check_out) {
    try {
      const diff = Date.now() - new Date(log.check_in).getTime()
      if (Number.isFinite(diff) && diff > 0) {
        return Math.round(diff / 60000)
      }
    } catch {
      // Ignore invalid live session timing.
    }
  }

  if (safeMinutes > 0) {
    return safeMinutes
  }

  return 0
}

const EmployeeTimelog = () => {
  const [timeLogs, setTimeLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isClocked, setIsClocked] = useState(false)
  const [expandedLog, setExpandedLog] = useState(null)
  const [todaysHours, setTodaysHours] = useState(0)
  const [activeLogId, setActiveLogId] = useState(null)
  const [officeStart, setOfficeStart] = useState("09:00")
  const [officeEnd, setOfficeEnd] = useState("17:00")

  const loadLogs = async () => {
    try {
      setLoading(true)
      const response = await employeeAPI.getTimeLog()
      const logs = (response && Array.isArray(response.records)) ? response.records : (Array.isArray(response) ? response : [])
      setTimeLogs(logs)
      if (response && response.office_start) setOfficeStart(String(response.office_start).slice(0, 5))
      if (response && response.office_end) setOfficeEnd(String(response.office_end).slice(0, 5))

      const open = logs.find((l) => l.check_in && !l.check_out)
      if (open) {
        setIsClocked(true)
        setActiveLogId(open.id)
      } else {
        setIsClocked(false)
        setActiveLogId(null)
      }

      const today = new Date().toDateString()
      let total = 0
      logs.forEach((l) => {
        const checkInDate = l?.check_in ? new Date(l.check_in) : null
        if (checkInDate && !Number.isNaN(checkInDate.getTime()) && checkInDate.toDateString() === today) {
          total += getSessionHours(l)
        }
      })
      setTodaysHours(total)
    } catch {
      setTimeLogs([])
      setIsClocked(false)
      setActiveLogId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const init = async () => {
      if (!active) return
      await loadLogs()
    }

    void init()

    return () => {
      active = false
    }
  }, [])

  const dailyTarget = getOfficeDurationHours(officeStart, officeEnd)

  const handleClockToggle = async () => {
    try {
      if (!isClocked) {
        const res = await timeAttendanceAPI.addRecord({
          check_in: new Date().toISOString(),
          check_out: null,
          note: "Clock in",
        })
        if (res && res.id) setActiveLogId(res.id)
        setIsClocked(true)
      } else {
        const sessionId = activeLogId || timeLogs.find((log) => log.check_in && !log.check_out)?.id
        if (sessionId) {
          await timeAttendanceAPI.updateRecord(sessionId, {
            check_out: new Date().toISOString(),
            note: "Clock out",
          })
        }
        setIsClocked(false)
        setActiveLogId(null)
      }
      await loadLogs()
    } catch {
      window.alert("Could not update clock status. Please try again.")
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading time log...</div>
  }

  const openLog = timeLogs.find((l) => l.check_in && !l.check_out)
  // Show the actual check-in time when clocked in; otherwise show a static "Clocked Out" label
  const currentStatusTime = isClocked && openLog ? formatTime(openLog.check_in) : "Clocked Out"

  // Determine today's clock-in status (On Time / Late) based on office hours
  const todayStr = new Date().toDateString()
  const todayLog = timeLogs.find((l) => {
    const d = l?.check_in ? new Date(l.check_in) : null
    return d && !Number.isNaN(d.getTime()) && d.toDateString() === todayStr
  })
  let todayStatus = "Not Clocked In"
  let todayStatusColor = "text-slate-600"
  let todayStatusIcon = null
  if (todayLog && todayLog.check_in) {
    const d = new Date(todayLog.check_in)
    const minutes = d.getHours() * 60 + d.getMinutes()
    const [sh, sm] = String(officeStart || "09:00").split(":").map((n) => parseInt(n, 10) || 0)
    const startMinutes = sh * 60 + sm
    if (minutes > startMinutes + 15) {
      todayStatus = "Late"
      todayStatusColor = "text-amber-600"
      todayStatusIcon = <AlertCircle className="h-4 w-4" />
    } else {
      todayStatus = "On Time"
      todayStatusColor = "text-green-600"
      todayStatusIcon = <CheckCircle2 className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">Current Status</p>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${isClocked ? "text-green-600" : "text-slate-600"}`}>
                {isClocked ? "Clocked In" : "Clocked Out"}
              </span>
              <span className={`w-3 h-3 rounded-full ${isClocked ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}></span>
            </div>
            <p className="text-sm text-slate-600 mt-3 font-medium">{currentStatusTime}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">Today's Hours</p>
            <p className="text-2xl font-bold text-slate-900">{formatDurationFriendly((todaysHours || 0) * 60)}</p>
            <p className="text-xs text-slate-500 mt-2">Target: {dailyTarget} hrs</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">Office Hours</p>
            <p className="text-2xl font-bold text-slate-900">{formatOfficeTime(officeStart)} - {formatOfficeTime(officeEnd)}</p>
            <p className={`text-sm mt-3 font-medium flex items-center gap-1.5 ${todayStatusColor}`}>
              {todayStatusIcon}
              {todayStatus}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex gap-3">
            <button
              onClick={handleClockToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                isClocked
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {isClocked ? (
                <>
                  <Pause className="h-4 w-4" />
                  Clock Out
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Clock In
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Work History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {timeLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">No work history yet. Clock in to get started!</div>
            ) : (
              timeLogs.map((log) => {
                const date = formatDate(log.created_at)
                const clockIn = formatTime(log.check_in)
                const clockOut = formatTime(log.check_out)
                const minutes = getSessionMinutes(log)
                return (
                  <div key={log.id} className="px-6 py-4 hover:bg-slate-50 transition">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{date}</p>
                          <p className="text-xs text-slate-500">{log.task_id ? `Task #${log.task_id}` : log.note || "Work session"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatDurationFriendly(minutes)}</p>
                          <p className="text-xs text-slate-500">
                            {clockIn} - {clockOut}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-slate-400 transition ${expandedLog === log.id ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                    {expandedLog === log.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                          <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-medium">Clock In:</span> {clockIn}
                          </div>
                          <div>
                            <span className="font-medium">Clock Out:</span> {clockOut}
                          </div>
                          {log.note && (
                            <div className="col-span-2">
                              <span className="font-medium">Note:</span> {log.note}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeTimelog
