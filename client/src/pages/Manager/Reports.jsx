import { useEffect, useState, useMemo } from "react";
import { Users, CheckSquare, TrendingUp, Clock3, BarChart3 } from "lucide-react";
import { managerAPI, reportAPI, timeAttendanceAPI } from "../../services/api";

const normalizeStatus = (value) => String(value ?? "").trim().toLowerCase();

const ManagerReports = () => {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [tasksData, membersData, timeData, summaryData] = await Promise.all([
          managerAPI.getReports(),
          managerAPI.getTeamMembers(),
          timeAttendanceAPI.getRecords(),
          reportAPI.getTaskSummary(),
        ]);

        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setTeamMembers(Array.isArray(membersData) ? membersData : []);
        setTimeLogs(Array.isArray(timeData) ? timeData : []);
        setSummary(summaryData && typeof summaryData === "object" ? summaryData : {});
      } catch (err) {
        console.error("Manager reports error:", err);
        setError(err.message || "Failed to load team reports");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalMembers = teamMembers.length || summary.total_employees || tasks.length || 0;
  const completedTasks = tasks.filter((task) => ["approved", "completed", "done"].includes(normalizeStatus(task.status))).length;
  const inProgressTasks = tasks.filter((task) => normalizeStatus(task.status).includes("progress")).length;
  const submittedTasks = tasks.filter((task) => ["submitted", "under review"].includes(normalizeStatus(task.status))).length;
  const assignedTasks = tasks.filter((task) => ["assigned", "to do", "todo", "pending"].includes(normalizeStatus(task.status))).length;

  const metrics = useMemo(() => [
    { label: "Team Members", value: totalMembers, icon: Users, tone: "bg-blue-50 text-blue-700" },
    { label: "Active Tasks", value: tasks.length, icon: CheckSquare, tone: "bg-violet-50 text-violet-700" },
    { label: "Completed", value: completedTasks, icon: TrendingUp, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Attendance Logs", value: timeLogs.length, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
  ], [totalMembers, tasks.length, completedTasks, timeLogs.length]);

  const memberPerformance = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const name = String(task.full_name || task.assignee || "Unassigned").trim() || "Unassigned";
      const member = map.get(name) || { name, total: 0, done: 0 };
      member.total += 1;
      if (["approved", "completed", "done"].includes(normalizeStatus(task.status))) member.done += 1;
      map.set(name, member);
    });

    return [...map.values()]
      .map((member) => ({
        ...member,
        percent: member.total ? Math.round((member.done / member.total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent || b.total - a.total)
      .slice(0, 6);
  }, [tasks]);

  const projectProgress = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const projectName = String(task.project_name || task.project || "General").trim() || "General";
      const item = map.get(projectName) || { name: projectName, total: 0, done: 0 };
      item.total += 1;
      if (["approved", "completed", "done"].includes(normalizeStatus(task.status))) item.done += 1;
      map.set(projectName, item);
    });

    return [...map.values()]
      .map((project) => ({
        name: project.name,
        progress: project.total ? Math.round((project.done / project.total) * 100) : 0,
        done: project.done,
        total: project.total,
      }))
      .sort((a, b) => b.progress - a.progress || b.total - a.total)
      .slice(0, 6);
  }, [tasks]);

  const attendanceSummary = useMemo(() => {
    const daily = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, hours: 0 }));
    if (!timeLogs.length) return daily;

    timeLogs.forEach((record) => {
      if (!record.check_in) return;
      const checkIn = new Date(record.check_in);
      if (Number.isNaN(checkIn.getTime())) return;
      const index = (checkIn.getDay() + 6) % 7;
      const hours = Number(record.duration_minutes || 0) / 60;
      daily[index].hours += hours;
    });

    return daily;
  }, [timeLogs]);

  const taskBreakdown = useMemo(() => [
    { label: "Assigned", value: assignedTasks, color: "#cbd5e1" },
    { label: "In Progress", value: inProgressTasks, color: "#60a5fa" },
    { label: "Submitted", value: submittedTasks, color: "#a78bfa" },
    { label: "Completed", value: completedTasks, color: "#34d399" },
  ], [assignedTasks, inProgressTasks, submittedTasks, completedTasks]);

  const completionPie = useMemo(() => {
    const total = taskBreakdown.reduce((sum, item) => sum + item.value, 0) || 1;
    let start = 0;
    const gradient = taskBreakdown
      .filter((item) => item.value > 0)
      .map((item) => {
        const end = start + (item.value / total) * 100;
        const chunk = `${item.color} ${start}% ${end}%`;
        start = end;
        return chunk;
      })
      .join(", ");

    return `conic-gradient(${gradient || "#e2e8f0 0 100%"})`;
  }, [taskBreakdown]);

  const overallProgress = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  if (loading) {
    return <div className="space-y-6 p-6 text-center text-slate-500">Loading manager reports...</div>;
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Manager dashboard</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Team Performance Overview</h1>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {tasks.length} tracked tasks • {totalMembers} team members
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{metric.label}</span>
                  <div className={`rounded-xl p-2 ${metric.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900">{metric.value}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1.1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Team Performance</h2>
              <span className="text-xs text-slate-500">Individual efficiency</span>
            </div>

            <div className="space-y-3">
              {memberPerformance.length ? memberPerformance.map((member) => (
                <div key={member.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{member.name}</span>
                    <span className="text-slate-500">{member.percent}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${member.percent}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                    <span>{member.done} done</span>
                    <span>{member.total} tasks</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No member performance data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Task Completion</h2>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative h-28 w-28 rounded-full border border-slate-200" style={{ background: completionPie }}>
                <div className="absolute inset-4.5 rounded-full bg-white shadow-inner">
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Done</p>
                      <p className="text-lg font-bold text-slate-900">{overallProgress}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2">
                {taskBreakdown.map((item) => (
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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Project Progress</h2>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>

            <div className="space-y-4">
              {projectProgress.length ? projectProgress.map((project) => (
                <div key={project.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate pr-2 text-slate-700">{project.name}</span>
                    <span className="font-medium text-slate-900">{project.progress}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${project.progress}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{project.done}/{project.total} completed</p>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No project progress data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Attendance & Work Hours</h2>
              <Clock3 className="h-5 w-5 text-slate-400" />
            </div>

            <div className="flex h-44 items-end gap-3">
              {attendanceSummary.map((day) => {
                const maxValue = Math.max(1, ...attendanceSummary.map((entry) => entry.hours));
                const height = maxValue ? (day.hours / maxValue) * 100 : 0;
                return (
                  <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-xl bg-linear-to-t from-amber-500 to-amber-300"
                        style={{ height: `${Math.max(8, height)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">{day.day}</span>
                    <span className="text-[10px] text-slate-400">{day.hours.toFixed(1)}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Status Detail</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {taskBreakdown.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {tasks.length ? Math.round((item.value / tasks.length) * 100) : 0}% of team workload
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerReports;
