import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { employeeAPI } from "../../services/api"

function getStatusBadgeColor(status) {
  if (status === "online") return "bg-green-50 text-green-700"
  if (status === "away") return "bg-amber-50 text-amber-700"
  return "bg-slate-100 text-slate-600"
}

function getStatusDotColor(status) {
  if (status === "online") return "bg-green-500"
  if (status === "away") return "bg-amber-500"
  return "bg-slate-400"
}

const MemberDetailModal = ({ member, onClose }) => {
  if (!member) return null

  const name = member.full_name || ((member.first_name || "") + " " + (member.last_name || "")).trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{name.trim() || member.full_name || "Unknown"}</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeColor(member._status || "offline")}`}>
            {member._status || "offline"}
          </span>
        </div>

        <p className="mb-4 text-sm text-slate-600">{member.position || "Employee"}</p>

        <div className="mb-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Email</p>
            <p className="break-all text-sm text-slate-900">{member.email || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Team</p>
            <p className="text-sm text-slate-900">{member.team_name || "Not assigned"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Role</p>
            <p className="text-sm capitalize text-slate-900">{member.role || "Employee"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Tasks</p>
            <p className="text-sm text-slate-900">{member.task_count || 0} tasks</p>
          </div>
        </div>

        <button onClick={onClose} className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700">
          Close
        </button>
      </div>
    </div>
  )
}

const EmployeeMyTeam = () => {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)

  const loadTeam = async () => {
    try {
      setLoading(true)
      const data = await employeeAPI.getTeamMembers()
      const enriched = (Array.isArray(data) ? data : []).map((member, index) => ({
        ...member,
        full_name: member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown",
        _status: index % 3 === 0 ? "online" : index % 3 === 1 ? "away" : "offline",
        task_count: 0,
      }))
      setMembers(enriched)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadTeam()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading team...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        {members.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            No teammates found for your assigned team.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {members.map((member) => {
              const name = member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown"
              const initial = (member.full_name || member.first_name || member.last_name || "?").charAt(0).toUpperCase()

              return (
                <div
                  key={member.id}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-700 to-green-500 text-sm font-medium text-white">
                        {initial}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{member.position || member.role || "Member"}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div>
                      <span className="font-medium text-slate-900">{member.team_name || "Team"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`block h-2.5 w-2.5 rounded-full ${getStatusDotColor(member._status || "offline")}`} />
                      <span className="capitalize">{member._status || "offline"}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}

export default EmployeeMyTeam
