import { useEffect, useState, useMemo, useCallback } from "react"
import { CheckSquare, Search, Calendar, FileText, X, Paperclip } from "lucide-react"
import { employeeAPI } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

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
    date = new Date(value + 'T00:00:00')
  } else {
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

const isValidUrl = (value) => {
  if (!value) return true
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol)
  } catch {
    return false
  }
}

const EmployeeMyTasks = () => {
  const [taskList, setTaskList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [selectedTask, setSelectedTask] = useState(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [progressForm, setProgressForm] = useState({ percentage: 0, note: "" })
  const [submitForm, setSubmitForm] = useState({ workDescription: "", files: [], workUrl: "" })

  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await employeeAPI.getTasks()
      setTaskList(Array.isArray(data) ? data : [])
    } catch {
      setTaskList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTasks()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadTasks])

  useRealtime("tasks", () => {
    void loadTasks({ silent: true })
  })

  const filteredTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    let result = selectedStatus === "All" ? taskList : taskList.filter((task) => task.status === selectedStatus)
    if (q) {
      result = result.filter((task) =>
        (task.title || "").toLowerCase().includes(q) ||
        (task.project_name || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [taskList, selectedStatus, searchTerm])

  const openProgressModal = (task) => {
    setSelectedTask(task)
    setProgressForm({ percentage: task.progress || 0, note: task.progress_note || "" })
    setShowProgressModal(true)
  }

  const openSubmitModal = (task) => {
    setSelectedTask(task)
    setSubmitForm({
      workDescription: task.submission_description || task.work_description || "",
      files: [],
      workUrl: task.submission_url || task.work_url || "",
    })
    setUploadError("")
    setShowSubmitModal(true)
  }

  const saveProgress = async () => {
    if (!selectedTask) return
    try {
      await employeeAPI.updateTaskProgress(selectedTask.id, {
        progress: Number(progressForm.percentage),
        note: progressForm.note,
      })
      setShowProgressModal(false)
      setSelectedTask(null)
      await loadTasks()
    } catch {
      window.alert("Could not update progress. Please try again.")
    }
  }

  const handleFileSelection = (event) => {
    const fileList = Array.from(event.target.files || [])
    if (fileList.length === 0) return

    const mergedFiles = [...(submitForm.files || []), ...fileList]

    if (mergedFiles.length > 2) {
      setUploadError("You can attach up to 2 files only.")
      return
    }

    setUploadError("")
    setSubmitForm((prev) => ({ ...prev, files: mergedFiles }))
    event.target.value = ""
  }

  const removeFile = (fileIndex) => {
    setSubmitForm((prev) => ({ ...prev, files: prev.files.filter((_, index) => index !== fileIndex) }))
  }

  const submitWork = async () => {
    if (!selectedTask) return
    if (!submitForm.workDescription.trim()) {
      window.alert("Work Description is required before submitting.")
      return
    }
    if (submitForm.files.length > 2) {
      window.alert("You can attach up to 2 files only.")
      return
    }
    if (!isValidUrl(submitForm.workUrl)) {
      window.alert("Please enter a valid URL or leave the field empty.")
      return
    }
    try {
      const formData = new FormData()
      formData.append('work_description', submitForm.workDescription)
      formData.append('work_url', submitForm.workUrl || '')
      ;(submitForm.files || []).forEach((f) => {
        if (f instanceof File) {
          formData.append('files', f)
        }
      })

      await employeeAPI.submitTask(selectedTask.id, formData, true)

      setTaskList((prev) => prev.map((task) =>
        task.id === selectedTask.id
          ? { ...task, progress: 100, status: 'Submitted', submission_description: submitForm.workDescription, submission_url: submitForm.workUrl || '' }
          : task
      ))
      setSelectedTask((prev) => prev ? { ...prev, progress: 100, status: 'Submitted', submission_description: submitForm.workDescription, submission_url: submitForm.workUrl || '' } : prev)
      setShowSubmitModal(false)
      setSelectedTask(null)
      setSubmitForm({ workDescription: "", files: [], workUrl: "" })
      await loadTasks()
    } catch (err) {
      console.error('Submit error', err)
      window.alert("Could not submit work. Please try again.")
    }
  }

  const statusOptions = ["All", "Assigned", "In Progress", "Submitted", "Under Review", "Approved", "Revision Required"]

  const totalStats = useMemo(() => [
    { label: "Assigned Tasks", value: taskList.filter((t) => t.status === "Assigned").length },
    { label: "In Progress", value: taskList.filter((t) => t.status === "In Progress").length },
    { label: "Submitted", value: taskList.filter((t) => t.status === "Submitted").length },
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
          {totalStats.map((item) => (
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
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    selectedStatus === status ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">No tasks match your filters.</div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-500">{task.project_name || "No project"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(task.due_date)}</span>
                        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {task.progress || 0}%</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[task.status] || statusColors.Assigned}`}>
                          {task.status || "Assigned"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityColors[task.priority] || priorityColors.Medium}`}>
                          {task.priority || "Medium"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true) }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View Task
                        </button>
                        {task.status !== "Submitted" && task.status !== "Under Review" && task.status !== "Approved" && (
                          <button
                            onClick={() => openProgressModal(task)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Update Progress
                          </button>
                        )}
                        {task.status !== "Submitted" && task.status !== "Under Review" && task.status !== "Approved" && task.status !== "Revision Required" && (
                          <button
                            onClick={() => openSubmitModal(task)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            Submit Work
                          </button>
                        )}
                        {task.status === "Revision Required" && (
                          <button
                            onClick={() => openSubmitModal(task)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            Resubmit Work
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
      </div>

      {showTaskDetailModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">{selectedTask.title}</h2>
              <button onClick={() => setShowTaskDetailModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">Project</p>
                  <p className="mt-1 text-sm text-slate-900">{selectedTask.project_name || "No project"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Priority</p>
                  <p className="mt-1 text-sm text-slate-900">{selectedTask.priority || "Medium"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Assigned Date</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(selectedTask.created_at)}</p>
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
                <div>
                  <p className="text-xs font-medium text-slate-500">Progress</p>
                  <p className="mt-1 text-sm text-slate-900">{selectedTask.progress || 0}%</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Description</p>
                <p className="mt-1 text-sm text-slate-700">{selectedTask.description || "No description provided."}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Progress Note</p>
                <p className="mt-1 text-sm text-slate-700">{selectedTask.progress_note || "No progress note yet."}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Work Progress</p>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${selectedTask.progress || 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-600">{selectedTask.progress || 0}% complete</p>
              </div>

              {(selectedTask.submission_description || selectedTask.manager_feedback || selectedTask.review_comment) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submission &amp; Review</p>
                  {selectedTask.submission_description && (
                    <>
                      <p className="mt-3 text-xs font-medium text-slate-500">Work Description</p>
                      <p className="mt-1 text-sm text-slate-700">{selectedTask.submission_description}</p>
                    </>
                  )}
                  {selectedTask.submission_url && (
                    <>
                      <p className="mt-4 text-xs font-medium text-slate-500">Online Work</p>
                      <a href={selectedTask.submission_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-blue-600 underline break-all">
                        {selectedTask.submission_url}
                      </a>
                    </>
                  )}
                  {(selectedTask.manager_feedback || selectedTask.review_comment) && (
                    <>
                      <p className="mt-4 text-xs font-medium text-slate-500">Manager Feedback</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {selectedTask.manager_feedback || selectedTask.review_comment || "No feedback yet."}
                      </p>
                    </>
                  )}
                  {selectedTask.submission_files && (
                    <>
                      <p className="mt-4 text-xs font-medium text-slate-500">Attachments</p>
                      {(() => {
                        let files
                        try {
                          files = typeof selectedTask.submission_files === 'string' && selectedTask.submission_files ? JSON.parse(selectedTask.submission_files) : selectedTask.submission_files || []
                        } catch {
                          files = []
                        }
                        if (!files || files.length === 0) return <p className="mt-1 text-sm text-slate-500">No attachments submitted.</p>
                        return files.map((f, i) => (
                          <div key={i} className="mt-1">
                            <a href={f} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline break-all">{(f && typeof f === 'string') ? f.split('/').pop() : `attachment-${i+1}`}</a>
                          </div>
                        ))
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showProgressModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[92vw] max-h-[90vh] max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Update task</p>
                <h2 className="text-xl font-semibold text-slate-900">Progress Update</h2>
              </div>
              <button onClick={() => setShowProgressModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Progress ({progressForm.percentage}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressForm.percentage}
                  onChange={(e) => setProgressForm({ ...progressForm, percentage: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progressForm.percentage}%` }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Progress note</label>
                <textarea
                  rows="4"
                  value={progressForm.note}
                  onChange={(e) => setProgressForm({ ...progressForm, note: e.target.value })}
                  placeholder="Describe the progress you made."
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowProgressModal(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveProgress}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[94vw] max-w-2xl rounded-xl bg-white p-4 shadow-2xl max-h-[90vh] overflow-y-auto sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Submit task</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedTask.status === "Revision Required" ? "Resubmit Work" : "Submit Work"}
                </h2>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Task</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selectedTask.title}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Work Description</label>
                <textarea
                  rows="4"
                  placeholder="Briefly describe what you completed..."
                  value={submitForm.workDescription}
                  onChange={(e) => setSubmitForm({ ...submitForm, workDescription: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Supporting Documents</p>
                <p className="mt-1 text-xs text-slate-500">Maximum 2 files per submission.</p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
                  <Paperclip className="h-4 w-4" />
                  Choose File
                  <input type="file" className="hidden" multiple onChange={handleFileSelection} />
                </label>

                {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}

                {submitForm.files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {submitForm.files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500">{file.type} · {formatFileSize(file.size)}</p>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Online Work URL (Optional)</label>
                <input
                  type="url"
                  value={submitForm.workUrl}
                  onChange={(e) => setSubmitForm({ ...submitForm, workUrl: e.target.value })}
                  placeholder="https://github.com/example/project"
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitWork}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"
              >
                Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeMyTasks
