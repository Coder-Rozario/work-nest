const db = require('../config/database');

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const getScopeUsers = async (user) => {
  const companyId = Number(user.company_id);
  const currentUserId = Number(user.id);
  const currentRole = normalizeRole(user.role);

  if (currentRole === 'admin') {
    const [rows] = await db.query(
      `SELECT id, full_name, email, role, team_id
       FROM users
       WHERE company_id = ?
         AND id != ?
       ORDER BY role ASC, full_name ASC, email ASC`,
      [companyId, currentUserId]
    );
    return rows;
  }

  const [rows] = await db.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.team_id
     FROM users u
     WHERE u.company_id = ?
       AND u.id != ?
       AND (
         u.role = 'admin'
         OR u.role = 'manager'
         OR u.team_id = ?
         OR u.id IN (
           SELECT t.leader_id
           FROM teams t
           WHERE t.company_id = ? AND t.id = ?
         )
       )
     ORDER BY u.role ASC, u.full_name ASC, u.email ASC`,
    [companyId, currentUserId, Number(user.team_id || 0), companyId, Number(user.team_id || 0)]
  );

  return rows;
};

const buildAttendeeOptions = async (user) => {
  const companyId = Number(user.company_id);
  const currentUserId = Number(user.id);

  const [allUsers] = await db.query(
    `SELECT id, full_name, email, role, team_id
     FROM users
     WHERE company_id = ? AND id != ?
     ORDER BY team_id ASC, role DESC, full_name ASC`,
    [companyId, currentUserId]
  );

  const [teamsData] = await db.query(
    `SELECT id, name, leader_id FROM teams WHERE company_id = ?`,
    [companyId]
  );

  const teamMap = {};
  teamsData.forEach((team) => {
    teamMap[team.id] = team;
  });

  const sortMembers = (members) => {
    return members.sort((a, b) => {
      const aIsManager = normalizeRole(a.role) === 'manager';
      const bIsManager = normalizeRole(b.role) === 'manager';

      if (aIsManager && !bIsManager) return -1;
      if (!aIsManager && bIsManager) return 1;

      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  };

  const groupedByTeam = {};

  allUsers.forEach((member) => {
    const teamId = Number(member.team_id || 0);
    const label = teamId > 0 && teamMap[teamId] ? teamMap[teamId].name : 'Unassigned Team';

    if (!groupedByTeam[label]) {
      groupedByTeam[label] = {
        label,
        team_id: teamId > 0 ? teamId : null,
        members: [],
      };
    }

    groupedByTeam[label].members.push({
      id: member.id,
      full_name: member.full_name || member.email,
      email: member.email,
      role: member.role,
    });
  });

  return Object.values(groupedByTeam)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      members: sortMembers(group.members),
    }));
};

const getMeetings = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, u.role as created_by_role
       FROM meetings m
       LEFT JOIN users u ON m.created_by = u.id
       WHERE m.company_id = ? 
       ORDER BY m.meeting_date DESC`,
      [req.user.company_id]
    );

    // attach invited attendee ids and details for each meeting
    if (rows && rows.length) {
      const meetingIds = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
      if (meetingIds.length) {
        const placeholders = meetingIds.map(() => '?').join(', ');
        const [attRows] = await db.query(
          `SELECT ma.meeting_id, u.id, u.full_name, u.email, u.role 
           FROM meeting_attendees ma
           JOIN users u ON ma.user_id = u.id
           WHERE ma.meeting_id IN (${placeholders})
           ORDER BY u.role ASC, u.full_name ASC`,
          meetingIds
        );

        const map = {};
        const mapDetails = {};
        (attRows || []).forEach((a) => {
          const mid = Number(a.meeting_id);
          const uid = Number(a.id);
          if (!map[mid]) {
            map[mid] = [];
            mapDetails[mid] = [];
          }
          map[mid].push(uid);
          mapDetails[mid].push({
            id: uid,
            full_name: a.full_name || a.email,
            email: a.email,
            role: a.role
          });
        });

        rows.forEach((r) => {
          r.selected_user_ids = map[Number(r.id)] || [];
          r.selected_user_details = mapDetails[Number(r.id)] || [];
        });
      }
    }

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createMeeting = async (req, res) => {
  try {
    const {
      title,
      meeting_date,
      meeting_time,
      organizer_name,
      participant_count,
      meeting_link,
      status,
      attendees,
      selected_user_ids,
    } = req.body;

    if (!title || !meeting_date || !meeting_time) {
      return res.status(400).json({ success: false, message: 'Meeting title, date and time are required.' });
    }

    const normalizedAttendeeIds = Array.isArray(selected_user_ids)
      ? selected_user_ids
      : Array.isArray(attendees)
        ? attendees
        : [];

    const finalOrganizerName = String(organizer_name || req.user.full_name || req.user.email || '').trim() || 'Organizer';
    const meetingParticipantCount = Number(participant_count || normalizedAttendeeIds.length || 1);

    const [result] = await db.query(
      `INSERT INTO meetings (company_id, title, meeting_date, meeting_time, organizer_name, participant_count, meeting_link, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        title,
        meeting_date,
        meeting_time,
        finalOrganizerName,
        meetingParticipantCount,
        meeting_link || '',
        status || 'Upcoming',
        req.user.id,
      ]
    );

    const meetingId = result.insertId;
    const selectedIds = [...new Set(normalizedAttendeeIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

    if (selectedIds.length) {
      const placeholders = selectedIds.map(() => '?').join(', ');
      const [existingUsers] = await db.query(
        `SELECT id FROM users WHERE company_id = ? AND id IN (${placeholders})`,
        [req.user.company_id, ...selectedIds]
      );

      const validUserIds = (existingUsers || []).map((user) => Number(user.id));
      if (validUserIds.length) {
        const values = validUserIds.map((userId) => [meetingId, userId, 'pending']).flat();

        await db.query(
          `INSERT INTO meeting_attendees (meeting_id, user_id, response_status)
           VALUES ${validUserIds.map(() => '(?, ?, ?)').join(', ')}`,
          values
        );
      }
    }

    res.status(201).json({ success: true, message: 'Meeting created.', data: { id: meetingId } });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateMeeting = async (req, res) => {
  try {
    const { title, meeting_date, meeting_time, organizer_name, participant_count, meeting_link, status, selected_user_ids } = req.body;
    const meetingId = req.params.id;
    const companyId = req.user.company_id;

    // Update meeting details
    await db.query(
      `UPDATE meetings
       SET title = ?, meeting_date = ?, meeting_time = ?, organizer_name = ?, participant_count = ?, meeting_link = ?, status = ?
       WHERE id = ? AND company_id = ?`,
      [title, meeting_date, meeting_time, organizer_name || req.user.full_name || '', participant_count || 1, meeting_link || '', status || 'Upcoming', meetingId, companyId]
    );

    // Handle selected_user_ids if provided
    if (Array.isArray(selected_user_ids)) {
      // Delete existing attendees
      await db.query('DELETE FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);

      // Insert new attendees
      const selectedIds = [...new Set(selected_user_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

      if (selectedIds.length) {
        const placeholders = selectedIds.map(() => '?').join(', ');
        const [existingUsers] = await db.query(
          `SELECT id FROM users WHERE company_id = ? AND id IN (${placeholders})`,
          [companyId, ...selectedIds]
        );

        const validUserIds = (existingUsers || []).map((user) => Number(user.id));
        if (validUserIds.length) {
          const values = validUserIds.map((userId) => [meetingId, userId, 'pending']).flat();

          await db.query(
            `INSERT INTO meeting_attendees (meeting_id, user_id, response_status)
             VALUES ${validUserIds.map(() => '(?, ?, ?)').join(', ')}`,
            values
          );
        }
      }
    }

    res.status(200).json({ success: true, message: 'Meeting updated.' });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteMeeting = async (req, res) => {
  try {
    await db.query('DELETE FROM meetings WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    res.status(200).json({ success: true, message: 'Meeting deleted.' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMeetingAttendeeOptions = async (req, res) => {
  try {
    const groups = await buildAttendeeOptions(req.user);
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error('Get meeting attendee options error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingAttendeeOptions,
};
