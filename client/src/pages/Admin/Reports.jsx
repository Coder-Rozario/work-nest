import { useEffect, useState, useMemo, useRef } from "react";
import { BarChart3, Users, FolderKanban, CheckSquare, Clock3, TrendingUp } from "lucide-react";
import { adminAPI, taskAPI, timeAttendanceAPI } from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value) => String(value ?? "").trim().toLowerCase();

const AdminReports = () => {
  const [dashboard, setDashboard] = useState({});
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDataRef = useRef(null);

  useEffect(() => {
    const fetchData = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const results = await Promise.allSettled([
          adminAPI.getDashboard(),
          adminAPI.getEmployees(),
          adminAPI.getProjects(),
          adminAPI.getReports(),
          taskAPI.getTasks(),
          timeAttendanceAPI.getRecords(),
        ]);

        const safeGet = (result, fallback) =>
          result.status === "fulfilled" ? (result.value || fallback) : fallback;

        setDashboard(safeGet(results[0], {}));
        setEmployees(Array.isArray(safeGet(results[1], [])) ? safeGet(results[1], []) : []);
        setProjects(Array.isArray(safeGet(results[2], [])) ? safeGet(results[2], []) : []);
        setTasks(Array.isArray(safeGet(results[4], [])) ? safeGet(results[4], []) : []);
        setAttendance(Array.isArray(safeGet(results[5], [])) ? safeGet(results[5], []) : []);
      } catch (err) {
        console.error("Error loading reports:", err);
        setError(err.message || "Failed to load reports");
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchDataRef.current = fetchData;
    void fetchData();

    return () => {
      fetchDataRef.current = null;
    };
  }, []);

  useRealtime(['tasks', 'projects', 'attendance', 'reports'], () => {
    if (fetchDataRef.current) void fetchDataRef.current({ silent: true });
  });

  const totalEmployees = useMemo(
    () => toNumber(dashboard.total_employees, employees.length),
    [dashboard, employees]
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.is_active === 1 || employee.is_active === true).length,
    [employees]
  );

  const inactiveEmployees = Math.max(0, totalEmployees - activeEmployees);

  const totalProjects = useMemo(
    () => toNumber(dashboard.total_projects, projects.length),
    [dashboard, projects]
  );

  const projectStatusSummary = useMemo(() => {
    const counts = {
      Completed: 0,
      "In Progress": 0,
      "To Do": 0,
    };

    projects.forEach((project) => {
      const status = String(project.status || "").trim();
      if (["completed", "done"].includes(normalizeStatus(status))) counts.Completed += 1;
      else if (normalizeStatus(status).includes("progress")) counts["In Progress"] += 1;
      else if (["to do", "todo", "pending"].includes(normalizeStatus(status))) counts["To Do"] += 1;
      else if (status) counts["To Do"] += 1;
    });

    return [
      { label: "Completed", value: counts.Completed, color: "#22c55e" },
      { label: "In Progress", value: counts["In Progress"], color: "#3b82f6" },
      { label: "To Do", value: counts["To Do"], color: "#94a3b8" },
    ];
  }, [projects]);

  const totalTasks = useMemo(
    () => toNumber(dashboard.total_tasks, tasks.length),
    [dashboard, tasks]
  );

  const taskStatusSummary = useMemo(() => {
    const counts = {
      Assigned: 0,
      "In Progress": 0,
      Submitted: 0,
      Approved: 0,
      Completed: 0,
    };

    tasks.forEach((task) => {
      const status = String(task.status || "Assigned").trim();
      if (["approved", "completed", "done"].includes(normalizeStatus(status))) {
        counts.Completed += 1;
      } else if (["submitted", "under review"].includes(normalizeStatus(status))) {
        counts.Submitted += 1;
      } else if (normalizeStatus(status).includes("progress")) {
        counts["In Progress"] += 1;
      } else if (["assigned", "to do", "todo", "pending"].includes(normalizeStatus(status))) {
        counts.Assigned += 1;
      } else {
        counts.Assigned += 1;
      }
    });

    return [
      { label: "Assigned", value: counts.Assigned, color: "#cbd5e1" },
      { label: "In Progress", value: counts["In Progress"], color: "#60a5fa" },
      { label: "Submitted", value: counts.Submitted, color: "#a78bfa" },
      { label: "Completed", value: counts.Completed, color: "#34d399" },
    ];
  }, [tasks]);

  const taskCompletionPct = totalTasks > 0
    ? Math.round(((taskStatusSummary.find((item) => item.label === "Completed")?.value || 0) / totalTasks) * 100)
    : 0;

  const projectCompletionPct = totalProjects > 0
    ? Math.round(((projectStatusSummary.find((item) => item.label === "Completed")?.value || 0) / totalProjects) * 100)
    : 0;

  const attendanceEfficiency = useMemo(() => {
    const list = Array.isArray(attendance) ? attendance : [];
    const hours = list.map((record) => {
      if (!record.check_in || !record.check_out) return 0;
      const parse = (value) => {
        if (!value) return 0;
        const clean = String(value).replace("Z", "");
        const datePart = clean.includes("T") ? clean.split("T")[1] : clean;
        const [hoursStr, minutesStr] = String(datePart || "00:00").slice(0, 5).split(":");
        return (Number(hoursStr || 0) * 60) + (Number(minutesStr || 0));
      };

      const diff = parse(record.check_out) - parse(record.check_in);
      return diff > 0 ? diff / 60 : 0;
    });

    const totalHours = hours.reduce((sum, value) => sum + value, 0);
    const avgHours = list.length ? totalHours / list.length : 0;
    const daySeries = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      label: day,
      hours: 0,
    }));

    list.forEach((record) => {
      if (!record.check_in) return;
      const checkInDate = new Date(record.check_in);
      if (Number.isNaN(checkInDate.getTime())) return;
      const dayIndex = checkInDate.getDay();
      const target = daySeries[(dayIndex + 6) % 7];
      if (target) {
        target.hours += (record.duration_minutes || 0) / 60;
      }
    });

    return {
      totalHours,
      avgHours,
      totalRecords: list.length,
      daySeries,
    };
  }, [attendance]);

  const teamBreakdown = useMemo(() => {
    const stats = {};

    employees.forEach((employee) => {
      const team = employee.team_name || employee.team || "Unassigned";
      stats[team] = (stats[team] || 0) + 1;
    });

    return Object.entries(stats).map(([team, value]) => ({
      team,
      value,
      percent: totalEmployees ? Math.round((value / totalEmployees) * 100) : 0,
    }));
  }, [employees, totalEmployees]);

  const topPerformers = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const name = String(task.full_name || task.assignee || "Unassigned").trim() || "Unassigned";
      const item = map.get(name) || { name, assigned: 0, completed: 0 };
      item.assigned += 1;
      if (["approved", "completed", "done"].includes(normalizeStatus(task.status))) {
        item.completed += 1;
      }
      map.set(name, item);
    });

    return [...map.values()]
      .map((person) => ({
        ...person,
        efficiency: person.assigned ? Math.round((person.completed / person.assigned) * 100) : 0,
      }))
      .sort((a, b) => b.efficiency - a.efficiency || b.assigned - a.assigned)
      .slice(0, 5);
  }, [tasks]);

  const projectInvolvement = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const projectName = String(task.project_name || task.project || "General").trim() || "General";
      const item = map.get(projectName) || { projectName, tasks: 0, members: new Set() };
      item.tasks += 1;
      const assignee = String(task.full_name || task.assignee || "Unassigned").trim() || "Unassigned";
      item.members.add(assignee);
      map.set(projectName, item);
    });

    return [...map.values()]
      .map((item) => ({
        projectName: item.projectName,
        tasks: item.tasks,
        members: item.members.size,
      }))
      .sort((a, b) => b.tasks - a.tasks || b.members - a.members)
      .slice(0, 5);
  }, [tasks]);

  const pieGradient = useMemo(() => {
    const segments = taskStatusSummary.filter((item) => item.value > 0);
    if (!segments.length) {
      return "conic-gradient(#e2e8f0 0 100%)";
    }

    let start = 0;
    const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
    const gradient = segments
      .map((item) => {
        const end = start + (item.value / total) * 100;
        const chunk = `${item.color} ${start}% ${end}%`;
        start = end;
        return chunk;
      })
      .join(", ");

    return `conic-gradient(${gradient})`;
  }, [taskStatusSummary]);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading company reports...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Company overview</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Executive Performance Report</h1>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {totalTasks} total tasks • {totalProjects} projects • {totalEmployees} employees
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Total Employees",
              value: totalEmployees,
              detail: `${activeEmployees} active / ${inactiveEmployees} inactive`,
              icon: Users,
              accent: "bg-blue-50 text-blue-700",
            },
            {
              title: "Project Progress",
              value: `${projectCompletionPct}%`,
              detail: `${projectStatusSummary.find((item) => item.label === "Completed")?.value || 0} completed`,
              icon: FolderKanban,
              accent: "bg-emerald-50 text-emerald-700",
            },
            {
              title: "Task Completion",
              value: `${taskCompletionPct}%`,
              detail: `${taskStatusSummary.find((item) => item.label === "Completed")?.value || 0} done`,
              icon: CheckSquare,
              accent: "bg-violet-50 text-violet-700",
            },
            {
              title: "Attendance Avg",
              value: `${attendanceEfficiency.avgHours.toFixed(1)}h`,
              detail: `${attendanceEfficiency.totalRecords} records tracked`,
              icon: Clock3,
              accent: "bg-amber-50 text-amber-700",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{card.title}</span>
                  <div className={`rounded-xl p-2 ${card.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Project Status Distribution</h2>
              <span className="text-xs text-slate-500">{totalProjects} projects</span>
            </div>

            <div className="space-y-4">
              {projectStatusSummary.map((item) => {
                const width = totalProjects ? (item.value / totalProjects) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-medium text-slate-900">{item.value}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Task Status Mix</h2>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div
                className="relative h-28 w-28 rounded-full border border-slate-200"
                style={{ background: pieGradient }}
              >
                <div className="absolute inset-4.5 rounded-full bg-white shadow-inner">
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="text-xs text-slate-500">Done</p>
                      <p className="text-lg font-bold text-slate-900">{taskCompletionPct}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2">
                {taskStatusSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.label}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Team Distribution</h2>
              <span className="text-xs text-slate-500">By team</span>
            </div>

            <div className="space-y-4">
              {teamBreakdown.length ? teamBreakdown.map((item) => (
                <div key={item.team}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.team}</span>
                    <span className="font-medium text-slate-900">{item.value} members</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No team data available.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Weekly Attendance Trend</h2>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex h-44 items-end gap-3">
              {attendanceEfficiency.daySeries.map((day) => {
                const maxValue = Math.max(1, ...attendanceEfficiency.daySeries.map((entry) => entry.hours));
                const height = maxValue ? (day.hours / maxValue) * 100 : 0;
                return (
                  <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-xl bg-linear-to-t from-blue-500 to-blue-300"
                        style={{ height: `${Math.max(8, height)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">{day.label}</span>
                    <span className="text-[10px] text-slate-400">{day.hours.toFixed(1)}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">Top Team Performers</h2>
            <div className="space-y-3">
              {topPerformers.length ? topPerformers.map((person, index) => (
                <div key={`${person.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{person.name}</p>
                    <p className="text-xs text-slate-500">{person.completed}/{person.assigned} tasks done</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {person.efficiency}%
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No task performance data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">Project Involvement</h2>
            <div className="space-y-3">
              {projectInvolvement.length ? projectInvolvement.map((project) => (
                <div key={project.projectName} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{project.projectName}</p>
                    <span className="text-xs font-medium text-slate-500">{project.members} members</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, (project.tasks / Math.max(1, Math.max(...projectInvolvement.map((item) => item.tasks)))) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{project.tasks} task actions tracked</p>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No project involvement data yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Task Pipeline</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {taskStatusSummary.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {totalTasks ? Math.round((item.value / totalTasks) * 100) : 0}% of all tasks
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminReports;
