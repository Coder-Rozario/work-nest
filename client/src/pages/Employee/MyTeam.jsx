import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { employeeAPI } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

const MemberDetailModal = ({ member, onClose }) => {
  if (!member) return null

  const name = member.full_name || ((member.first_name || "") + " " + (member.last_name || "")).trim()

  return (
    <div className="worknest-modal-backdrop">
      <div className="worknest-modal-card max-h-[90vh] max-w-md overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{name.trim() || member.full_name || "Unknown"}</h2>
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

        <button onClick={onClose} className="worknest-primary-btn w-full">
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

  const loadTeam = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await employeeAPI.getTeamMembers()
      const enriched = (Array.isArray(data) ? data : []).map((member) => ({
        ...member,
        full_name: member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown",
        task_count: Number(member.task_count) || 0,
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

  useRealtime(["employees", "teams"], () => {
    void loadTeam({ silent: true })
  })

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
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-blue-700 to-green-500 text-sm font-medium text-white">
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
