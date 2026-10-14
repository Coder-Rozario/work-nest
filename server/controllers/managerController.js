const db = require('../config/database');
const { getOfficeHours, getProfilePhotoUrl } = require('./timeAttendanceController');

const getManagerTeamScope = async (companyId, managerId) => {
  const [teamRows] = await db.query(
    `SELECT id FROM teams WHERE company_id = ? AND leader_id = ?`,
    [companyId, managerId]
  );

  const [managerRows] = await db.query(
    'SELECT team_id FROM users WHERE id = ? AND company_id = ? LIMIT 1',
    [managerId, companyId]
  );

  const teamIds = [
    ...new Set([
      ...teamRows.map((team) => Number(team.id)),
      ...(managerRows[0]?.team_id ? [Number(managerRows[0].team_id)] : []),
    ].filter((id) => Number.isFinite(id) && id > 0)),
  ];

  return teamIds;
};

const getManagerDashboard = async (req, res) => {
  try {
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          team_members: 0,
          active_tasks: 0,
        },
      });
    }

    const [teamRows] = await db.query(
      `SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND team_id IN (?)`,
      [req.user.company_id, teamIds]
    );

    const [taskRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM tasks
       WHERE company_id = ?
         AND assignee_id IN (
           SELECT id FROM users WHERE company_id = ? AND team_id IN (?)
         )
         AND status IN ('Assigned', 'In Progress', 'Submitted')`,
      [req.user.company_id, req.user.company_id, teamIds]
    );

    res.status(200).json({
      success: true,
      data: {
        team_members: Number(teamRows[0]?.total || 0),
        active_tasks: Number(taskRows[0]?.total || 0),
      }
    });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getManagerTeam = async (req, res) => {
  try {
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.position, u.team_id, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.company_id = ? AND u.team_id IN (?)
       ORDER BY u.full_name ASC`,
      [req.user.company_id, teamIds]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Manager team error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getManagerTeamMembers = async (req, res) => {
  try {
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.position, u.team_id, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.company_id = ?
         AND u.team_id IN (?)
         AND u.id != ?
         AND u.role IN ('manager', 'employee')
       ORDER BY u.full_name ASC`,
      [req.user.company_id, teamIds, req.user.id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Manager team members error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getManagerTasks = async (req, res) => {
  try {
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT t.*, u.full_name, u.email, u.role
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.company_id = ?
         AND t.assignee_id IN (
           SELECT id FROM users WHERE company_id = ? AND team_id IN (?)
         )
       ORDER BY t.id DESC`,
      [req.user.company_id, req.user.company_id, teamIds]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Manager task list error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, project_name, assignee_id, priority, due_date, status } = req.body;

    if (!title || !assignee_id) {
      return res.status(400).json({ success: false, message: 'Title and assignee are required.' });
    }

    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);
    if (!teamIds.length) {
      return res.status(403).json({ success: false, message: 'You do not manage any team yet.' });
    }

    const [assigneeRows] = await db.query(
      `SELECT id FROM users WHERE id = ? AND company_id = ? AND team_id IN (?)`,
      [assignee_id, req.user.company_id, teamIds]
    );

    if (!assigneeRows.length) {
      return res.status(403).json({ success: false, message: 'Assignee must be in your team.' });
    }

    const [result] = await db.query(
      `INSERT INTO tasks (company_id, title, project_name, assignee_id, priority, due_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ? )`,
      [req.user.company_id, title, project_name || '', assignee_id, priority || 'Medium', due_date || null, status || 'Assigned', req.user.id]
    );

    res.status(201).json({ success: true, message: 'Task created.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(403).json({ success: false, message: 'You do not manage any team.' });
    }

    await db.query(
      `UPDATE tasks
       SET status = ?
       WHERE id = ?
         AND company_id = ?
         AND assignee_id IN (
           SELECT id FROM users WHERE company_id = ? AND team_id IN (?)
         )`,
      [status, req.params.id, req.user.company_id, req.user.company_id, teamIds]
    );

    res.status(200).json({ success: true, message: 'Task status updated.' });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getManagerReports = async (req, res) => {
  try {
    const teamIds = await getManagerTeamScope(req.user.company_id, req.user.id);

    if (!teamIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT t.id, t.title, t.status, u.full_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.company_id = ?
         AND t.assignee_id IN (
           SELECT id FROM users WHERE company_id = ? AND team_id IN (?)
         )
       ORDER BY t.id DESC`,
      [req.user.company_id, req.user.company_id, teamIds]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Manager report error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getManagerTimeLog = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const [rows] = await db.query(
      `SELECT tl.*, u.full_name, u.profile_photo
       FROM time_logs tl
       LEFT JOIN users u ON u.id = tl.user_id
       WHERE tl.user_id = ? AND tl.company_id = ?
       ORDER BY tl.created_at DESC LIMIT 50`,
      [userId, companyId]
    );

    const records = rows.map((r) => ({
      ...r,
      profile_photo: getProfilePhotoUrl(r.profile_photo, r.company_id || companyId),
    }));

    const officeHours = await getOfficeHours(companyId);

    res.status(200).json({ success: true, data: { records, ...officeHours } });
  } catch (error) {
    console.error('Manager time log error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getManagerDashboard,
  getManagerTeam,
  getManagerTeamMembers,
  getManagerTasks,
  createTask,
  updateTaskStatus,
  getManagerReports,
  getManagerTimeLog,
  getManagerTeamScope,
};
