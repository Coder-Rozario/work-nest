import { useState, useEffect } from "react"
import { Plus, Calendar, Users, Clock, Trash2, Loader2, X, UserPlus } from "lucide-react"
import { meetingAPI } from "../../services/api"
import { useRealtime } from "../../hooks/useRealtime"

const emptyMeeting = {
  title: "",
  meeting_date: "",
  meeting_time: "",
  organizer_name: "",
  participant_count: 1,
  meeting_link: "",
  selected_user_ids: [],
  selected_user_details: [],
}

function formatDateForInput(dateString) {
  if (!dateString) return ""
  
  const cleanDate = String(dateString).trim()
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return cleanDate
  }
  
  let dateOnly = cleanDate.split(" ")[0]
  if (!dateOnly || dateOnly.includes("T")) {
    dateOnly = cleanDate.split("T")[0]
  }
  
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly
  }
  
  try {
    const dateObj = new Date(cleanDate)
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, "0")
      const day = String(dateObj.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    }
  } catch {
    // Ignore invalid date strings
  }
  
  return ""
}

function formatTimeForInput(timeString) {
  if (!timeString) return ""
  
  const cleanTime = String(timeString).trim()
  
  if (/^\d{2}:\d{2}$/.test(cleanTime)) {
    return cleanTime
  }
  
  if (cleanTime.includes(":")) {
    const timeParts = cleanTime.split(":")
    if (timeParts.length >= 2) {
      const hours = String(timeParts[0]).padStart(2, "0")
      const minutes = String(timeParts[1]).padStart(2, "0")
      return `${hours}:${minutes}`
    }
  }
  
  return cleanTime
}

function getMeetingDraft(meeting) {
  if (!meeting) return { ...emptyMeeting }
  
  let selectedIds = []
  if (Array.isArray(meeting.selected_user_details) && meeting.selected_user_details.length > 0) {
    selectedIds = meeting.selected_user_details.map(u => Number(u.id))
  } else if (Array.isArray(meeting.selected_user_ids)) {
    selectedIds = meeting.selected_user_ids
  }
  
  let meetingDate = formatDateForInput(meeting.meeting_date)
  let meetingTime = formatTimeForInput(meeting.meeting_time)
  
  return {
    title: meeting.title || "",
    meeting_date: meetingDate || "",
    meeting_time: meetingTime || "",
    organizer_name: meeting.organizer_name || "",
    participant_count: meeting.participant_count || 1,
    meeting_link: meeting.meeting_link || "",
    selected_user_ids: selectedIds,
    selected_user_details: Array.isArray(meeting.selected_user_details) ? meeting.selected_user_details : [],
  }
}

function formatMeetingDate(dateString) {
  if (!dateString) return "-"

  const cleanDate = String(dateString).trim()
  const safeDate = cleanDate.includes('T') ? cleanDate : `${cleanDate}T00:00:00`
  const parsedDate = new Date(safeDate)

  if (Number.isNaN(parsedDate.getTime())) {
    return cleanDate
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMeetingTime(timeString) {
  if (!timeString) return "-"

  const cleanTime = String(timeString).trim()

  if (!cleanTime.includes(":")) {
    return cleanTime
  }

  const [hours, minutes] = cleanTime.split(":")
  const hour = Number(hours)
  if (Number.isNaN(hour)) return cleanTime

  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minutes || "00").padStart(2, "0")} ${suffix}`
}

function mapMeeting(m) {
  let selectedUserIds = []
  if (Array.isArray(m.selected_user_details) && m.selected_user_details.length > 0) {
    selectedUserIds = m.selected_user_details.map(u => Number(u.id))
  } else if (Array.isArray(m.selected_user_ids)) {
    selectedUserIds = m.selected_user_ids
  }
  
  const participantCount = Math.max(
    Number(m.participant_count) || 0,
    selectedUserIds.length || 0,
    1
  )

  return {
    id: m.id,
    title: m.title,
    date: formatMeetingDate(m.meeting_date),
    time: formatMeetingTime(m.meeting_time),
    organizer: m.organizer_name,
    organizer_role: m.created_by_role || "",
    participants: participantCount,
    link: m.meeting_link,
    status: m.status || "Upcoming",
    meeting_date: m.meeting_date,
    meeting_time: m.meeting_time,
    organizer_name: m.organizer_name,
    participant_count: participantCount,
    meeting_link: m.meeting_link,
    selected_user_ids: selectedUserIds,
    selected_user_details: m.selected_user_details || [],
    created_by: m.created_by,
    created_by_role: m.created_by_role || "",
  }
}

const Meetings = function () {
  const [meetingList, setMeetingList] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [formData, setFormData] = useState(getMeetingDraft())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [attendeeGroups, setAttendeeGroups] = useState([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)

  const currentUser = JSON.parse(localStorage.getItem("worknest_user") || "{}")

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await meetingAPI.getMeetings()
      const mapped = (response || []).map(mapMeeting)
      setMeetingList(mapped)
    } catch (err) {
      console.error("Failed to load meetings:", err)
      setError("Failed to load meetings")
    } finally {
      setLoading(false)
    }
  }

  useRealtime(["meetings", "employees"], () => {
    void fetchMeetings()
  })

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true)
        setLoadingAttendees(true)
        setError("")

        const [meetingsResponse, attendeesResponse] = await Promise.all([
          meetingAPI.getMeetings(),
          meetingAPI.getMeetingOptions(),
        ]);

        if (!isMounted) return;

        setMeetingList((meetingsResponse || []).map(mapMeeting));
        setAttendeeGroups(Array.isArray(attendeesResponse) ? attendeesResponse : []);
      } catch (err) {
        console.error('Failed to load meeting data:', err);
        if (isMounted) {
          setError('Failed to load meeting data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingAttendees(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [])

  function updateForm(field, value) {
    setFormData(function (current) {
      return { ...current, [field]: value }
    })
  }

  const toggleSelectedUser = (userId) => {
    setFormData((current) => {
      const selected = new Set(current.selected_user_ids || [])
      const selectedDetails = Array.isArray(current.selected_user_details) ? [...current.selected_user_details] : []
      
      if (selected.has(userId)) {
        selected.delete(userId)
        const index = selectedDetails.findIndex(u => Number(u.id) === userId)
        if (index > -1) {
          selectedDetails.splice(index, 1)
        }
      } else {
        selected.add(userId)
        const userToAdd = attendeeGroups.flatMap(g => g.members || []).find(m => Number(m.id) === userId)
        if (userToAdd && !selectedDetails.find(u => Number(u.id) === userId)) {
          selectedDetails.push({
            id: userId,
            full_name: userToAdd.full_name,
            email: userToAdd.email,
            role: userToAdd.role
          })
        }
      }
      
      return { ...current, selected_user_ids: Array.from(selected), selected_user_details: selectedDetails }
    })
  }

  const openEditModal = (meeting) => {
    setSelectedMeeting(meeting)
    setFormData(getMeetingDraft(meeting))
    setShowEditModal(true)
  }

  const addMeeting = async () => {
    if (!formData.title || !formData.meeting_date || !formData.meeting_time) return
    try {
      setSubmitting(true)
      setError("")
      const selectedIds = Array.isArray(formData.selected_user_ids) ? formData.selected_user_ids : []
      const participantCount = selectedIds.length > 0 ? selectedIds.length : (Number(formData.participant_count) || 1)
      const payload = {
        title: formData.title,
        meeting_date: formData.meeting_date,
        meeting_time: formData.meeting_time,
        organizer_name: formData.organizer_name || currentUser?.name || currentUser?.full_name || "",
        participant_count: participantCount,
        meeting_link: formData.meeting_link,
        status: "Upcoming",
        selected_user_ids: selectedIds,
      }
      await meetingAPI.createMeeting(payload)
      setFormData(getMeetingDraft())
      setShowAddModal(false)
      await fetchMeetings()
    } catch (err) {
      console.error("Failed to create meeting:", err)
      setError("Failed to create meeting")
    } finally {
      setSubmitting(false)
    }
  }

  const editMeeting = async () => {
    if (!selectedMeeting || !formData.title) return
    try {
      setSubmitting(true)
      setError("")
      const selectedIds = Array.isArray(formData.selected_user_ids) ? formData.selected_user_ids : []
      const participantCount = selectedIds.length > 0 ? selectedIds.length : (Number(formData.participant_count) || 1)
      const payload = {
        title: formData.title,
        meeting_date: formData.meeting_date,
        meeting_time: formData.meeting_time,
        organizer_name: formData.organizer_name || currentUser?.name || currentUser?.full_name || "",
        participant_count: participantCount,
        meeting_link: formData.meeting_link,
        selected_user_ids: selectedIds,
      }
      await meetingAPI.updateMeeting(selectedMeeting.id, payload)
      setShowEditModal(false)
      setSelectedMeeting(null)
      await fetchMeetings()
    } catch (err) {
      console.error("Failed to update meeting:", err)
      setError("Failed to update meeting")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteMeeting = (id) => {
    const ok = window.confirm("Are you sure you want to delete this meeting? This action cannot be undone.")
    if (!ok) return
    ;(async () => {
      try {
        setError("")
        await meetingAPI.deleteMeeting(id)
        await fetchMeetings()
      } catch (err) {
        console.error("Failed to delete meeting:", err)
        setError("Failed to delete meeting")
      }
    })()
  }

  const upcomingMeetings = meetingList.filter((m) => m.status == "Upcoming")
  const completedMeetings = meetingList.filter(function (m) { return m.status == "Completed" })

  const getSelectedParticipants = () => {
    if (Array.isArray(formData.selected_user_details) && formData.selected_user_details.length > 0) {
      return formData.selected_user_details
    }
    
    const selectedIds = new Set(formData.selected_user_ids || [])
    const selected = []
    
    attendeeGroups.forEach((group) => {
      (group.members || []).forEach((member) => {
        if (selectedIds.has(Number(member.id))) {
          selected.push(member)
        }
      })
    })
    
    return selected
  }

  const getAvailableParticipants = () => {
    const selectedIds = new Set(formData.selected_user_ids || [])
    const available = []
    
    attendeeGroups.forEach((group) => {
      (group.members || []).forEach((member) => {
        if (!selectedIds.has(Number(member.id))) {
          available.push({ ...member, group: group.label })
        }
      })
    })
    
    return available
  }

  const toggleTeamAll = (teamGroup) => {
    const memberIds = (teamGroup.members || []).map((member) => Number(member.id))
    const selected = new Set(formData.selected_user_ids || [])
    const selectedDetails = Array.isArray(formData.selected_user_details) ? [...formData.selected_user_details] : []
    
    const allSelected = memberIds.every((id) => selected.has(id))

    if (allSelected) {
      memberIds.forEach((id) => {
        selected.delete(id)
        const index = selectedDetails.findIndex(u => Number(u.id) === id)
        if (index > -1) {
          selectedDetails.splice(index, 1)
        }
      })
    } else {
      memberIds.forEach((id) => {
        selected.add(id)
        const member = teamGroup.members.find(m => Number(m.id) === id)
        if (member && !selectedDetails.find(u => Number(u.id) === id)) {
          selectedDetails.push({
            id: Number(id),
            full_name: member.full_name,
            email: member.email,
            role: member.role
          })
        }
      })
    }

    setFormData((current) => ({
      ...current,
      selected_user_ids: Array.from(selected),
      selected_user_details: selectedDetails
    }))
  }

  const renderFormFields = () => {
    const selectedCount = (formData.selected_user_ids || []).length
    const selectedParticipants = getSelectedParticipants()
    const availableParticipants = getAvailableParticipants()

    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Meeting Details</h3>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">Host</span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meeting Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Meeting Title"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Meeting Date</label>
              <input
                type="date"
                value={formData.meeting_date}
                onChange={(event) => updateForm("meeting_date", event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Meeting Time</label>
              <input
                type="time"
                value={formData.meeting_time}
                onChange={(event) => updateForm("meeting_time", event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Organizer Name</label>
            <input
              type="text"
              readOnly
              value={formData.organizer_name || currentUser?.name || currentUser?.full_name || ""}
              onChange={(event) => updateForm("organizer_name", event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Organizer Name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meeting Link</label>
            <input
              type="text"
              value={formData.meeting_link}
              onChange={(event) => updateForm("meeting_link", event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Meeting Link (e.g., https://meet.google.com/)"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Meeting Participants</h3>
            <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
              {selectedCount} invited
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {loadingAttendees ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading users...
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Invited ({selectedCount})
                    </span>
                  </div>
                  
                  {selectedParticipants.length > 0 ? (
                    <div className="space-y-2">
                      {selectedParticipants.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 transition"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="truncate text-sm font-medium text-slate-800">
                              {member.full_name || member.email || `User ${member.id}`}
                            </div>
                            <div className="truncate text-[10px] text-slate-600">
                              {member.role}
                            </div>
                            <div className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-slate-500">
                              {member.team_name || member.team || ""} • ID: {member.id}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleSelectedUser(Number(member.id))}
                            className="shrink-0 rounded-md bg-red-100 p-1 text-red-600 hover:bg-red-200 transition"
                            title="Remove participant"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      No participants invited yet
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="mb-2 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Available ({availableParticipants.length})
                    </span>
                  </div>

                  {availableParticipants.length > 0 ? (
                    <div className="space-y-3">
                      {attendeeGroups.map((group) => {
                        const selectedIds = new Set(formData.selected_user_ids || [])
                        const availableInGroup = (group.members || []).filter((member) => !selectedIds.has(Number(member.id)))
                        const allSelected = (group.members || []).length > 0 && (group.members || []).every((member) => selectedIds.has(Number(member.id)))
                        
                        return availableInGroup.length > 0 || allSelected ? (
                          <div key={group.team_id || group.label} className="rounded-lg border border-slate-200 bg-white p-2.5">
                            <div className="mb-2 flex items-center justify-between px-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{group.label}</span>
                              <button
                                type="button"
                                onClick={() => toggleTeamAll(group)}
                                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                {allSelected ? "Deselect all" : "Select all"}
                              </button>
                            </div>
                            <div className="space-y-2">
                              {availableInGroup.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/30"
                                >
                                  <div className="min-w-0 flex-1 pr-3">
                                    <div className="truncate text-sm font-medium text-slate-800">
                                      {member.full_name || member.email || `User ${member.id}`}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-600">
                                      {member.role}
                                    </div>
                                    <div className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-slate-500">
                                      {group.label} • ID: {member.id}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectedUser(Number(member.id))}
                                    className="shrink-0 rounded-md bg-blue-100 p-1 text-blue-600 hover:bg-blue-200 transition"
                                    title="Add participant"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      All available members are invited
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-sm font-semibold text-slate-700">Upcoming Meetings</span>
            <p className="mt-2 text-2xl font-bold text-slate-900">{upcomingMeetings.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-sm font-semibold text-slate-700">Completed Meetings</span>
            <p className="mt-2 text-2xl font-bold text-slate-900">{completedMeetings.length}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All Meetings</h2>
            {currentUser?.role !== 'employee' && (
              <button
                onClick={() => { setFormData(getMeetingDraft()); setShowAddModal(true) }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Schedule Meeting
              </button>
            )}
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {meetingList.map(function (meeting) {
                  return (
                    <div key={meeting.id} className="rounded-lg border border-slate-200 p-4 transition hover:shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{meeting.title}</h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{meeting.date}</div>
                            <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{meeting.time}</div>
                            <div className="flex items-center gap-2"><Users className="h-4 w-4" />{meeting.participants} participants</div>
                            <div className="text-xs flex items-center gap-2">
                              <span>Organizer: {meeting.organizer}</span>
                              {meeting.created_by_role && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  meeting.created_by_role.toLowerCase() === 'admin' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : meeting.created_by_role.toLowerCase() === 'manager'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {meeting.created_by_role.charAt(0).toUpperCase() + meeting.created_by_role.slice(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto">
                          <span className={`rounded-full px-2.5 py-1 text-center text-xs font-semibold ${meeting.status == "Upcoming" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                            {meeting.status}
                          </span>
                          {meeting.link && (
                            <a href={meeting.link} target="_blank" rel="noreferrer" className="truncate text-xs font-medium text-blue-600 hover:underline">
                              Join Meeting
                            </a>
                          )}
                          {Number(currentUser?.id) === Number(meeting.created_by) && (
                            <div className="flex gap-2">
                              <button onClick={() => openEditModal(meeting)} className="flex-1 rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">Edit</button>
                              <button onClick={function () { deleteMeeting(meeting.id) }} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {meetingList.length == 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">No meetings scheduled yet</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Schedule</p>
                <h2 className="text-2xl font-bold text-slate-900">New Meeting</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {renderFormFields()}
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-5">
              <button onClick={function () { setShowAddModal(false) }} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50" disabled={submitting}>Cancel</button>
              <button onClick={addMeeting} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={submitting}>
                {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</span> : "Schedule Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Update</p>
                <h2 className="text-2xl font-bold text-slate-900">Edit Meeting</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {renderFormFields()}
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-5">
              <button onClick={() => setShowEditModal(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50" disabled={submitting}>Cancel</button>
              <button onClick={editMeeting} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={submitting}>
                {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving...</span> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Meetings
