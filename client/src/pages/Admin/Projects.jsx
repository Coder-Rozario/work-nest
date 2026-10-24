import { useState, useEffect, useCallback } from "react"
import { Plus, Search } from "lucide-react";
import { projectAPI, adminAPI } from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

const AdminProjects = () => {
  const [projectList, setProjectList] = useState([])
  const [teams, setTeams] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team: [],
    startDate: "",
    dueDate: "",
    priority: "Medium",
    projectType: "Internal",
    status: "To Do",
    progress: 0,
  });

  const mapProject = (p) => {
    const rawTeam = p.team_name ?? p.team ?? "";
    const teamValue = Array.isArray(rawTeam) ? rawTeam.join(', ') : rawTeam;
    return {
      ...p,
      manager: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.manager || "-",
      team: teamValue,
      startDate: p.startDate || p.start_date || "",
      dueDate: p.dueDate || p.due_date || "",
      progress: typeof p.progress === "number" ? p.progress : Number(p.progress) || 0,
      priority: p.priority || "Medium",
      project_type: p.project_type || "Internal",
      status: p.status || "To Do",
    };
  };

  const formatProjectDate = (dateValue) => {
    if (!dateValue) return "-";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getProjectTeamLabel = (project) => {
    const teamNames = parseTeamList(project.team);
    if (teamNames.length) return teamNames.join(", ");
    return project.team || "-";
  };

  const fetchProjects = useCallback(async () => {
    try {
      const data = await projectAPI.getProjects();
      setProjectList((data || []).map(mapProject));
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err.message || "Failed to load projects");
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      let teamsData = [];
      try {
        teamsData = await projectAPI.getTeams();
      } catch {
        try {
          teamsData = await adminAPI.getTeams();
        } catch {
          teamsData = [];
        }
      }
      setTeams((teamsData || []).map(t => t.name).filter(Boolean));
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchProjects(), fetchTeams()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchProjects, fetchTeams]);

  useRealtime(['projects', 'teams'], () => {
    void Promise.all([fetchProjects(), fetchTeams()]);
  });

  const filteredProjects = projectList.filter(
    (proj) => {
      return (proj.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((proj.team || "") + "").toLowerCase().includes(searchTerm.toLowerCase())
    }
  );

  const emptyForm = () => ({
    name: "",
    description: "",
    team: [],
    startDate: "",
    dueDate: "",
    priority: "Medium",
    projectType: "Internal",
    status: "To Do",
    progress: 0,
  });

  const handleAddProject = async () => {
    if (!formData.name) return;

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        team_name: Array.isArray(formData.team) && formData.team.length ? formData.team.join(', ') : undefined,
        start_date: formData.startDate || undefined,
        due_date: formData.dueDate || undefined,
        priority: formData.priority || "Medium",
        project_type: formData.projectType || "Internal",
        status: formData.status || "To Do",
        progress: Number(formData.progress) || 0,
      };

      await projectAPI.createProject(payload);
      await fetchProjects();

      setFormData(emptyForm())
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding project:", err);
      alert(err.message || "Failed to add project");
    }
  }

  const handleEditProject = async () => {
    if (!selectedProject || !formData.name) return;

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        team_name: Array.isArray(formData.team) && formData.team.length ? formData.team.join(', ') : undefined,
        start_date: formData.startDate || undefined,
        due_date: formData.dueDate || undefined,
        priority: formData.priority || "Medium",
        project_type: formData.projectType || "Internal",
        status: formData.status || "To Do",
        progress: Number(formData.progress) || 0,
      };

      await projectAPI.updateProject(selectedProject.id, payload);
      await fetchProjects();
      setShowEditModal(false);
      setSelectedProject(null);
      setFormData(emptyForm());
    } catch (err) {
      console.error("Error updating project:", err);
      alert(err.message || "Failed to update project");
    }
  }

  const handleDeleteProject = async (id) => {
    const project = projectList.find((p) => p.id === id)
    const name = project ? project.name : "this project"
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return

    try {
      await projectAPI.deleteProject(id);
      await fetchProjects();
    } catch (err) {
      console.error("Error deleting project:", err);
      alert(err.message || "Failed to delete project");
    }
  }

  const parseTeamList = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== "string") return [];
    return value.split(",").map((team) => team.trim()).filter(Boolean);
  };

  const normalizeTeamName = (value) => String(value || "").trim().toLowerCase();

  const toggleTeamSelection = (teamName) => {
    setFormData((current) => {
      const targetName = normalizeTeamName(teamName);
      const selectedTeams = (current.team || []).filter((team) => normalizeTeamName(team) !== targetName);

      if (selectedTeams.length === (current.team || []).length) {
        selectedTeams.push(teamName);
      }

      return {
        ...current,
        team: selectedTeams,
      };
    });
  };

  const openEditProject = (project) => {
    setSelectedProject(project);
    const toInputDate = (val) => {
      if (!val) return "";
      try {
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return "";
        return d.toISOString().slice(0, 10);
      } catch {
        return "";
      }
    };

    setFormData({
      name: project.name || "",
      description: project.description || "",
      team: parseTeamList(project.team),
      startDate: toInputDate(project.startDate || project.start_date),
      dueDate: toInputDate(project.dueDate || project.due_date),
      priority: project.priority || "Medium",
      projectType: project.project_type || "Internal",
      status: project.status || "To Do",
      progress: Number(project.progress) || 0,
    });
    setShowEditModal(true);
  };

  const statusColors = {
    "To Do": "bg-slate-100 text-slate-600",
    "In Progress": "bg-blue-50 text-blue-700",
    Completed: "bg-green-50 text-green-700",
  }

  if (loading) {
    return <div className="p-6 text-center">Loading projects...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Project
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {proj.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[proj.status] || "bg-slate-100 text-slate-600"}`}
                        >
                          {proj.status || "To Do"}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600">
                        {proj.description || "No description"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>Start: {formatProjectDate(proj.startDate || proj.start_date)}</span>
                        <span>Team: {getProjectTeamLabel(proj)}</span>
                        <span>End: {formatProjectDate(proj.dueDate || proj.due_date)}</span>
                        <span>Priority: {proj.priority || "Medium"}</span>
                        <span>Type: {proj.project_type || "Internal"}</span>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            Progress
                          </span>
                          <span className="text-slate-600">
                            {proj.progress}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => openEditProject(proj)}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                No projects found
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Add Project
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
                <input
                  type="text"
                  placeholder="Project name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description <span className="text-xs text-slate-400">(optional)</span></label>
                <textarea
                  placeholder="Description"
                  rows="3"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Teams</label>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  {teams.length === 0 ? (
                    <p className="text-sm text-slate-500">No teams available</p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => {
                        const checked = (formData.team || []).some((selectedTeam) => normalizeTeamName(selectedTeam) === normalizeTeamName(team));

                        return (
                          <label key={team} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTeamSelection(team)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{team}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Project Type</label>
                  <select
                    value={formData.projectType}
                    onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Internal">Internal</option>
                    <option value="Client">Client</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Research">Research</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Edit Project
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
                <input
                  type="text"
                  placeholder="Project name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description <span className="text-xs text-slate-400">(optional)</span></label>
                <textarea
                  placeholder="Description"
                  rows="3"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Teams</label>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  {teams.length === 0 ? (
                    <p className="text-sm text-slate-500">No teams available</p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => {
                        const checked = (formData.team || []).some((selectedTeam) => normalizeTeamName(selectedTeam) === normalizeTeamName(team));

                        return (
                          <label key={team} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTeamSelection(team)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{team}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Project Type</label>
                  <select
                    value={formData.projectType}
                    onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Internal">Internal</option>
                    <option value="Client">Client</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Research">Research</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditProject}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
};

export default AdminProjects;
