import { useEffect, useState, useMemo } from "react"
import { CheckCircle2, Clock, AlertCircle, ChevronRight, Play, Pause } from "lucide-react"
import { timeAttendanceAPI, managerAPI } from "../../services/api"
import { getAssetUrl } from "../../config/env"

function formatDurationFriendly(totalMinutes) {
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

function getStatusColor(status) {
	switch (status) {
		case "Present":
			return "bg-green-50 text-green-700"
		case "Absent":
			return "bg-red-50 text-red-700"
		case "Late":
			return "bg-amber-50 text-amber-700"
		default:
			return "bg-slate-100 text-slate-600"
	}
}

const getStatusIcon = (status) => {
	switch (status) {
		case "Present":
			return <CheckCircle2 className="h-4 w-4" />
		case "Late":
			return <AlertCircle className="h-4 w-4" />
		case "Absent":
			return <AlertCircle className="h-4 w-4" />
		default:
			return <Clock className="h-4 w-4" />
	}
}

function formatTime(value) {
	if (!value) return "-"
	try {
		const d = new Date(value)
		if (!Number.isNaN(d.getTime())) {
			return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
		}
	} catch {
		// Fall through to string fallback on invalid date.
	}
	return String(value).slice(0, 5) || "-"
}

function formatDate(value) {
	if (!value) return "Unknown"
	try {
		const d = new Date(value)
		if (!Number.isNaN(d.getTime())) {
			return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
		}
	} catch {
		// Fall through to string fallback on invalid date.
	}
	return String(value).slice(0, 10)
}

// Convert a "HH:MM" (24-hour) office-time string to 12-hour format with AM/PM.
function formatOfficeTime(value) {
	if (!value) return "-"
	const match = String(value).match(/^(\d{1,2}):(\d{2})/)
	if (!match) return value
	let h = parseInt(match[1], 10)
	const m = match[2]
	if (Number.isNaN(h)) return value
	const period = h >= 12 ? "PM" : "AM"
	h = h % 12
	if (h === 0) h = 12
	return `${h}:${m} ${period}`
}

// Calculate the office shift length in hours from start/end "HH:MM" strings.
// Handles overnight shifts (e.g. 20:00 - 10:00 = 14 hours).
function getOfficeDurationHours(start, end) {
	if (!start || !end) return 8
	const [sh, sm] = String(start).split(":").map((n) => parseInt(n, 10) || 0)
	const [eh, em] = String(end).split(":").map((n) => parseInt(n, 10) || 0)
	let startMinutes = sh * 60 + sm
	let endMinutes = eh * 60 + em
	if (endMinutes <= startMinutes) endMinutes += 24 * 60
	const diff = endMinutes - startMinutes
	if (diff <= 0) return 8
	return Math.round((diff / 60) * 10) / 10
}

function deriveWorkHours(log) {
	if (log.duration_minutes) {
		return Math.round((log.duration_minutes / 60) * 10) / 10
	}
	if (log.check_in && log.check_out) {
		try {
			const diff = new Date(log.check_out).getTime() - new Date(log.check_in).getTime()
			if (diff > 0) return Math.round((diff / 3600000) * 10) / 10
		} catch {
			// Ignore invalid timestamp differences.
		}
	}
	return 0
}

// Session duration in minutes. For a live (open) session, counts elapsed time
// up to now; for a closed session, uses check_in/check_out.
function deriveSessionMinutes(log) {
	const safeMinutes = Number.isFinite(Number(log?.duration_minutes)) ? Math.round(Number(log.duration_minutes)) : 0
	if (log?.check_in && log?.check_out) {
		try {
			const diff = new Date(log.check_out).getTime() - new Date(log.check_in).getTime()
			if (Number.isFinite(diff) && diff > 0) return Math.round(diff / 60000)
		} catch {
			// Ignore invalid timestamp differences.
		}
	}
	if (log?.check_in && !log?.check_out) {
		try {
			const diff = Date.now() - new Date(log.check_in).getTime()
			if (Number.isFinite(diff) && diff > 0) return Math.round(diff / 60000)
		} catch {
			// Ignore invalid live session timing.
		}
	}
	return safeMinutes > 0 ? safeMinutes : 0
}

function deriveStatus(log, officeStart) {
	if (!log.check_in) return "Absent"
	try {
		const d = new Date(log.check_in)
		if (!Number.isNaN(d.getTime())) {
			const minutes = d.getHours() * 60 + d.getMinutes()
			const [sh, sm] = String(officeStart || "09:00").split(":").map((n) => parseInt(n, 10) || 0)
			const startMinutes = sh * 60 + sm
			// 15 min grace period
			if (minutes > startMinutes + 15) return "Late"
		}
	} catch {
		// Fall through to default status if the timestamp can't be parsed.
	}
	return "Present"
}

function getEmployeeName(log) {
	return log.full_name || ((log.first_name || "") + " " + (log.last_name || "")).trim() || "Unknown"
}

const ManagerTimeAttendance = () => {
	const [managerLogs, setManagerLogs] = useState([])
	const [teamRecords, setTeamRecords] = useState([])
	const [loading, setLoading] = useState(true)
	const [expandedEmployee, setExpandedEmployee] = useState(null)
	const [expandedManagerLog, setExpandedManagerLog] = useState(null)
	const [officeStart, setOfficeStart] = useState("09:00")
	const [officeEnd, setOfficeEnd] = useState("17:00")
	const [isClocked, setIsClocked] = useState(false)
	const [activeLogId, setActiveLogId] = useState(null)
	const [clocking, setClocking] = useState(false)

	const loadData = async () => {
		try {
			setLoading(true)

			// Fetch manager's personal logs
			const managerData = await managerAPI.getTimeLog()
			const logs = (managerData && Array.isArray(managerData.records))
				? managerData.records
				: (Array.isArray(managerData) ? managerData : [])
			setManagerLogs(logs)

			// Detect active (open) clock-in session
			const open = logs.find((l) => l.check_in && !l.check_out)
			if (open) {
				setIsClocked(true)
				setActiveLogId(open.id)
			} else {
				setIsClocked(false)
				setActiveLogId(null)
			}

			// Fetch all team records + office hours
			const teamResp = await timeAttendanceAPI.getRecords()
			const teamData = (teamResp && Array.isArray(teamResp.records)) ? teamResp.records : (Array.isArray(teamResp) ? teamResp : [])
			setTeamRecords(teamData)
			if (teamResp && teamResp.office_start) setOfficeStart(String(teamResp.office_start).slice(0, 5))
			if (teamResp && teamResp.office_end) setOfficeEnd(String(teamResp.office_end).slice(0, 5))
		} catch {
			setManagerLogs([])
			setTeamRecords([])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		const timerId = window.setTimeout(() => {
			void loadData()
		}, 0)
		return () => window.clearTimeout(timerId)
	}, [])

	const handleClockToggle = async () => {
		try {
			setClocking(true)
			if (!isClocked) {
				const res = await timeAttendanceAPI.addRecord({
					check_in: new Date().toISOString(),
					check_out: null,
					note: "Clock in",
				})
				if (res && res.id) setActiveLogId(res.id)
				setIsClocked(true)
			} else {
				const sessionId = activeLogId || managerLogs.find((log) => log.check_in && !log.check_out)?.id
				if (sessionId) {
					await timeAttendanceAPI.updateRecord(sessionId, {
						check_out: new Date().toISOString(),
						note: "Clock out",
					})
				}
				setIsClocked(false)
				setActiveLogId(null)
			}
			await loadData()
		} catch {
			window.alert("Could not update clock status. Please try again.")
		} finally {
			setClocking(false)
		}
	}

	const managerTodayLogs = useMemo(() => managerLogs.slice(0, 50), [managerLogs])
	const teamTodayLogs = useMemo(() => teamRecords.slice(0, 50), [teamRecords])

	const managerStats = useMemo(() => {
		let totalHours = 0
		managerTodayLogs.forEach((log) => {
			totalHours += deriveWorkHours(log)
		})
		const count = managerTodayLogs.length || 1
		return {
			avg: Math.round((totalHours / count) * 10) / 10,
		}
	}, [managerTodayLogs])

	const teamStats = useMemo(() => {
		let present = 0
		let late = 0
		let totalHours = 0
		teamTodayLogs.forEach((log) => {
			const s = deriveStatus(log, officeStart)
			if (s === "Present") present += 1
			if (s === "Late") late += 1
			totalHours += deriveWorkHours(log)
		})
		const count = teamTodayLogs.length || 1
		return {
			present,
			late,
			avg: Math.round((totalHours / count) * 10) / 10,
		}
	}, [teamTodayLogs, officeStart])

	const weeklyTable = useMemo(() => {
		const map = new Map()
		const now = new Date()
		// ISO week number helper
		const getWeekKey = (date) => {
			const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
			const dayNum = d.getUTCDay() || 7
			d.setUTCDate(d.getUTCDate() + 4 - dayNum)
			const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
			return d.getUTCFullYear() + "-" + Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
		}
		// Collect last 4 unique week keys descending
		const weekKeys = []
		for (let i = 0; i < 35; i++) {
			const d = new Date(now)
			d.setDate(now.getDate() - i)
			const k = getWeekKey(d)
			if (!weekKeys.includes(k)) weekKeys.push(k)
			if (weekKeys.length >= 4) break
		}
		teamTodayLogs.forEach((log) => {
			const name = getEmployeeName(log)
			const prev = map.get(name) || { name, counts: [0, 0, 0, 0] }
			if (log.check_in) {
				const d = new Date(log.check_in)
				if (!Number.isNaN(d.getTime())) {
					const idx = weekKeys.indexOf(getWeekKey(d))
					if (idx >= 0) prev.counts[idx] = Math.min(5, prev.counts[idx] + 1)
				}
			}
			map.set(name, prev)
		})
		return [...map.values()].slice(0, 10)
	}, [teamTodayLogs])

	if (loading) {
		return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading attendance...</div>
	}

	return (
		<div className="min-h-screen bg-slate-50 p-6 lg:p-10">
			<div className="max-w-6xl mx-auto">

				{/* MANAGER'S PERSONAL ATTENDANCE SECTION */}
				<div className="mb-8">
					<h2 className="text-lg font-semibold text-slate-900 mb-4">Your Attendance</h2>
					
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
						<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
							<p className="text-xs text-slate-500 font-medium mb-3">Your Total Hours</p>
							<p className="text-2xl font-bold text-slate-900">{formatDurationFriendly((managerStats.avg || 0) * 60)}</p>
							<p className="text-xs text-slate-500 mt-2">Target: {getOfficeDurationHours(officeStart, officeEnd)} hrs/day</p>
						</div>
						<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
							<p className="text-xs text-slate-500 font-medium mb-3">Current Status</p>
							<div className="flex items-center justify-between">
								<span className={`text-2xl font-bold ${isClocked ? "text-green-600" : "text-slate-600"}`}>
									{isClocked ? "Clocked In" : "Clocked Out"}
								</span>
								<span className={`w-3 h-3 rounded-full ${isClocked ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}></span>
							</div>
							<p className="text-sm text-slate-600 mt-3 font-medium">Office: {formatOfficeTime(officeStart)} - {formatOfficeTime(officeEnd)}</p>
						</div>
					</div>

					<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
						<h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
						<button
							onClick={handleClockToggle}
							disabled={clocking}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
								isClocked
									? "bg-red-100 text-red-700 hover:bg-red-200"
									: "bg-green-100 text-green-700 hover:bg-green-200"
							} disabled:opacity-50`}
						>
							{isClocked ? (
								<>
									<Pause className="h-4 w-4" />
									Clock Out
								</>
							) : (
								<>
									<Play className="h-4 w-4" />
									Clock In
								</>
							)}
						</button>
					</div>

					{managerTodayLogs.length > 0 && (
						<div className="bg-white border border-slate-200 rounded-xl shadow-sm">
							<div className="px-6 py-4 border-b border-slate-200">
								<h3 className="text-sm font-semibold text-slate-900">My Work History</h3>
							</div>
							<div className="divide-y divide-slate-100">
								{managerTodayLogs.map((entry) => {
									const clockIn = formatTime(entry.check_in)
									const clockOut = formatTime(entry.check_out)
									const minutes = deriveSessionMinutes(entry)
									const logDate = formatDate(entry.created_at)
									const subtitle = entry.task_id ? `Task #${entry.task_id}` : entry.note || "Work session"

									return (
										<div
											key={entry.id}
											className="px-6 py-4 hover:bg-slate-50 transition"
										>
											<div
												className="flex items-center justify-between cursor-pointer"
												onClick={() =>
													setExpandedManagerLog(expandedManagerLog === entry.id ? null : entry.id)
												}
											>
												<div className="flex items-center gap-3">
													<Clock className="h-4 w-4 text-blue-600" />
													<div className="min-w-0">
														<p className="text-sm font-medium text-slate-900">{logDate}</p>
														<p className="text-xs text-slate-500">{subtitle}</p>
													</div>
												</div>
												<div className="flex items-center gap-3 shrink-0">
													<div className="text-right">
														<p className="text-sm font-semibold text-slate-900">{formatDurationFriendly(minutes)}</p>
														<p className="text-xs text-slate-500">
															{clockIn} - {clockOut}
														</p>
													</div>
													<ChevronRight
														className={`h-4 w-4 text-slate-400 transition ${
															expandedManagerLog === entry.id ? "rotate-90" : ""
														}`}
													/>
												</div>
											</div>

											{expandedManagerLog === entry.id && (
												<div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
													<div className="grid grid-cols-2 gap-2">
														<div>
															<span className="font-medium">Clock In:</span> {clockIn}
														</div>
														<div>
															<span className="font-medium">Clock Out:</span> {clockOut}
														</div>
														{entry.note && (
															<div className="col-span-2">
																<span className="font-medium">Note:</span> {entry.note}
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									)
									})}
								</div>
							</div>
						)}
				</div>

				{/* TEAM ATTENDANCE SECTION */}
				<div className="mb-8">
					<h2 className="text-lg font-semibold text-slate-900 mb-4">Team Attendance</h2>
					
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
						<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
							<p className="text-xs text-slate-500 font-medium mb-3">Present Today</p>
							<p className="text-2xl font-bold text-slate-900">{teamStats.present}</p>
							<p className="text-xs text-slate-500 mt-2">Based on {teamTodayLogs.length} records</p>
						</div>
						<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
							<p className="text-xs text-slate-500 font-medium mb-3">Late Arrivals</p>
							<p className="text-2xl font-bold text-slate-900">{teamStats.late}</p>
							<p className="text-xs text-slate-500 mt-2">After {formatOfficeTime(officeStart)} + 15 min grace</p>
						</div>
						<div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
							<p className="text-xs text-slate-500 font-medium mb-3">Avg. Hours</p>
							<p className="text-2xl font-bold text-slate-900">{formatDurationFriendly((teamStats.avg || 0) * 60)}</p>
							<p className="text-xs text-slate-500 mt-2">Target: {getOfficeDurationHours(officeStart, officeEnd)} hrs</p>
						</div>
					</div>

					<div className="bg-white border border-slate-200 rounded-xl shadow-sm">
						<div className="px-6 py-4 border-b border-slate-200">
							<h3 className="text-sm font-semibold text-slate-900">Recent Attendance</h3>
						</div>
						<div className="divide-y divide-slate-100">
							{teamTodayLogs.length === 0 ? (
								<div className="px-6 py-8 text-sm text-slate-500 text-center">No attendance records found.</div>
							) : (
								teamTodayLogs.map((entry) => {
									const name = getEmployeeName(entry)
									const initial = (entry.full_name || entry.first_name || entry.last_name || "?").charAt(0).toUpperCase()
									const clockIn = formatTime(entry.check_in)
									const clockOut = formatTime(entry.check_out)
									const status = deriveStatus(entry, officeStart)
									const workHours = deriveWorkHours(entry)
									const logDate = formatDate(entry.created_at)

									return (
										<div
											key={entry.id}
											className="px-6 py-4 hover:bg-slate-50 transition cursor-pointer"
											onClick={() =>
												setExpandedEmployee(expandedEmployee === entry.id ? null : entry.id)
											}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-4 flex-1">
													{entry.profile_photo ? (
														<img
															src={getAssetUrl(entry.profile_photo)}
															alt={name}
															className="w-10 h-10 rounded-full object-cover shrink-0"
														/>
													) : (
														<div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
															{initial}
														</div>
													)}
													<div className="min-w-0">
														<p className="text-sm font-medium text-slate-900">{name}</p>
														<p className="text-xs text-slate-500">
															{clockIn} - {clockOut}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-3 shrink-0 ml-4">
													<div className="text-right">
														<span
															className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(
																status
															)}`}
														>
															{getStatusIcon(status)}
															{status}
														</span>
														<p className="text-xs text-slate-600 mt-1 font-medium">{formatDurationFriendly((workHours || 0) * 60)}</p>
													</div>
													<ChevronRight
														className={`h-4 w-4 text-slate-400 transition ${
															expandedEmployee === entry.id ? "rotate-90" : ""
														}`}
													/>
												</div>
											</div>

											{expandedEmployee === entry.id && (
												<div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
													<div className="grid grid-cols-2 gap-2">
														<div>
															<span className="font-medium">Clock In:</span> {clockIn}
														</div>
														<div>
															<span className="font-medium">Clock Out:</span> {clockOut}
														</div>
														<div className="col-span-2">
															<span className="font-medium">Work Hours:</span> {formatDurationFriendly((workHours || 0) * 60)}
														</div>
														<div className="col-span-2">
															<span className="font-medium">Date:</span> {logDate}
														</div>
														{entry.note && (
															<div className="col-span-2">
																<span className="font-medium">Note:</span> {entry.note}
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									)
								})
							)}
						</div>
					</div>
				</div>

				{/* WEEKLY REPORT */}
				<div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
					<div className="px-6 py-4 border-b border-slate-200">
						<h2 className="text-sm font-semibold text-slate-900">Attendance Report (4 Weeks)</h2>
					</div>
					<div className="overflow-x-auto">
						{weeklyTable.length === 0 ? (
							<div className="px-6 py-6 text-sm text-slate-500 text-center">No weekly report data yet.</div>
						) : (
							<table className="w-full">
								<thead className="bg-slate-50 border-b border-slate-200">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
										<th className="px-6 py-3 text-center text-xs font-semibold text-slate-600">Week 1</th>
										<th className="px-6 py-3 text-center text-xs font-semibold text-slate-600">Week 2</th>
										<th className="px-6 py-3 text-center text-xs font-semibold text-slate-600">Week 3</th>
										<th className="px-6 py-3 text-center text-xs font-semibold text-slate-600">Week 4</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{weeklyTable.map((emp) => (
										<tr key={emp.name} className="hover:bg-slate-50">
											<td className="px-6 py-4 text-sm font-medium text-slate-900">{emp.name}</td>
											<td className="px-6 py-4 text-center">
												<span className="text-sm font-semibold text-slate-900">{emp.counts[3] || 0}/5</span>
											</td>
											<td className="px-6 py-4 text-center">
												<span className="text-sm font-semibold text-slate-900">{emp.counts[2] || 0}/5</span>
											</td>
											<td className="px-6 py-4 text-center">
												<span className="text-sm font-semibold text-slate-900">{emp.counts[1] || 0}/5</span>
											</td>
											<td className="px-6 py-4 text-center">
												<span className="text-sm font-semibold text-slate-900">{emp.counts[0] || 0}/5</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>

			</div>
		</div>
	)
}

export default ManagerTimeAttendance
