import { useEffect, useState } from "react"
import { Folder, Users, Calendar, ChevronRight } from "lucide-react"
import { employeeAPI } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

const formatDate = (value) => {
	if (!value) return "-"
	const d = new Date(value)
	if (Number.isNaN(d.getTime())) return value
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d)
}

const ProjectDetailModal = ({ project, onClose }) => {
	if (!project) return null

	const teamLabel = project.team_name || project.team || "-"

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
				<h2 className="text-xl font-semibold text-slate-900 mb-4">{project.name}</h2>
				<div className="space-y-4 mb-4">
					<div>
						<p className="text-xs text-slate-500 font-medium mb-1">Description</p>
						<p className="text-sm text-slate-900">{project.description || "No description provided."}</p>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-xs text-slate-500 font-medium">Status</p>
							<p className="text-sm font-medium text-slate-900 mt-1">{project.status || "Active"}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500 font-medium">Progress</p>
							<p className="text-sm font-medium text-slate-900 mt-1">{project.progress || 0}%</p>
						</div>
						<div>
							<p className="text-xs text-slate-500 font-medium">Priority</p>
							<p className="text-sm font-medium text-slate-900 mt-1">{project.priority || "Medium"}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500 font-medium">Type</p>
							<p className="text-sm font-medium text-slate-900 mt-1">{project.project_type || "Internal"}</p>
						</div>
							<div>
								<p className="text-xs text-slate-500 font-medium">Team</p>
								<p className="text-sm font-medium text-slate-900 mt-1">{teamLabel}</p>
							</div>
							<div>
								<p className="text-xs text-slate-500 font-medium">Start Date</p>
								<p className="text-sm font-medium text-slate-900 mt-1">{formatDate(project.start_date || project.startDate)}</p>
							</div>
							<div className="col-span-2 mt-1">
								<p className="text-xs text-slate-500 font-medium">Due Date</p>
								<p className="text-sm font-medium text-slate-900 mt-1">{formatDate(project.due_date || project.dueDate)}</p>
							</div>
					</div>
					<div>
						<p className="text-xs text-slate-500 font-medium mb-2">Progress Bar</p>
						<div className="w-full bg-slate-200 rounded-full h-2">
							<div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.progress || 0}%` }}></div>
						</div>
					</div>
				</div>
				<button onClick={onClose} className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700">
					Close
				</button>
			</div>
		</div>
	)
}

const EmployeeMyProjects = () => {
	const [projects, setProjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedProject, setSelectedProject] = useState(null)

	const loadProjects = async ({ silent = false } = {}) => {
		try {
			if (!silent) setLoading(true)
			const data = await employeeAPI.getProjects()
			setProjects(Array.isArray(data) ? data : [])
		} catch {
			setProjects([])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		const timerId = window.setTimeout(() => {
			void loadProjects()
		}, 0)

		return () => window.clearTimeout(timerId)
	}, [])

	useRealtime(["projects", "tasks"], () => {
		void loadProjects({ silent: true })
	})

	if (loading) {
		return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading projects...</div>
	}

	return (
		<div className="min-h-screen bg-slate-50 p-6 lg:p-10">
			<div className="max-w-6xl mx-auto">
				{projects.length === 0 ? (
					<div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
						No projects found.
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{projects.map((project) => {
							const teamLabel = project.team_name || project.team || "No team"
							return (
								<div
									key={project.id}
									className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 cursor-pointer transition shadow-sm"
									onClick={() => setSelectedProject(project)}
								>
									<div className="flex items-start justify-between mb-4">
										<div className="flex items-center gap-3">
											<Folder className="h-5 w-5 text-blue-600" />
											<h3 className="font-semibold text-slate-900">{project.name}</h3>
										</div>
										<ChevronRight className="h-4 w-4 text-slate-400" />
									</div>

									<p className="text-xs text-slate-500 mb-3">{project.description || "No description"}</p>

									<div className="mb-3">
										<div className="flex justify-between items-center mb-1">
											<span className="text-xs text-slate-600">Progress</span>
											<span className="text-xs font-semibold text-slate-900">{project.progress || 0}%</span>
										</div>
										<div className="w-full bg-slate-200 rounded-full h-2">
											<div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.progress || 0}%` }}></div>
										</div>
									</div>

									<div className="flex items-center justify-between text-xs text-slate-600">
										<div className="flex items-center gap-1">
											<Users className="h-3.5 w-3.5" />
											<span>{teamLabel}</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="flex items-center gap-1">
												<Calendar className="h-3.5 w-3.5" />
												<span>{formatDate(project.start_date || project.startDate)}</span>
											</div>
											<div className="flex items-center gap-1">
												<Calendar className="h-3.5 w-3.5" />
												<span>{formatDate(project.due_date || project.dueDate)}</span>
											</div>
										</div>
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>

			<ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />
		</div>
	)
}

export default EmployeeMyProjects
