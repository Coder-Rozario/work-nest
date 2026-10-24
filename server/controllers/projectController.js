const db = require('../config/database');

const getUserScopedTeamNames = async (user) => {
  if (!user || !user.company_id || String(user.role || '').toLowerCase() === 'admin') {
    return [];
  }

  const companyId = Number(user.company_id);
  const teamIds = [];

  const [leaderRows] = await db.query(
    'SELECT id FROM teams WHERE company_id = ? AND leader_id = ?',
    [companyId, user.id]
  );

  if (Array.isArray(leaderRows)) {
    leaderRows.forEach((row) => {
      if (Number.isFinite(Number(row.id)) && Number(row.id) > 0) {
        teamIds.push(Number(row.id));
      }
    });
  }

  if (user.team_id) {
    const teamId = Number(user.team_id);
    if (Number.isFinite(teamId) && teamId > 0) {
      teamIds.push(teamId);
    }
  }

  const uniqueTeamIds = [...new Set(teamIds)];

  if (!uniqueTeamIds.length) {
    return [];
  }

  const [teamRows] = await db.query(
    'SELECT name FROM teams WHERE company_id = ? AND id IN (?)',
    [companyId, uniqueTeamIds]
  );

  return (teamRows || []).map((team) => String(team.name || '').trim()).filter(Boolean);
};

const normalizeTeamNames = (value) => {
  const rawList = Array.isArray(value) ? value : String(value || '').split(',');
  const names = rawList.map((name) => String(name || '').trim()).filter(Boolean);
  return [...new Set(names)];
};

// A project can be assigned to multiple teams, so team_name holds a comma-separated list
const buildTeamScope = (values) =>
  values.map((value) => `FIND_IN_SET(${value}, REPLACE(p.team_name, ', ', ','))`).join(' OR ');

const getProjects = async (req, res) => {
  try {
    const companyId = Number(req.user.company_id);
    const baseQuery = `
      SELECT p.*, u.full_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.company_id = ?
    `;

    if (String(req.user.role || '').toLowerCase() !== 'admin') {
      const scopedTeamNames = await getUserScopedTeamNames(req.user);

      if (!scopedTeamNames.length) {
        return res.status(200).json({ success: true, data: [] });
      }

      const [rows] = await db.query(
        `${baseQuery} AND (${buildTeamScope(scopedTeamNames.map(() => '?'))}) ORDER BY p.id DESC`,
        [companyId, ...scopedTeamNames]
      );

      return res.status(200).json({ success: true, data: rows });
    }

    const [rows] = await db.query(
      `${baseQuery} ORDER BY p.id DESC`,
      [companyId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      team_name,
      start_date,
      due_date,
      progress,
      priority,
      project_type,
      status
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO projects (
        company_id, name, description, team_name, start_date, due_date,
        progress, priority, project_type, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        name,
        description || '',
        normalizeTeamNames(team_name).join(', ') || null,
        start_date || null,
        due_date || null,
        Number(progress) || 0,
        priority || 'Medium',
        project_type || 'Internal',
        status || 'To Do',
        req.user.id
      ]
    );

    res.status(201).json({ success: true, message: 'Project created.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateProject = async (req, res) => {
  try {
    const {
      name,
      description,
      team_name,
      start_date,
      due_date,
      progress,
      priority,
      project_type,
      status
    } = req.body;
    // fetch existing project to avoid overwriting unspecified fields
    const [rows] = await db.query('SELECT * FROM projects WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    if (!rows || !rows.length) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const existing = rows[0];

    const updatedName = typeof name === 'undefined' ? existing.name : name;
    const updatedDescription = typeof description === 'undefined' ? existing.description : description;
    const updatedTeamName = typeof team_name === 'undefined' ? existing.team_name : normalizeTeamNames(team_name).join(', ') || null;
    const updatedStartDate = typeof start_date === 'undefined' ? existing.start_date : start_date;
    const updatedDueDate = typeof due_date === 'undefined' ? existing.due_date : due_date;
    const updatedProgress = typeof progress === 'undefined' ? existing.progress : Number(progress) || 0;
    const updatedPriority = typeof priority === 'undefined' ? existing.priority : priority;
    const updatedProjectType = typeof project_type === 'undefined' ? existing.project_type : project_type;
    const updatedStatus = typeof status === 'undefined' ? existing.status : status;

    await db.query(
      `UPDATE projects
       SET name = ?,
           description = ?,
           team_name = ?,
           start_date = ?,
           due_date = ?,
           progress = ?,
           priority = ?,
           project_type = ?,
           status = ?
       WHERE id = ? AND company_id = ?`,
      [
        updatedName,
        updatedDescription || '',
        updatedTeamName || null,
        updatedStartDate || null,
        updatedDueDate || null,
        updatedProgress,
        updatedPriority || 'Medium',
        updatedProjectType || 'Internal',
        updatedStatus || 'To Do',
        req.params.id,
        req.user.company_id
      ]
    );

    res.status(200).json({ success: true, message: 'Project updated.' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteProject = async (req, res) => {
  try {
    await db.query('DELETE FROM projects WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    res.status(200).json({ success: true, message: 'Project deleted.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTeams = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.full_name, COUNT(u2.id) AS member_count,
              (SELECT COUNT(*) FROM projects p
                WHERE p.company_id = t.company_id
                  AND COALESCE(p.status, '') <> 'Completed'
                  AND ${buildTeamScope(['t.name'])}
              ) AS activeProjects
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       LEFT JOIN users u2 ON u2.team_id = t.id AND u2.company_id = ?
       WHERE t.company_id = ?
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [req.user.company_id, req.user.company_id]
    );

    const normalizedRows = (rows || []).map((team) => ({
      ...team,
      leader: team.leader_id ? team.full_name || '' : '',
      member_count: Number(team.member_count || 0),
      activeProjects: Number(team.activeProjects || 0),
    }));

    res.status(200).json({ success: true, data: normalizedRows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createTeam = async (req, res) => {
  try {
    const { name, description, leader_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Team name is required.' });
    }

    if (leader_id) {
      const [leaderRows] = await db.query(
        'SELECT id FROM users WHERE id = ? AND company_id = ? AND role = ?',
        [leader_id, req.user.company_id, 'manager']
      );

      if (!leaderRows.length) {
        return res.status(400).json({ success: false, message: 'Selected team leader must be a manager in this company.' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO teams (company_id, name, description, leader_id)
       VALUES (?, ?, ?, ?)`,
      [req.user.company_id, name, description || '', leader_id || null]
    );

    res.status(201).json({ success: true, message: 'Team created.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { name, description, leader_id } = req.body;

    if (leader_id) {
      const [leaderRows] = await db.query(
        'SELECT id FROM users WHERE id = ? AND company_id = ? AND role = ?',
        [leader_id, req.user.company_id, 'manager']
      );

      if (!leaderRows.length) {
        return res.status(400).json({ success: false, message: 'Selected team leader must be a manager in this company.' });
      }
    }

    await db.query(
      `UPDATE teams
       SET name = ?, description = ?, leader_id = ?
       WHERE id = ? AND company_id = ?`,
      [name, description || '', leader_id || null, req.params.id, req.user.company_id]
    );

    res.status(200).json({ success: true, message: 'Team updated.' });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteTeam = async (req, res) => {
  try {
    await db.query('DELETE FROM teams WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    res.status(200).json({ success: true, message: 'Team deleted.' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
};
