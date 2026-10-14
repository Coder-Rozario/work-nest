import { useState, useMemo, useEffect } from "react";
import { Plus, Users, Search } from "lucide-react";
import { adminAPI, projectAPI } from "../../services/api";

const mapTeam = (t) => ({
  ...t,
  name: t.name || "Untitled",
  leader: t.leader || "",
  members: typeof t.member_count === "number" ? t.member_count : (t.members || 0),
  description: t.description || "",
  activeProjects: typeof t.activeProjects === "number" ? t.activeProjects : 0,
  status: t.status || "Active",
});

function getEmptyForm() {
  return { name: "", description: "", leader: "", leaderId: "", members: 1 }
}

const AdminTeams = () => {
  const [teamList, setTeamList] = useState([])
  const [employeeList, setEmployeeList] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm())
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeams = async () => {
    try {
      const data = await projectAPI.getTeams();
      setTeamList((data || []).map(mapTeam));
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError(err.message || "Failed to load teams");
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await adminAPI.getEmployees();
      setEmployeeList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployeeList([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchTeams(), fetchEmployees()]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const groupedEmployees = useMemo(() => {
    const managers = employeeList
      .filter((person) => String(person.role || "").toLowerCase() === "manager")
      .map((person) => ({
        value: String(person.id),
        label: person.full_name || `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.email || "Manager",
      }));

    return { managers };
  }, [employeeList]);

  const filteredTeams = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return teamList
    return teamList.filter((t) =>
      (t.name || "").toLowerCase().includes(q) || (t.leader || "").toLowerCase().includes(q)
    )
  }, [teamList, searchTerm])

  const updateForm = (updates) => {
    setFormData((current) => ({ ...current, ...updates }))
  }

  const teamToPayload = (form) => {
    const payload = {
      name: form.name,
      description: form.description || "",
      leader_id: form.leaderId || null,
      member_count: typeof form.members === "number" ? form.members : (parseInt(form.members, 10) || 1),
    };
    return payload;
  };

  const addTeam = async () => {
    if (!formData.name) return

    try {
      const payload = teamToPayload(formData);
      await projectAPI.createTeam(payload);
      await fetchTeams();
      setFormData(getEmptyForm())
      setShowAddModal(false)
    } catch (err) {
      console.error("Error creating team:", err);
      alert(err.message || "Failed to create team");
    }
  }

  const editTeam = async () => {
    if (!selectedTeam || !formData.name) return

    try {
      const payload = teamToPayload(formData);
      await projectAPI.updateTeam(selectedTeam.id, payload);
      await fetchTeams();
      setShowEditModal(false)
      setSelectedTeam(null)
    } catch (err) {
      console.error("Error updating team:", err);
      alert(err.message || "Failed to update team");
    }
  }

  const deleteTeam = async (id) => {
    const team = teamList.find((t) => t.id === id)
    const teamName = team ? team.name : "this team"
    if (!window.confirm(`Are you sure you want to delete "${teamName}"? This cannot be undone.`)) return

    try {
      await projectAPI.deleteTeam(id);
      await fetchTeams();
    } catch (err) {
      console.error("Error deleting team:", err);
      alert(err.message || "Failed to delete team");
    }
  }

  const openEditModal = (team) => {
    const matchedLeader = employeeList.find((person) => {
      const savedName = person.full_name || `${person.first_name || ""} ${person.last_name || ""}`.trim();
      return String(person.id) === String(team.leader_id || "") || savedName === String(team.leader || "").trim();
    });

    setSelectedTeam(team)
    setFormData({
      name: team.name || "",
      description: team.description || "",
      leader: team.leader || "",
      leaderId: matchedLeader ? String(matchedLeader.id) : "",
      members: team.members || 1,
    })
    setShowEditModal(true)
  }

  const handleLeaderSelect = (selectedId) => {
    const person = employeeList.find((emp) => String(emp.id) === String(selectedId));
    const fullName = person ? (person.full_name || `${person.first_name || ""} ${person.last_name || ""}`.trim()) : "";
    updateForm({ leaderId: selectedId || "", leader: fullName || "" });
  };

  const currentLeader = useMemo(() => {
    if (!selectedTeam) return null;

    const leaderId = selectedTeam.leader_id || selectedTeam.leaderId;
    if (leaderId) {
      const match = employeeList.find((person) => String(person.id) === String(leaderId));
      if (match) return match;
    }

    const leaderName = String(selectedTeam.leader || "").trim();
    if (!leaderName) return null;

    return employeeList.find((person) => {
      const name = person.full_name || `${person.first_name || ""} ${person.last_name || ""}`.trim();
      return name.toLowerCase() === leaderName.toLowerCase();
    }) || { first_name: leaderName, last_name: "", position: "Manager", role: "manager" };
  }, [employeeList, selectedTeam]);

  const currentMembers = useMemo(() => {
    if (!selectedTeam) return [];

    const leaderId = selectedTeam.leader_id || selectedTeam.leaderId;

    return employeeList.filter((person) => {
      const teamId = person.team_id ?? person.teamId;
      const isInTeam = String(teamId) === String(selectedTeam.id);
      const isLeader = String(person.id) === String(leaderId || "");
      return isInTeam && !isLeader && String(person.role || "").toLowerCase() !== "admin";
    });
  }, [employeeList, selectedTeam]);

  const availableMembers = useMemo(() => {
    if (!selectedTeam) return [];

    const leaderId = selectedTeam.leader_id || selectedTeam.leaderId;

    return employeeList.filter((person) => {
      const teamId = person.team_id ?? person.teamId;
      const isInTeam = String(teamId) === String(selectedTeam.id);
      const isLeader = String(person.id) === String(leaderId || "");
      const isAdmin = String(person.role || "").toLowerCase() === "admin";
      return !isInTeam && !isLeader && !isAdmin;
    });
  }, [employeeList, selectedTeam]);

  const handleRemoveMember = async (member) => {
    if (!member || !selectedTeam) return;

    try {
      await adminAPI.updateEmployee(member.id, {
        first_name: member.first_name || "",
        last_name: member.last_name || "",
        email: member.email || "",
        role: member.role || "employee",
        position: member.position || "",
        team_id: null,
        is_active: member.is_active !== undefined ? member.is_active : 1,
      });

      await Promise.all([fetchEmployees(), fetchTeams()]);
    } catch (err) {
      console.error("Error removing member:", err);
      alert(err.message || "Failed to remove team member.");
    }
  };

  const handleAssignMember = async (memberId) => {
    if (!memberId || !selectedTeam) return;

    const member = employeeList.find((person) => String(person.id) === String(memberId));
    if (!member) return;

    try {
      await adminAPI.updateEmployee(member.id, {
        first_name: member.first_name || "",
        last_name: member.last_name || "",
        email: member.email || "",
        role: member.role || "employee",
        position: member.position || "",
        team_id: selectedTeam.id,
        is_active: member.is_active !== undefined ? member.is_active : 1,
      });

      await Promise.all([fetchEmployees(), fetchTeams()]);
    } catch (err) {
      console.error("Error assigning member:", err);
      alert(err.message || "Failed to assign employee to the team.");
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading teams...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search teams by name or leader..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Team
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                No teams match your search.
              </div>
            ) : (
              filteredTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-lg border border-slate-200 p-5 transition hover:shadow-sm"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{team.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {team.leader ? `Led by ${team.leader}` : (team.description || "No description")}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      {team.status}
                    </span>
                  </div>

                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4" />
                      <span>{team.members} members</span>
                    </div>
                    <div className="text-slate-600">
                      {team.activeProjects} active projects
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 pt-4">
                    <button
                      onClick={() => openEditModal(team)}
                      className="flex-1 rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTeam(team.id)}
                      className="flex-1 rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-7 max-h-[90vh] overflow-hidden">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Create Team
            </h2>
            <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)] pr-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Development"
                  value={formData.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team Leader 
                </label>
                <select
                  value={formData.leaderId || ""}
                  onChange={(event) => handleLeaderSelect(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a team leader</option>
                  {groupedEmployees.managers.length > 0 && (
                    <optgroup label="Managers">
                      {groupedEmployees.managers.map((person) => (
                        <option key={person.value} value={person.value}>{person.label}</option>
                      ))}
                    </optgroup>
                  )}

                  {groupedEmployees.managers.length === 0 && (
                    <option value="" disabled>No managers available</option>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description <span className="text-xs text-slate-400">(optional)</span>
                </label>
                <textarea
                  placeholder="e.g. This team will handle frontend development."
                  rows="2"
                  value={formData.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                onClick={addTeam}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white p-6 max-h-[95vh] overflow-hidden">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Edit Team
            </h2>
            <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)] pr-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Development"
                  value={formData.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team Leader <span className="text-xs text-slate-400">(optional)</span>
                </label>
                <select
                  value={formData.leaderId || ""}
                  onChange={(event) => handleLeaderSelect(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a team leader</option>
                  {groupedEmployees.managers.length > 0 && (
                    <optgroup label="Managers">
                      {groupedEmployees.managers.map((person) => (
                        <option key={person.value} value={person.value}>{person.label}</option>
                      ))}
                    </optgroup>
                  )}

                  {groupedEmployees.managers.length === 0 && (
                    <option value="" disabled>No managers available</option>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description <span className="text-xs text-slate-400">(optional)</span>
                </label>
                <textarea
                  placeholder="e.g. This team will handle frontend development."
                  rows="2"
                  value={formData.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Team Leader</h3>
                {currentLeader ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {currentLeader.full_name || `${currentLeader.first_name || ""} ${currentLeader.last_name || ""}`.trim() || currentLeader.email || "Unnamed leader"}
                      </p>
                      <p className="text-xs text-slate-500">{currentLeader.position || "Manager"}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Leader
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No team leader assigned.</p>
                )}

                <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700">Team Members</h3>
                <div className="space-y-2">
                  {currentMembers.length > 0 ? (
                    currentMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.email || "Unnamed member"}
                          </p>
                          <p className="text-xs text-slate-500">{member.position || "Employee"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
                          >
                            Remove
                          </button>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {String(member.role || "employee").charAt(0).toUpperCase() + String(member.role || "employee").slice(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No members assigned to this team yet.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Assign Members
                </label>
                <div className="flex flex-col gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Available Members</h4>
                    {availableMembers.length > 0 ? (
                      availableMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.email || "Unnamed member"}
                            </p>
                            <p className="text-xs text-slate-500">{member.position || "Employee"}</p>
                          </div>
                          <button
                            onClick={() => handleAssignMember(member.id)}
                            className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-200"
                          >
                            Assign
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No available members to assign.</p>
                    )}
                  </div>
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
                onClick={editTeam}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
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

export default AdminTeams;
