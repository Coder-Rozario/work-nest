import { useState, useEffect, useCallback, useMemo } from "react"
import { Search } from "lucide-react";
import { timeAttendanceAPI, adminAPI } from "../../services/api";
import { getAssetUrl } from "../../config/env";
import useRealtime from "../../hooks/useRealtime";

const pad2 = (n) => String(n).padStart(2, "0");

const extractDate = (s) => {
  if (!s) return "";
  const d = s instanceof Date ? s : new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const str = String(s);
  if (str.includes("T")) return str.split("T")[0];
  if (str.includes(" ")) return str.split(" ")[0];
  return str.length >= 10 ? str.slice(0, 10) : str;
};

const extractTime = (s) => {
  if (!s) return "-";
  const d = s instanceof Date ? s : new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const str = String(s);
  try {
    if (str.includes("T")) return str.split("T")[1].slice(0, 5);
    if (str.includes(" ")) return str.split(" ")[1].slice(0, 5);
    if (/^\d{2}:\d{2}/.test(str)) return str.slice(0, 5);
    return str;
  } catch {
    return "-";
  }
};

const format12Hour = (timeStr) => {
  if (!timeStr || timeStr === "-") return "-";
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  if (Number.isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
};

const calcHours = (checkIn, checkOut) => {
  if (!checkIn || checkIn === "-") return "-";
  const inDate = new Date(checkIn);
  if (Number.isNaN(inDate.getTime())) return "-";
  
  let outDate;
  if (!checkOut || checkOut === "-") {
    outDate = new Date();
  } else {
    outDate = new Date(checkOut);
  }
  
  if (Number.isNaN(outDate.getTime())) return "-";
  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) return "0.00";
  return (diffMs / 3600000).toFixed(2);
};

const determineStatus = (checkIn, officeStart) => {
  if (!checkIn || checkIn === "-") return "Absent";
  const t = extractTime(checkIn);
  if (t === "-") return "Absent";
  try {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
    const minutes = h * 60 + m;
    const [sh, sm] = String(officeStart || "09:00").split(":").map((n) => parseInt(n, 10) || 0);
    const startMinutes = sh * 60 + sm;
    if (minutes > startMinutes + 15) return "Late";
    return "Present";
  } catch {
    return "Present";
  }
};

const mapRecord = (r, officeStart) => {
  const date = extractDate(r.created_at || r.date);
  const checkInRaw = extractTime(r.check_in);
  const checkOutRaw = extractTime(r.check_out);
  const hasCheckIn = !!(r.check_in && r.check_in !== "0000-00-00 00:00:00" && r.check_in !== null);
  const hours = hasCheckIn ? calcHours(r.check_in, r.check_out) : "-";
  const status = hasCheckIn ? determineStatus(r.check_in, officeStart) : "Absent";
  const role = r.role ? (r.role.charAt(0).toUpperCase() + r.role.slice(1)) : "Employee";
  return {
    ...r,
    employee: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.employee || "Unknown",
    role,
    date,
    checkIn: hasCheckIn ? format12Hour(checkInRaw) : "-",
    checkOut: r.check_out ? format12Hour(checkOutRaw) : "-",
    hours,
    status,
  };
};

const formatDurationFriendly = (totalMinutes) => {
  const minutes = Number(totalMinutes)

  if (!Number.isFinite(minutes) || minutes <= 0) return "0 mins"

  if (minutes < 60) {
    return `${Math.round(minutes)} mins`
  }

  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return `${hours} hr${hours === 1 ? "" : "s"}`
  }

  return `${hours.toFixed(1).replace(/\.0$/, "")} hrs`
}

const AdminTimeAttendance = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDate, setSelectedDate] = useState("");
  const [rawAttendance, setRawAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [officeStart, setOfficeStart] = useState("09:00")
  const [officeEnd, setOfficeEnd] = useState("17:00")
  const [savingSettings, setSavingSettings] = useState(false)
  const [tick, setTick] = useState(0)
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(async () => {
    try {
      const [settingsResp, attendanceResp] = await Promise.all([adminAPI.getSettings().catch(() => null), timeAttendanceAPI.getRecords()])

      const records = (attendanceResp && Array.isArray(attendanceResp.records)) ? attendanceResp.records : (Array.isArray(attendanceResp) ? attendanceResp : [])

      let resolvedOfficeStart = "09:00"
      let resolvedOfficeEnd = "17:00"
      if (settingsResp && typeof settingsResp === 'object') {
        const s = settingsResp.office_start || settingsResp.officeStart || settingsResp.start_time || null
        const e = settingsResp.office_end || settingsResp.officeEnd || settingsResp.end_time || null
        if (s) resolvedOfficeStart = String(s).slice(0, 5)
        if (e) resolvedOfficeEnd = String(e).slice(0, 5)
      } else if (attendanceResp && attendanceResp.office_start) {
        resolvedOfficeStart = String(attendanceResp.office_start).slice(0, 5)
        if (attendanceResp.office_end) resolvedOfficeEnd = String(attendanceResp.office_end).slice(0, 5)
      }
      setOfficeStart(resolvedOfficeStart)
      setOfficeEnd(resolvedOfficeEnd)

      setRawAttendance(records || [])
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setError(err.message || "Failed to load attendance records");
    }
  }, []);

  const attendance = useMemo(() => {
    return rawAttendance.map((r) => mapRecord(r, officeStart))
  }, [rawAttendance, officeStart, tick])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchAttendance();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchAttendance]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)
    return () => window.clearInterval(intervalId)
  }, [])

  useRealtime(['attendance', 'employees'], () => {
    void fetchAttendance();
  });

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true)
      await adminAPI.updateSettings({ office_start: officeStart, office_end: officeEnd })
      await fetchAttendance()
      window.alert('Office hours updated')
    } catch (err) {
      console.error(err)
      window.alert('Could not save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const filteredAttendance = attendance.filter(
    (record) => {
      const searchMatch = (record.employee || "").toLowerCase().includes(searchTerm.toLowerCase());
      const dateMatch = !selectedDate || record.date === selectedDate;
      return searchMatch && dateMatch;
    }
  );

  const presentCount = filteredAttendance.filter(
    (r) => r.status === "Present" || r.status === "Late"
  ).length
  const absentCount = filteredAttendance.filter((r) => r.status === "Absent")
    .length;
  const avgMinutes = filteredAttendance.length > 0
    ? filteredAttendance.reduce((sum, r) => {
        const parsed = Number(r.hours)
        if (!Number.isFinite(parsed)) return sum
        return sum + (parsed * 60)
      }, 0) / filteredAttendance.length
    : 0

  const statusColors = {
    Present: "bg-green-50 text-green-700",
    Late: "bg-amber-50 text-amber-700",
    Absent: "bg-red-50 text-red-700",
  };

  if (loading) {
    return <div className="p-6 text-center">Loading attendance...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">
              Present Today
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {presentCount}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">
              Absent Today
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {absentCount}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-3">
              Avg. Work Hours
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {formatDurationFriendly(avgMinutes)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-xs w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-full sm:w-auto flex items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Start</label>
                <input
                  type="time"
                  value={officeStart}
                  onChange={(e) => setOfficeStart(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg focus:outline-none"
                />
                <label className="text-xs text-slate-500">End</label>
                <input
                  type="time"
                  value={officeEnd}
                  onChange={(e) => setOfficeEnd(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg focus:outline-none"
                />
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                >
                  {savingSettings ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
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
                    Employee
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Check In
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Check Out
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Hours
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length > 0 ? (
                  filteredAttendance.map((record, idx) => (
                    <tr
                      key={record.id || idx}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {record.profile_photo ? (
                            <img
                              src={getAssetUrl(record.profile_photo)}
                              alt={record.employee}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {record.employee.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {record.employee}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${record.role === "Manager" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                          {record.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {record.date || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {record.checkIn}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {record.checkOut}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {formatDurationFriendly((parseFloat(record.hours) || 0) * 60)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[record.status] || "bg-slate-100 text-slate-600"}`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      className="py-6 text-center text-slate-500"
                    >
                      No attendance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
};

export default AdminTimeAttendance;
