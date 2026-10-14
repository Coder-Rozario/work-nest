import { Users, CheckSquare, Building2, Clock, Plus, ChevronRight, BriefcaseBusiness, BarChart3, UserCheck, MessageSquareText, CalendarClock, Play, Pause, FolderKanban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { adminAPI, messageAPI, meetingAPI, timeAttendanceAPI } from "../../services/api";

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-violet-50 text-violet-700",
  Assigned: "bg-slate-100 text-slate-700",
  "Revision Required": "bg-rose-50 text-rose-700",
  Approved: "bg-green-50 text-green-700",
};

const getStatusClass = (status) => statusStyles[status] || "bg-slate-100 text-slate-700";

const getPresenceClass = (status) => {
  if (status === "online") return "bg-green-500";
  if (status === "away") return "bg-amber-400";
  return "bg-slate-300";
};

const formatDurationFriendly = (totalMinutes) => {
  const minutes = Number(totalMinutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins";
  if (minutes < 60) return `${Math.round(minutes)} mins`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`;
};

const getAttendanceStatus = (checkIn, officeStart = "09:00") => {
  if (!checkIn) return "Absent";
  try {
    const d = new Date(checkIn);
    if (!Number.isNaN(d.getTime())) {
      const minutes = d.getHours() * 60 + d.getMinutes();
      const [sh, sm] = String(officeStart).split(":").map((n) => parseInt(n, 10) || 0);
      const startMinutes = sh * 60 + sm;
      if (minutes > startMinutes + 15) return "Late";
      return "Present";
    }
  } catch {
    // ignore invalid check-in data
  }
  return "Present";
};

const AdminOverview = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [isClocked, setIsClocked] = useState(false);
  const [activeLogId, setActiveLogId] = useState(null);

  const mapTask = (t) => ({
    ...t,
    assignee: t.full_name || t.assignee || "Unassigned",
    dueDate: t.due_date || t.dueDate || "-",
  });

  const mapMember = (m) => ({
    ...m,
    name: m.full_name || m.name || "Unknown",
    team: m.team_name || m.team || "-",
    position: m.position || "-",
    status: m.status || "offline",
  });

  const mapMessage = (msg) => ({
    ...msg,
    sender: msg.full_name || msg.sender || "Unknown",
    content: msg.content || msg.encrypted_text || msg.message || "-",
    createdAt: msg.created_at || msg.last_message_at || msg.createdAt || "-",
  });

  const mapMeeting = (mtg) => ({
    ...mtg,
    title: mtg.title || mtg.meeting_title || "Untitled Meeting",
    scheduledTime: [mtg.meeting_date, mtg.meeting_time].filter(Boolean).join(" ") || mtg.scheduledTime || "-",
  });

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [dashData, tasksData, employeesData, projectsData, messagesData, meetingsData, attendanceResp] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTasks(),
        adminAPI.getEmployees(),
        adminAPI.getProjects(),
        messageAPI.getConversations().catch(() => []),
        meetingAPI.getMeetings().catch(() => []),
        timeAttendanceAPI.getRecords().catch(() => [])
      ]);

      const records = (attendanceResp && Array.isArray(attendanceResp.records)) ? attendanceResp.records : (Array.isArray(attendanceResp) ? attendanceResp : []);
      const active = records.find((entry) => entry.check_in && !entry.check_out);
      setIsClocked(Boolean(active));
      setActiveLogId(active ? active.id : null);

      setDashboard(dashData || {});
      setTasks((Array.isArray(tasksData) ? tasksData.map(mapTask) : []).slice(0, 4));
      setProjects((Array.isArray(projectsData) ? projectsData : []).slice(0, 4));
      setTeamMembers((Array.isArray(employeesData) ? employeesData.map(mapMember) : []).slice(0, 4));
      setRecentMessages((Array.isArray(messagesData) ? messagesData.map(mapMessage) : []).slice(0, 2));
      setUpcomingMeetings((Array.isArray(meetingsData) ? meetingsData.map(mapMeeting) : []).slice(0, 2));
      setAttendanceRecords(records.slice(0, 5));
    } catch (err) {
      console.error("Error fetching admin overview:", err);
      setDashboard({ total_employees: 0, total_tasks: 0, total_projects: 0, total_meetings: 0 });
      setTasks([]);
      setProjects([]);
      setTeamMembers([]);
      setRecentMessages([]);
      setUpcomingMeetings([]);
      setAttendanceRecords([]);
      setIsClocked(false);
      setActiveLogId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleClockToggle = async () => {
    try {
      setClocking(true);
      if (!isClocked) {
        const res = await timeAttendanceAPI.addRecord({ check_in: new Date().toISOString(), check_out: null, note: "Clock in" });
        if (res && res.id) setActiveLogId(res.id);
        setIsClocked(true);
      } else {
        const sessionId = activeLogId || attendanceRecords.find((log) => log.check_in && !log.check_out)?.id;
        if (sessionId) {
          await timeAttendanceAPI.updateRecord(sessionId, { check_out: new Date().toISOString(), note: "Clock out" });
        }
        setIsClocked(false);
        setActiveLogId(null);
      }
      await loadOverview();
    } catch {
      window.alert("Could not update clock status. Please try again.");
    } finally {
      setClocking(false);
    }
  };

  const stats = useMemo(() => [
    { label: "Total Employees", value: dashboard?.total_employees ?? "0", icon: Users },
    { label: "Total Tasks", value: dashboard?.total_tasks ?? "0", icon: CheckSquare },
    { label: "Active Projects", value: dashboard?.total_projects ?? "0", icon: Building2 },
    { label: "Meetings", value: dashboard?.total_meetings ?? "0", icon: Clock },
  ], [dashboard]);

  const attendanceSummary = useMemo(() => {
    const presentCount = attendanceRecords.filter((record) => getAttendanceStatus(record.check_in, "09:00") !== "Absent").length;
    const lateCount = attendanceRecords.filter((record) => getAttendanceStatus(record.check_in, "09:00") === "Late").length;
    const totalMinutes = attendanceRecords.reduce((sum, record) => {
      const diff = record.check_in && record.check_out ? (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000 : 0;
      return sum + Math.max(0, diff);
    }, 0);
    return { presentCount, lateCount, totalMinutes };
  }, [attendanceRecords]);

  if (loading) {
    return <div className="p-6 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Company overview</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Executive snapshot</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate("/Admin/tasks")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <BriefcaseBusiness className="h-4 w-4" />
              Tasks
            </button>
            <button onClick={() => navigate("/Admin/projects")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FolderKanban className="h-4 w-4" />
              Projects
            </button>
            <button onClick={() => navigate("/Admin/time-attendance")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserCheck className="h-4 w-4" />
              Attendance
            </button>
            <button onClick={handleClockToggle} disabled={clocking} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isClocked ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
              {isClocked ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isClocked ? "Clock Out" : "Clock In"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((statItem) => {
          const Icon = statItem.icon;
          return (
            <div key={statItem.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">{statItem.label}</span>
                <Icon className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-semibold text-slate-900">{statItem.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Work status</h2>
              <p className="mt-1 text-xs text-slate-500">Current company task load</p>
            </div>
            <button className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => navigate("/Admin/tasks")}>
              <Plus className="h-4 w-4" />
              Assign task
            </button>
          </div>

          <ul className="divide-y divide-slate-100">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <li key={task.id || task.title} className="flex cursor-pointer items-center justify-between px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/Admin/tasks")}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.assignee} · Due {task.dueDate}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(task.status)}`}>
                    {task.status}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No tasks available</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Attendance pulse</h2>
              <p className="mt-1 text-xs text-slate-500">Recent employee presence</p>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Present</span>
              <span className="text-sm font-semibold text-slate-900">{attendanceSummary.presentCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Late</span>
              <span className="text-sm font-semibold text-slate-900">{attendanceSummary.lateCount}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Worked time</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatDurationFriendly(attendanceSummary.totalMinutes)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Project progress</h2>
            <p className="mt-1 text-xs text-slate-500">Company-wide delivery status</p>
          </div>
          <div className="space-y-4 p-5">
            {projects.length > 0 ? (
              projects.map((project) => (
                <div key={project.id || project.name}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-800">{project.name}</span>
                    <span className="text-xs font-medium text-slate-500">{Number(project.progress || 0)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, Number(project.progress || 0)))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No project data available</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Team members</h2>
              <p className="mt-1 text-xs text-slate-500">Company presence snapshot</p>
            </div>
            <button className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => navigate("/Admin/employees")}>View all <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <ul className="divide-y divide-slate-100">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <li key={member.id || member.name} className="flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getPresenceClass(member.status || "offline")}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.position}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500">{member.team}</span>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No team members</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent messages</h2>
            <p className="mt-1 text-xs text-slate-500">Latest team conversations</p>
          </div>

          <ul className="divide-y divide-slate-100">
            {recentMessages.length > 0 ? (
              recentMessages.map((message, idx) => (
                <li key={message.id || idx} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/Admin/messages")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{message.sender}</p>
                      <p className="text-xs text-slate-500">{message.content}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{message.createdAt}</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No messages</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming meetings</h2>
            <p className="mt-1 text-xs text-slate-500">Team planning and check-ins</p>
          </div>

          <ul className="divide-y divide-slate-100">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting, idx) => (
                <li key={meeting.id || idx} className="cursor-pointer px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/Admin/meetings")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                      <p className="text-xs text-slate-500">{meeting.scheduledTime}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No upcoming meetings</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
