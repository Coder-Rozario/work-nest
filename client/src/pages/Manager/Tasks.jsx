import { useEffect, useState, useMemo } from "react"
import { CheckSquare, User, Calendar, Plus, Search, FileText, X } from "lucide-react"
import { managerAPI, projectAPI } from "../../services/api"
import { getAssetUrl } from "../../config/env"

const statusColors = {
	Assigned: "bg-slate-100 text-slate-700",
	"In Progress": "bg-blue-50 text-blue-700",
	Submitted: "bg-violet-50 text-violet-700",
	"Under Review": "bg-amber-50 text-amber-700",
	Approved: "bg-green-50 text-green-700",
	"Revision Required": "bg-rose-50 text-rose-700",
}

const priorityColors = {
	High: "bg-red-50 text-red-700",
	Medium: "bg-amber-50 text-amber-700",
	Low: "bg-blue-50 text-blue-700",
}

const inputClassName = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-100"

function formatDate(value) {
	if (!value) return "Not set"
	let date
	if (value instanceof Date) {
		date = value
	} else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		// plain date string like 2026-10-14
		date = new Date(value + 'T00:00:00')
	} else {
		// try parsing ISO or other date strings
		date = new Date(value)
	}

	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const formatFileSize = (bytes) => {
	if (!bytes) return "0 KB"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getEmptyForm() {
	return {
		title: "",
		description: "",
		project_name: "",
		assignee_id: "",
		priority: "Medium",
		due_date: "",
	}
}

const ManagerTasks = () => {
	const [taskList, setTaskList] = useState([])
	const [teamMembers, setTeamMembers] = useState([])
	const [projects, setProjects] = useState([])
	const [loading, setLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState("")
	const [filterStatus, setFilterStatus] = useState("All")
	const [showAddTaskModal, setShowAddTaskModal] = useState(false)
	const [showReviewModal, setShowReviewModal] = useState(false)
	const [selectedTask, setSelectedTask] = useState(null)
	const [reviewComment, setReviewComment] = useState("")
	const [formData, setFormData] = useState(getEmptyForm)
	const [reviewData, setReviewData] = useState(null)

	const loadData = async () => {
		try {
			setLoading(true)
			const [tasks, members, projectsData] = await Promise.all([
				managerAPI.getTeamTasks(),
				managerAPI.getTeam(),
				projectAPI.getProjects(),
			])
			setTaskList(Array.isArray(tasks) ? tasks : [])
			setTeamMembers(Array.isArray(members) ? members : [])
			setProjects(Array.isArray(projectsData) ? projectsData : [])
		} catch {
			setTaskList([])
			setTeamMembers([])
			setProjects([])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		const timerId = window.setTimeout(() => {
			void loadData()
		}, 0)

		return () => window.clearTimeout(timerId)
	}, [])

	const updateForm = (updates) => {
		setFormData((current) => ({ ...current, ...updates }))
	}

	const assigneeName = (task) => {
		const first = task.first_name || ""
		const last = task.last_name || ""
		return task.full_name || (first + " " + last).trim() || "Unassigned"
	}

	const reviewTasks = useMemo(() => {
		return taskList.filter((task) => task.status === "Submitted" || task.status === "Under Review")
	}, [taskList])

	const filteredTasks = useMemo(() => {
		const q = searchTerm.trim().toLowerCase()
		let result = filterStatus === "All" ? taskList : taskList.filter((task) => task.status === filterStatus)
		if (q) {
			result = result.filter((task) => {
				const name = assigneeName(task).toLowerCase()
				return (
					(task.title || "").toLowerCase().includes(q) ||
					(task.project_name || "").toLowerCase().includes(q) ||
					name.includes(q)
				)
			})
		}
		return result
	}, [taskList, filterStatus, searchTerm])

	const handleAddTask = async () => {
		if (!formData.title || !formData.assignee_id) return
		try {
			await managerAPI.createTask({
				title: formData.title,
				description: formData.description,
				project_name: formData.project_name,
				assignee_id: Number(formData.assignee_id),
				priority: formData.priority,
				due_date: formData.due_date,
				status: "Assigned",
			})
			setFormData(getEmptyForm())
			setShowAddTaskModal(false)
			await loadData()
		} catch {
			window.alert("Could not create task. Please try again.")
		}
	}

	const openReviewModal = (task) => {
		if (!task) return
		setSelectedTask({ ...task })
		setReviewComment(task.review_comment || "")
		setReviewData(task)
		setShowReviewModal(true)
	}

	const approveTask = async () => {
		if (!selectedTask) return
		const confirmed = window.confirm("Are you sure you want to approve this work submission?")
		if (!confirmed) return
		try {
			await managerAPI.updateTaskStatus(selectedTask.id, "Approved")
			setShowReviewModal(false)
			setSelectedTask(null)
			setReviewComment("")
			await loadData()
		} catch {
			window.alert("Could not approve task. Please try again.")
		}
	}

	const requestRevision = async () => {
		if (!selectedTask) return
		if (!reviewComment.trim()) {
			window.alert("Please add a revision reason before requesting changes.")
			return
		}
		try {
			await managerAPI.updateTaskStatus(selectedTask.id, "Revision Required")
			setShowReviewModal(false)
			setSelectedTask(null)
			setReviewComment("")
			await loadData()
		} catch {
			window.alert("Could not request revision. Please try again.")
		}
	}

	const stats = useMemo(() => [
		{ label: "Assigned Tasks", value: taskList.filter((t) => t.status === "Assigned").length },
		{ label: "In Progress", value: taskList.filter((t) => t.status === "In Progress").length },
		{ label: "Submitted for Review", value: taskList.filter((t) => ["Submitted", "Under Review"].includes(t.status)).length },
		{ label: "Approved", value: taskList.filter((t) => t.status === "Approved").length },
		{ label: "Revision Required", value: taskList.filter((t) => t.status === "Revision Required").length },
	], [taskList])

	if (loading) {
		return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading tasks...</div>
	}

	return (
		<div className="min-h-screen bg-slate-50 p-6 lg:p-10">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
					{stats.map((item) => (
						<div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<p className="text-xs font-medium text-slate-500">{item.label}</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
						</div>
					))}
				</div>

				<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-6 py-4">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div className="relative w-full max-w-sm">
								<Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
								<input
									type="text"
									placeholder="Search tasks by title, project, or assignee..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<button
								onClick={() => setShowAddTaskModal(true)}
								className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
							>
								<Plus className="h-4 w-4" />
								Add Task
							</button>
						</div>

						<div className="mt-4 flex flex-wrap gap-2">
							{["All", "Assigned", "In Progress", "Submitted", "Under Review", "Approved", "Revision Required"].map((status) => (
								<button
									key={status}
									onClick={() => setFilterStatus(status)}
									className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
										filterStatus === status
											? "bg-blue-600 text-white"
											: "bg-slate-100 text-slate-600 hover:bg-slate-200"
									}`}
								>
									{status}
								</button>
							))}
						</div>
					</div>

					<div className="space-y-4 p-6">
						{filteredTasks.length === 0 ? (
							<p className="py-8 text-center text-sm text-slate-500">No tasks match your filters.</p>
						) : (
							filteredTasks.map((task) => (
								<div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-3">
												<CheckSquare className="h-4 w-4 text-blue-600" />
												<div>
													<p className="text-base font-semibold text-slate-900">{task.title}</p>
													<p className="text-xs text-slate-500">{task.project_name || "No project"}</p>
												</div>
											</div>
											<div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
												<span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {assigneeName(task)}</span>
												<span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {formatDate(task.due_date)}</span>
												<span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Progress {task.progress || 0}%</span>
											</div>
										</div>

										<div className="flex flex-col gap-3 lg:items-end">
											<div className="flex items-center gap-2">
												<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[task.status] || statusColors.Assigned}`}>
													{task.status || "Assigned"}
												</span>
												<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityColors[task.priority] || priorityColors.Medium}`}>
													{task.priority || "Medium"}
												</span>
											</div>
											<div className="flex items-center gap-2">
												{["Submitted", "Under Review", "Revision Required"].includes(task.status) && (
													<button
														onClick={() => openReviewModal(task)}
														className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
													>
														Review Submission
													</button>
												)}
											</div>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-200 px-5 py-4">
						<h2 className="text-sm font-semibold text-slate-900">Submitted for Review</h2>
						<p className="mt-1 text-xs text-slate-500">Tasks waiting for manager action</p>
					</div>
					<div className="divide-y divide-slate-100">
						{reviewTasks.length === 0 ? (
							<p className="px-5 py-4 text-sm text-slate-500">No work submitted for review yet.</p>
						) : (
							reviewTasks.map((task) => (
								<div key={task.id} className="flex items-center justify-between px-5 py-3.5">
									<div>
										<p className="text-sm font-medium text-slate-900">{task.title}</p>
										<p className="text-xs text-slate-500">{assigneeName(task)} · {task.project_name || "No project"}</p>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-xs text-slate-500">{task.progress || 0}%</span>
										<button
											onClick={() => openReviewModal(task)}
											className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											Review Submission
										</button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			{showAddTaskModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="w-[92vw] max-w-2xl rounded-xl bg-white p-4 shadow-2xl sm:p-6">
						<div className="mb-5 flex items-center justify-between">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Create task</p>
								<h2 className="text-xl font-semibold text-slate-900">Add Task</h2>
							</div>
							<button onClick={() => setShowAddTaskModal(false)} className="rounded-full p-2 hover:bg-slate-100">
								<X className="h-4 w-4 text-slate-500" />
							</button>
						</div>

						<div className="space-y-5">
							<div>
								<label className="mb-2 block text-sm font-medium text-slate-700">Task title</label>
								<input
									type="text"
									placeholder="Task title"
									value={formData.title}
									onChange={(e) => updateForm({ title: e.target.value })}
									className={inputClassName}
								/>
							</div>

							<div>
								<label className="mb-2 block text-sm font-medium text-slate-700">Task description</label>
								<textarea
									rows="3"
									placeholder="Task description"
									value={formData.description}
									onChange={(e) => updateForm({ description: e.target.value })}
									className={inputClassName}
								/>
							</div>

							<div>
								<label className="mb-2 block text-sm font-medium text-slate-700">Project</label>
								<select
									value={formData.project_name}
									onChange={(e) => updateForm({ project_name: e.target.value })}
									className={inputClassName}
								>
									<option value="">Select project</option>
									{
										(() => {
											const teamNames = Array.from(new Set((teamMembers || []).map(m => m.team_name).filter(Boolean)));
											const available = (projects || []).filter(p => {
												const pTeam = (p.team_name || p.team || "").toString();
												if (!pTeam) return false;
												const pTeams = pTeam.split(',').map(s => s.trim()).filter(Boolean);
												return pTeams.some(t => teamNames.includes(t));
											});
											return available.map(p => (
												<option key={p.id} value={p.name}>{p.name}</option>
											));
										})()
									}
								</select>
							</div>

							<div>
								<label className="mb-2 block text-sm font-medium text-slate-700">Assign employee</label>
								<select
									value={formData.assignee_id}
									onChange={(e) => updateForm({ assignee_id: e.target.value })}
									className={inputClassName}
								>
									<option value="">Assign to employee</option>
									{teamMembers.filter(m => (m.role || '').toLowerCase() === 'employee').map((m) => (
										<option key={m.id} value={m.id}>
											{m.full_name || ((m.first_name || "") + " " + (m.last_name || "")).trim()}
										</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
								<div>
									<label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
									<select
										value={formData.priority}
										onChange={(e) => updateForm({ priority: e.target.value })}
										className={inputClassName}
									>
										<option value="Low">Low</option>
										<option value="Medium">Medium</option>
										<option value="High">High</option>
									</select>
								</div>

								<div>
									<label className="mb-2 block text-sm font-medium text-slate-700">Due date</label>
									<input
										type="date"
										value={formData.due_date}
										onChange={(e) => updateForm({ due_date: e.target.value })}
										className={inputClassName}
									/>
								</div>
							</div>
						</div>

						<div className="mt-6 flex flex-col gap-3 sm:flex-row">
							<button
								onClick={() => setShowAddTaskModal(false)}
								className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
							>
								Cancel
							</button>
							<button
								onClick={handleAddTask}
								className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
							>
								Create Task
							</button>
						</div>
					</div>
				</div>
			)}

			{showReviewModal && selectedTask && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="w-[94vw] max-w-4xl rounded-xl bg-white p-4 shadow-2xl max-h-[90vh] overflow-y-auto sm:p-6">
						<div className="mb-5 flex items-center justify-between">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Review task</p>
								<h2 className="text-2xl font-semibold text-slate-900">{selectedTask.title}</h2>
							</div>
							<button onClick={() => setShowReviewModal(false)} className="rounded-full p-2 hover:bg-slate-100">
								<X className="h-4 w-4 text-slate-500" />
							</button>
						</div>

						<div className="space-y-5">
							<section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm font-semibold text-slate-900">Task Information</p>
								<div className="mt-3 grid gap-3 md:grid-cols-2">
									<div>
										<p className="text-xs font-medium text-slate-500">Task</p>
										<p className="mt-1 text-sm text-slate-900">{selectedTask.title}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Project</p>
										<p className="mt-1 text-sm text-slate-900">{selectedTask.project_name || "No project"}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Assigned Employee</p>
										<p className="mt-1 text-sm text-slate-900">{assigneeName(selectedTask)}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Priority</p>
										<p className="mt-1 text-sm text-slate-900">{selectedTask.priority || "Medium"}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Due Date</p>
										<p className="mt-1 text-sm text-slate-900">{formatDate(selectedTask.due_date)}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Current Status</p>
										<span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[selectedTask.status] || statusColors.Assigned}`}>
											{selectedTask.status || "Assigned"}
										</span>
									</div>
								</div>
							</section>

							<section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm font-semibold text-slate-900">Task Description</p>
								<p className="mt-2 text-sm leading-6 text-slate-700">
									{selectedTask.description || "No description provided."}
								</p>
							</section>

							<section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm font-semibold text-slate-900">Submission Details</p>
								<div className="mt-3 space-y-3">
									<div>
										<p className="text-xs font-medium text-slate-500">Progress Note</p>
										<p className="mt-1 text-sm text-slate-900">{selectedTask.progress_note || "No progress note yet."}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Work Description</p>
										<p className="mt-1 text-sm text-slate-900">{selectedTask.submission_description || selectedTask.work_description || "No work description submitted."}</p>
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Work URL</p>
										{selectedTask.submission_url || selectedTask.work_url ? (
											<a href={selectedTask.submission_url || selectedTask.work_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-blue-600 underline break-all">
												{selectedTask.submission_url || selectedTask.work_url}
											</a>
										) : (
											<p className="mt-1 text-sm text-slate-500">No work link provided.</p>
										)}
									</div>
									<div>
										<p className="text-xs font-medium text-slate-500">Attachments</p>
										{(() => {
											let files = []
											try {
												if (selectedTask.submission_files) {
													files = typeof selectedTask.submission_files === 'string'
														? JSON.parse(selectedTask.submission_files)
														: selectedTask.submission_files
												}
											} catch (e) {
												files = []
											}
											if (!files || files.length === 0) return <p className="mt-1 text-sm text-slate-500">No attachments submitted.</p>
											return files.map((f, i) => {
												const value = typeof f === 'string' ? f : (f?.url || '')
														const originalName = typeof f === 'object' && f && (f.name || f.originalName) ? (f.name || f.originalName) : (value ? value.split('/').pop() : `attachment-${i + 1}`)
														const downloadUrl = value ? getAssetUrl(value) : ''
														const name = originalName || `attachment-${i + 1}`
														if (!downloadUrl) return null
														return (
															<div key={i} className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2">
																<span className="truncate text-sm text-slate-700">{name}</span>
																<a
																	href={downloadUrl}
																	target="_blank"
																	rel="noreferrer"
																	download={name}
																	className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
																>
																	Download
																</a>
															</div>
														)
											})
										})()}
									</div>
								</div>
							</section>

							<section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<label className="mb-2 block text-sm font-medium text-slate-700">Manager feedback</label>
								<textarea
									rows="4"
									value={reviewComment}
									onChange={(e) => setReviewComment(e.target.value)}
									placeholder="Add your feedback here..."
									className={inputClassName}
								/>

								<div className="mt-4 flex flex-col gap-3 sm:flex-row">
									<button
										onClick={requestRevision}
										className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 font-medium text-white hover:bg-rose-700"
									>
										Request Revision
									</button>
									<button
										onClick={approveTask}
										className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-700"
									>
										Approve Work
									</button>
								</div>
							</section>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default ManagerTasks
