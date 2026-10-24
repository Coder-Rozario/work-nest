import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { managerAPI } from "../../services/api"
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
						<p className="text-xs text-slate-500 font-medium">Email</p>
						<p className="text-sm text-slate-900 break-all">{member.email || "N/A"}</p>
					</div>
					<div>
						<p className="text-xs text-slate-500 font-medium">Team</p>
						<p className="text-sm text-slate-900">{member.team_name || "Not assigned"}</p>
					</div>
					<div>
						<p className="text-xs text-slate-500 font-medium">Role</p>
						<p className="text-sm text-slate-900 capitalize">{member.role || "Employee"}</p>
					</div>
					<div>
						<p className="text-xs text-slate-500 font-medium">Active Tasks</p>
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

const ManagerMyTeam = () => {
	const [members, setMembers] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedMember, setSelectedMember] = useState(null)

	const loadTeam = async ({ silent = false } = {}) => {
		try {
			if (!silent) setLoading(true)
			const data = await managerAPI.getTeamMembers()
			const enriched = (Array.isArray(data) ? data : []).map((m) => ({
				...m,
				full_name: m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Unknown",
				task_count: Number(m.task_count) || 0,
			}))
			setMembers(enriched)
		} catch {
			setMembers([])
		} finally {
			if (!silent) setLoading(false)
		}
	}

	useEffect(() => {
		const timerId = window.setTimeout(() => {
			void loadTeam()
		}, 0)

		return () => window.clearTimeout(timerId)
	}, [])

	useRealtime(["employees", "teams", "tasks"], () => { void loadTeam({ silent: true }) })

	if (loading) {
		return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading team...</div>
	}

	return (
		<div className="min-h-screen bg-slate-50 p-6 lg:p-10">
			<div className="max-w-6xl mx-auto">
				{members.length === 0 ? (
					<div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
						No team members found for your managed team.
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{members.map((member) => {
							const name = member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown"
							const initial = (member.full_name || member.first_name || member.last_name || "?").charAt(0).toUpperCase()
							return (
								<div
									key={member.id}
									className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 cursor-pointer transition shadow-sm"
									onClick={() => setSelectedMember(member)}
								>
									<div className="flex items-start justify-between mb-4">
										<div className="flex items-center gap-3">
											<div className="h-10 w-10 rounded-full bg-linear-to-r from-blue-700 to-green-500 flex items-center justify-center text-white text-sm font-medium">
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

export default ManagerMyTeam
