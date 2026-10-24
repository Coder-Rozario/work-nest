import { useState, useEffect } from "react"
import { Plus, Trash2, Search } from "lucide-react";
import { adminAPI } from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

const roles = ["Manager", "Employee", "Admin"];

const splitName = (fullName) => {
  const parts = (fullName || "").trim().split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";
  return { first_name, last_name };
};

const normalizeRoleValue = (value) => String(value || '').trim().toLowerCase();
const formatRoleLabel = (value) => {
  const normalized = normalizeRoleValue(value);
  if (!normalized) return 'Employee';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const mapEmployee = (emp) => {
  const { first_name, last_name } = emp;
  const name = emp.full_name || [first_name, last_name].filter(Boolean).join(" ") || emp.name || "Unknown";
  return {
    ...emp,
    name,
    role: formatRoleLabel(emp.role),
    team: emp.team_name || emp.team || "-",
    team_id: emp.team_id || null,
    status: emp.is_active === 1 || emp.is_active === true ? "Active" : "Inactive",
    is_active: emp.is_active,
  };
};

const getEmptyForm = () => ({ name: "", email: "", role: "Employee", team_id: "", position: "", is_active: 1, password: "" });

const EmployeesAndRoles = () => {
  const [employeeList, setEmployeeList] = useState([])
  const [teams, setTeams] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployees = async () => {
    try {
      const data = await adminAPI.getEmployees();
      setEmployeeList((data || []).map(mapEmployee));
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err.message || "Failed to load employees");
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await adminAPI.getTeams();
      setTeams((data || []).map(t => ({ id: t.id, name: t.name })).filter(t => t.name));
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchEmployees(), fetchTeams()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useRealtime(['employees', 'teams'], () => {
    void Promise.all([fetchEmployees(), fetchTeams()]);
  });

  const filteredEmployees = employeeList.filter((employee) => {
    const searchValue = searchTerm.toLowerCase()
    return (
      (employee.name || "").toLowerCase().includes(searchValue) ||
      (employee.email || "").toLowerCase().includes(searchValue)
    );
  });

  const updateForm = (updates) => setFormData((current) => ({ ...current, ...updates }));

  const employeeToPayload = (form) => {
    const { first_name, last_name } = splitName(form.name);
    return {
      full_name: (form.name || '').trim(),
      first_name,
      last_name,
      email: String(form.email || '').trim().toLowerCase(),
      role: normalizeRoleValue(form.role),
      position: form.position,
      team_id: form.team_id ? Number(form.team_id) : null,
      is_active: form.is_active ?? 1,
      password: form.password ? String(form.password).trim() : "",
    };
  };

  const addEmployee = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('Password is required. Please enter a password before adding the employee.');
      return;
    }

    try {
      const payload = employeeToPayload(formData);
      const result = await adminAPI.addEmployee(payload);
      const temporaryPassword = result?.temporary_password || payload.password;
      await fetchEmployees();
      setFormData(getEmptyForm())
      setShowAddModal(false);
      alert(`Employee added successfully. Password: ${temporaryPassword}`);
    } catch (err) {
      console.error("Error adding employee:", err);
      alert(err.message || "Failed to add employee");
    }
  }

  const editEmployee = async () => {
    if (!selectedEmployee || !formData.name) return;

    try {
      const payload = employeeToPayload(formData);
      const result = await adminAPI.updateEmployee(selectedEmployee.id, payload);
      const temporaryPassword = result?.temporary_password || payload.password;
      await fetchEmployees();
      setShowEditModal(false);
      setSelectedEmployee(null)
      if (temporaryPassword) {
        alert(`Password updated successfully. New password: ${temporaryPassword}`);
      }
    } catch (err) {
      console.error("Error updating employee:", err);
      alert(err.message || "Failed to update employee");
    }
  };

  const deleteEmployee = async (id) => {
    const employee = employeeList.find((e) => e.id === id)
    const name = employee ? employee.name : "this employee"
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return

    try {
      await adminAPI.deleteEmployee(id);
      await fetchEmployees();
    } catch (err) {
      console.error("Error deleting employee:", err);
      alert(err.message || "Failed to delete employee");
    }
  }

  const openEditModal = (employee) => {
    setSelectedEmployee(employee)
    setFormData({
      name: employee.name || "",
      email: employee.email || "",
      role: formatRoleLabel(employee.role),
      team_id: employee.team_id !== undefined && employee.team_id !== null ? String(employee.team_id) : "",
      position: employee.position || "",
      is_active: employee.is_active ?? 1,
      password: "",
    });
    setShowEditModal(true)
  }

  if (loading) {
    return <div className="p-6 text-center">Loading employees...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees..."
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
              Add Employee
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {teams.length === 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No team exists yet. Create a team first, then assign employees to it.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Position</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{employee.name}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.email}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.role}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.position || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.team}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "Active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEditModal(employee)} className="text-xs font-medium text-blue-600 hover:text-blue-700">Edit</button>
                          <button onClick={() => deleteEmployee(employee.id)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">No employees found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Employee</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" placeholder="Enter full name" value={formData.name} onChange={(event) => updateForm({ name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" placeholder="Enter email address" value={formData.email} onChange={(event) => updateForm({ email: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="text"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(event) => updateForm({ password: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select value={formData.role} onChange={(event) => updateForm({ role: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {roles.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Team</label>
                <select
                  value={formData.team_id}
                  onChange={(event) => updateForm({ team_id: event.target.value })}
                  disabled={teams.length === 0}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">{teams.length === 0 ? "Create a team first" : "Select Team"}</option>
                  {teams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Position <span className="text-xs text-slate-400">(optional)</span></label>
                <input type="text" placeholder="e.g. Senior Developer" value={formData.position} onChange={(event) => updateForm({ position: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active_add" checked={formData.is_active === 1 || formData.is_active === true} onChange={(event) => updateForm({ is_active: event.target.checked ? 1 : 0 })} className="h-4 w-4 rounded border-slate-300" />
                <label htmlFor="is_active_add" className="text-sm text-slate-700">Active</label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={addEmployee} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Add</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Employee</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" placeholder="Enter full name" value={formData.name} onChange={(event) => updateForm({ name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" placeholder="Enter email address" value={formData.email} onChange={(event) => updateForm({ email: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                <input
                  type="text"
                  placeholder="Enter new password"
                  value={formData.password}
                  onChange={(event) => updateForm({ password: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select value={formData.role} onChange={(event) => updateForm({ role: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {roles.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Team</label>
                <select
                  value={formData.team_id}
                  onChange={(event) => updateForm({ team_id: event.target.value })}
                  disabled={teams.length === 0}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">{teams.length === 0 ? "Create a team first" : "Select Team"}</option>
                  {teams.map((team) => (<option key={team.id} value={team.id}>{team.name}</option>))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Position <span className="text-xs text-slate-400">(optional)</span></label>
                <input type="text" placeholder="Enter position" value={formData.position} onChange={(event) => updateForm({ position: event.target.value })} className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active_edit" checked={formData.is_active === 1 || formData.is_active === true} onChange={(event) => updateForm({ is_active: event.target.checked ? 1 : 0 })} className="h-4 w-4 rounded border-slate-300" />
                <label htmlFor="is_active_edit" className="text-sm text-slate-700">Active</label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={editEmployee} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
};

export default EmployeesAndRoles;
