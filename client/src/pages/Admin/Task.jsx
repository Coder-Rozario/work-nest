import { useState, useEffect } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { adminAPI, managerAPI, projectAPI, taskAPI } from "../../services/api";

const mapTask = (t) => ({
  ...t,
  title: t.title || "Untitled Task",
  project: t.project_name || t.project || "-",
  assignee: t.full_name || [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || t.assignee || "Unassigned",
  priority: t.priority || "Medium",
  dueDate: t.due_date || t.dueDate || "-",
  status: t.status || "Assigned",
});

const AdminTask = () => {
  const [taskList, setTaskList] = useState([])
  const [projects, setProjects] = useState([])
  const [employees, setEmployees] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    project: "",
    project_name: "",
    assignee: "",
    assignee_id: "",
    priority: "Medium",
    dueDate: "",
    due_date: "",
    status: "Assigned",
  });

  const fetchTasks = async () => {
    try {
      const data = await adminAPI.getTasks();
      setTaskList((data || []).map(mapTask));
    } catch (err) {
      try {
        const data2 = await managerAPI.getTeamTasks();
        setTaskList((data2 || []).map(mapTask));
      } catch (err2) {
        console.error("Error fetching tasks:", err, err2);
        setError(err.message || err2.message || "Failed to load tasks");
      }
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await projectAPI.getProjects();
      setProjects((data || []).map(p => ({
        id: p.id,
        name: p.name,
      })).filter(p => p.name));
    } catch (err) {
      console.error("Error fetching projects:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      let data = [];
      try {
        data = await managerAPI.getTeam();
      } catch {
        try {
          data = await adminAPI.getEmployees();
        } catch {
          data = [];
        }
      }
      setEmployees((data || []).map(e => ({
        id: e.id,
        name: e.full_name || [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || e.name || "Unknown",
      })).filter(e => e.id));
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchTasks(), fetchProjects(), fetchEmployees()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredTasks = taskList.filter((task) => {
    return (task.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (task.project || "").toLowerCase().includes(searchTerm.toLowerCase())
  });

  const handleAddTask = async () => {
    if (!formData.title || !formData.project || !formData.assignee_id) {
      if (!formData.title) return;
    }

    try {
      const payload = {
        title: formData.title,
        project_name: formData.project || undefined,
        project: formData.project || undefined,
        assignee_id: formData.assignee_id || undefined,
        assignee: formData.assignee || undefined,
        priority: formData.priority || "Medium",
        due_date: formData.dueDate || undefined,
        status: formData.status || "Assigned",
      };

      await managerAPI.createTask(payload);
      await fetchTasks();

      setFormData({
        title: "",
        project: "",
        project_name: "",
        assignee: "",
        assignee_id: "",
        priority: "Medium",
        dueDate: "",
        due_date: "",
        status: "Assigned",
      })
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding task:", err);
      alert(err.message || "Failed to add task");
    }
  }

  const handleEditTask = async () => {
    if (!selectedTask) return;

    try {
      if (selectedTask.status !== formData.status) {
        await managerAPI.updateTaskStatus(selectedTask.id, formData.status);
      }
      await fetchTasks();
      setShowEditModal(false)
      setSelectedTask(null);
    } catch (err) {
      console.error("Error updating task:", err);
      alert(err.message || "Failed to update task");
    }
  }

  const handleDeleteTask = async (id) => {
    const task = taskList.find((t) => t.id === id)
    const title = task ? task.title : "this task"
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return

    try {
      await taskAPI.deleteTask(id);
      await fetchTasks();
    } catch (err) {
      console.error("Error deleting task:", err);
      alert(err.message || "Failed to delete task");
    }
  }

  const openEditModal = (task) => {
    setSelectedTask(task)
    setFormData({
      title: task.title || "",
      project: task.project || "",
      project_name: task.project || "",
      assignee: task.assignee || "",
      assignee_id: "",
      priority: task.priority || "Medium",
      dueDate: task.dueDate === "-" ? "" : (task.dueDate || ""),
      due_date: task.dueDate === "-" ? "" : (task.dueDate || ""),
      status: task.status || "Assigned",
    });
    setShowEditModal(true);
  }

  const priorityColors = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-blue-50 text-blue-700",
  };

  const statusColors = {
    "To Do": "bg-slate-100 text-slate-600",
    Assigned: "bg-slate-100 text-slate-700",
    "In Progress": "bg-blue-50 text-blue-700",
    Submitted: "bg-violet-50 text-violet-700",
    "Revision Required": "bg-rose-50 text-rose-700",
    Approved: "bg-green-50 text-green-700",
    Completed: "bg-green-50 text-green-700",
  }

  if (loading) {
    return <div className="p-6 text-center">Loading tasks...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Task
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Project
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Assigned To
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Priority
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Due Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {task.title}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {task.project}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {task.assignee}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityColors[task.priority] || priorityColors.Medium}`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[task.status] || "bg-slate-100 text-slate-600"}`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {task.dueDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(task)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No tasks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Add Task
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Task Title</label>
                <input
                  type="text"
                  placeholder="Task Title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select
                  value={formData.project}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, project: val, project_name: val });
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assignee</label>
                <select
                  value={formData.assignee_id}
                  onChange={(e) => {
                    const selected = employees.find(emp => String(emp.id) === String(e.target.value));
                    setFormData({
                      ...formData,
                      assignee_id: e.target.value,
                      assignee: selected ? selected.name : "",
                    });
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Assignee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value, due_date: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Revision Required">Revision Required</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Edit Task
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  value={formData.title}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <input
                  type="text"
                  value={formData.project}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                <input
                  type="text"
                  value={formData.assignee}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="text"
                  value={formData.dueDate}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Revision Required">Revision Required</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTask;
