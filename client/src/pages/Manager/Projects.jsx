import { useEffect, useState } from "react"
import { Folder, Users, Calendar, ChevronRight } from "lucide-react"
import { projectAPI } from "../../services/api"

const formatDate = (value) => {
	if (!value) return "-"
	const d = new Date(value)
	if (Number.isNaN(d.getTime())) return value
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d)
}

const ProjectDetailModal = ({ project, onClose, onUpdated }) => {
	if (!project) return null

	const teamLabel = project.team_name || project.team || "-"
	const [status, setStatus] = useState(project.status || "To Do")
	const [progress, setProgress] = useState(Number(project.progress) || 0)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		setStatus(project.status || "To Do")
		setProgress(Number(project.progress) || 0)
	}, [project])

	const handleSave = async () => {
		try {
			setSaving(true)
			await projectAPI.updateProject(project.id, { status, progress })
			if (typeof onUpdated === 'function') await onUpdated()
			onClose()
		} catch (err) {
			console.error('Failed to update project:', err)
			alert(err.message || 'Failed to update project')
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
				<h2 className="text-xl font-semibold text-slate-900 mb-4">{project.name}</h2>
				<div className="space-y-3 mb-4">
					<div>
						<p className="text-xs text-slate-500 font-medium">Description</p>
						<p className="text-sm text-slate-900 mt-1">{project.description || "No description provided."}</p>
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs">
						<div>
							<p className="text-slate-500 font-medium">Created By</p>
							<p className="text-slate-900">
								{project.full_name || (project.first_name ? `${project.first_name} ${project.last_name || ""}` : "") || "Unknown"}
							</p>
						</div>
						<div>
							<p className="text-slate-500 font-medium">Priority</p>
							<p className="text-slate-900 font-medium">{project.priority || "Medium"}</p>
						</div>
						<div>
							<p className="text-slate-500 font-medium">Type</p>
							<p className="text-slate-900 font-medium">{project.project_type || "Internal"}</p>
						</div>
						<div>
								<p className="text-slate-500 font-medium">Start Date</p>
								<p className="text-slate-900 font-medium">{formatDate(project.start_date || project.startDate)}</p>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs mt-1">
						<div>
							<p className="text-slate-500 font-medium">Due Date</p>
							<p className="text-slate-900 font-medium">{formatDate(project.due_date || project.dueDate)}</p>
						</div>
						<div />
					</div>

					<div>
						<label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
						<select
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="To Do">To Do</option>
							<option value="In Progress">In Progress</option>
							<option value="Completed">Completed</option>
						</select>
					</div>

					<div>
						<div className="mb-1 flex items-center justify-between text-xs">
							<span className="font-medium text-slate-700">Progress</span>
							<span className="text-slate-600">{progress}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="100"
							value={progress}
							onChange={(e) => setProgress(Number(e.target.value))}
							className="w-full accent-blue-600"
						/>
						<div className="mt-2 w-full bg-slate-200 rounded-full h-2">
							<div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
						</div>
					</div>
				</div>

				<div className="flex gap-3">
					<button onClick={onClose} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
					<button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">{saving ? 'Saving...' : 'Save'}</button>
				</div>
			</div>
		</div>
	)
}

const ManagerProjects = () => {
	const [projects, setProjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedProject, setSelectedProject] = useState(null)

	const loadProjects = async () => {
		try {
			setLoading(true)
			const data = await projectAPI.getProjects()
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

	const getBadgeClass = (status) => {
		if (status === "In Progress" || status === "Active") return "bg-blue-50 text-blue-700"
		if (status === "Pending" || status === "To Do") return "bg-slate-100 text-slate-600"
		if (status === "Completed" || status === "Done") return "bg-green-50 text-green-700"
		return "bg-slate-100 text-slate-600"
	}

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

									<div className="mb-4">
										<div className="flex justify-between items-center mb-1">
											<span className="text-xs text-slate-600">Progress</span>
											<span className="text-xs font-semibold text-slate-900">{project.progress || 0}%</span>
										</div>
										<div className="w-full bg-slate-200 rounded-full h-2">
											<div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.progress || 0}%` }}></div>
										</div>
									</div>

									<div className="flex items-center justify-between text-xs text-slate-600 mb-3">
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

									<span className={`text-xs font-medium px-2 py-1 rounded-full ${getBadgeClass(project.status)}`}>
										{project.status || "Active"}
									</span>
								</div>
							)
						})}
					</div>
				)}
			</div>

			<ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onUpdated={loadProjects} />
		</div>
	)
}

export default ManagerProjects
