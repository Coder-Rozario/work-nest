import { Users, CheckSquare, Building2, Clock, Plus, ChevronRight, BriefcaseBusiness, BarChart3, UserCheck, FolderKanban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { adminAPI, messageAPI, meetingAPI, timeAttendanceAPI } from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-violet-50 text-violet-700",
  Assigned: "bg-slate-100 text-slate-700",
  "Revision Required": "bg-rose-50 text-rose-700",
  Approved: "bg-green-50 text-green-700",
};

const getStatusClass = (status) => statusStyles[status] || "bg-slate-100 text-slate-700";

const xorDecrypt = (input) => {
  const text = String(input ?? "");
  if (!text.trim()) return "";
  if (text.length % 2 !== 0) return text;

  let result = "";
  const ENCRYPTION_KEY = "worknest_secure_v1";
  for (let i = 0; i < text.length; i += 2) {
    const hexPair = text.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(hexPair)) return text;
    const byte = parseInt(hexPair, 16);
    const keyCode = ENCRYPTION_KEY.charCodeAt((i / 2) % ENCRYPTION_KEY.length);
    result += String.fromCharCode(byte ^ keyCode);
  }
  return result;
};

const decodeMessageText = (value) => {
  const text = String(value ?? "");
  const decoded = xorDecrypt(text);
  if (decoded && decoded.trim()) return decoded.trim();
  return text && text.trim() ? text.trim() : "No messages yet";
};

const formatDurationFriendly = (totalMinutes) => {
  const minutes = Number(totalMinutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins";
  if (minutes < 60) return `${Math.round(minutes)} mins`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`;
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDisplayTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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
    return "Present";
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
  const [tick, setTick] = useState(0);

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
    meetingDate: mtg.meeting_date || mtg.date || mtg.scheduledTime || "",
    meetingTime: mtg.meeting_time || mtg.time || "",
  });

  const fetchOverviewRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
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

        if (!isMounted) return;

        setDashboard(dashData || {});
        setTasks((Array.isArray(tasksData) ? tasksData.map(mapTask) : []).slice(0, 4));
        setProjects((Array.isArray(projectsData) ? projectsData : []).slice(0, 4));
        setTeamMembers((Array.isArray(employeesData) ? employeesData.map(mapMember) : []).slice(0, 4));
        setRecentMessages((Array.isArray(messagesData) ? messagesData.map(mapMessage) : []).slice(0, 2));
        setUpcomingMeetings((Array.isArray(meetingsData) ? meetingsData.map(mapMeeting) : []).slice(0, 2));
        setAttendanceRecords(records.slice(0, 5));
      } catch (err) {
        console.error("Error fetching admin overview:", err);
        if (!isMounted) return;
        setDashboard({ total_employees: 0, total_tasks: 0, total_projects: 0, total_meetings: 0 });
        setTasks([]);
        setProjects([]);
        setTeamMembers([]);
        setRecentMessages([]);
        setUpcomingMeetings([]);
        setAttendanceRecords([]);
      } finally {
        if (isMounted && !silent) setLoading(false);
      }
    };

    fetchOverviewRef.current = fetchOverview;
    void fetchOverview();

    const intervalId = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)

    return () => {
      isMounted = false;
      fetchOverviewRef.current = null;
      window.clearInterval(intervalId)
    };
  }, []);

  useRealtime(['tasks', 'projects', 'meetings', 'employees', 'attendance'], () => {
    if (fetchOverviewRef.current) void fetchOverviewRef.current({ silent: true });
  });

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
      let diff = 0
      if (record.check_in && record.check_out) {
        diff = (new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 60000
      } else if (record.check_in && !record.check_out) {
        diff = (Date.now() - new Date(record.check_in).getTime()) / 60000
      }
      return sum + Math.max(0, diff);
    }, 0);
    return { presentCount, lateCount, totalMinutes };
  }, [attendanceRecords, tick]);

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
              Time Attendance
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent messages</h2>
            <p className="mt-1 text-xs text-slate-500">Latest team conversations</p>
          </div>

          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {recentMessages.length > 0 ? (
              recentMessages.map((msg) => (
                <li key={msg.id || msg.createdAt} className="px-5 py-3.5 cursor-pointer hover:bg-slate-50" onClick={() => navigate("/Admin/messages")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{msg.sender}</p>
                    <span className="text-[11px] text-slate-400">{formatDisplayDate(msg.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 wrap-break-word">{decodeMessageText(msg.content)}</p>
                </li>
              ))
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No recent messages</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming meetings</h2>
            <p className="mt-1 text-xs text-slate-500">Scheduled collaboration</p>
          </div>

          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => {
                const scheduled = [formatDisplayDate(meeting.meetingDate), formatDisplayTime(meeting.meetingTime)].filter(Boolean).join(" · ") || "Scheduled";
                return (
                  <li key={meeting.id || meeting.title} className="px-5 py-3.5 cursor-pointer hover:bg-slate-50" onClick={() => navigate("/Admin/meetings")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{meeting.title}</p>
                        <p className="text-xs text-slate-500">{scheduled}</p>
                      </div>
                      <button className="text-xs font-medium text-blue-700 hover:text-blue-800" onClick={() => navigate("/Admin/meetings")}>View</button>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="px-5 py-3.5 text-sm text-slate-500">No upcoming meetings</li>
            )}
          </ul>
        </div>
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

          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <li key={task.id || task.title} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50" onClick={() => navigate("/Admin/tasks")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.assignee} · Due {formatDisplayDate(task.dueDate) || "N/A"}</p>
                    {task.progress_note ? (
                      <p className="mt-1 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-700">Progress note:</span> {task.progress_note}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">No progress note yet</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{Number(task.progress || 0)}%</span>
                  </div>
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
          <div className="max-h-72 space-y-4 overflow-y-auto p-5">
            {projects.length > 0 ? (
              projects.map((project) => (
                <div key={project.id || project.name}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-800">{project.name}</span>
                    <span className="text-xs font-medium text-slate-500">{Number(project.progress || 0)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-linear-to-r from-blue-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, Number(project.progress || 0)))}%` }} />
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
              <p className="mt-1 text-xs text-slate-500">Company member list</p>
            </div>
            <button className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => navigate("/Admin/employees")}>View all <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <li key={member.id || member.name} className="flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
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
    </div>
  );
};

export default AdminOverview;
