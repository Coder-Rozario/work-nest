const db = require('../config/database');
const bcrypt = require('bcryptjs');

const getAdminDashboard = async (req, res) => {
  try {
    const [employeeCount] = await db.query(
      'SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND role != ?',
      [req.user.company_id, 'admin']
    );

    const [taskCount] = await db.query(
      'SELECT COUNT(*) AS total FROM tasks WHERE company_id = ?',
      [req.user.company_id]
    );

    const [projectCount] = await db.query(
      'SELECT COUNT(*) AS total FROM projects WHERE company_id = ?',
      [req.user.company_id]
    );

    const [meetingCount] = await db.query(
      'SELECT COUNT(*) AS total FROM meetings WHERE company_id = ?',
      [req.user.company_id]
    );

    res.status(200).json({
      success: true,
      data: {
        total_employees: employeeCount[0].total,
        total_tasks: taskCount[0].total,
        total_projects: projectCount[0].total,
        total_meetings: meetingCount[0].total,
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const normalizeFullName = (payload = {}) => {
  if (payload.full_name && String(payload.full_name).trim()) {
    return String(payload.full_name).trim();
  }
  return '';
};

const getEmployees = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.position, u.is_active, u.team_id, t.name AS team_name
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.company_id = ?
       ORDER BY u.id DESC`,
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const normalizePassword = (password) => {
  const value = String(password || '').trim();
  if (!value) {
    throw new Error('Password is required.');
  }
  return value;
};

const addEmployee = async (req, res) => {
  try {
    const { email, role, position, team_id, is_active, password } = req.body;
    const full_name = normalizeFullName(req.body);

    if (!full_name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Full name, email and role are required.' });
    }

    const enteredPassword = normalizePassword(password);
    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingRows] = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = ? AND company_id = ?',
      [normalizedEmail, req.user.company_id]
    );
    if (existingRows.length) {
      return res.status(409).json({ success: false, message: 'An employee with this email already exists in your company.' });
    }

    if (team_id) {
      const [teamRows] = await db.query('SELECT id FROM teams WHERE id = ? AND company_id = ?', [team_id, req.user.company_id]);
      if (!teamRows.length) {
        return res.status(400).json({ success: false, message: 'Selected team does not exist in your company.' });
      }
    }

    const password_hash = await bcrypt.hash(enteredPassword, 10);

    const [result] = await db.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, position, team_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, full_name, normalizedEmail, password_hash, String(role).trim().toLowerCase(), position || '', team_id || null, is_active !== undefined ? is_active : 1]
    );

    res.status(201).json({
      success: true,
      message: 'Employee added.',
      data: { id: result.insertId },
      temporary_password: enteredPassword,
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { email, role, position, team_id, is_active, password } = req.body;
    const full_name = normalizeFullName(req.body);

    const [existingRows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.company_id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (team_id !== undefined && team_id !== null && team_id !== '') {
      const [teamRows] = await db.query('SELECT id FROM teams WHERE id = ? AND company_id = ?', [team_id, req.user.company_id]);
      if (!teamRows.length) {
        return res.status(400).json({ success: false, message: 'Selected team does not exist in your company.' });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (full_name !== undefined && full_name !== null && String(full_name).trim() !== '') {
      updateFields.push('full_name = ?');
      updateValues.push(String(full_name).trim());
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(String(email).trim().toLowerCase());
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(String(role).trim().toLowerCase());
    }
    if (position !== undefined) {
      updateFields.push('position = ?');
      updateValues.push(position || '');
    }
    if (team_id !== undefined) {
      updateFields.push('team_id = ?');
      updateValues.push(team_id === '' || team_id === null ? null : Number(team_id));
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }
    if (password !== undefined && String(password).trim() !== '') {
      const enteredPassword = String(password).trim();
      const password_hash = await bcrypt.hash(enteredPassword, 10);
      updateFields.push('password_hash = ?');
      updateValues.push(password_hash);
    }

    if (!updateFields.length) {
      return res.status(400).json({ success: false, message: 'No update fields provided.' });
    }

    updateValues.push(req.params.id, req.user.company_id);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND company_id = ?`,
      updateValues
    );

    res.status(200).json({
      success: true,
      message: 'Employee updated.',
      temporary_password: password && String(password).trim() ? String(password).trim() : null,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    res.status(200).json({ success: true, message: 'Employee deleted.' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTeams = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM teams WHERE company_id = ? ORDER BY name ASC', [req.user.company_id]);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getProjects = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM projects WHERE company_id = ? ORDER BY id DESC', [req.user.company_id]);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getReports = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.title, t.status, t.priority, u.full_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.company_id = ?
       ORDER BY t.id DESC`,
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAdminSettings = async (req, res) => {
  try {
    const [companyRows] = await db.query(
      'SELECT id, company_name, industry, company_size, created_by_email FROM companies WHERE id = ?',
      [req.user.company_id]
    );

    const [settingsRows] = await db.query(
      'SELECT * FROM settings WHERE company_id = ? AND user_id = ?',
      [req.user.company_id, req.user.id]
    );

    const company = companyRows[0] || {};
    const settings = settingsRows[0] || {};

    res.status(200).json({
      success: true,
      data: {
        company_name: company.company_name || '',
        industry: company.industry || '',
        company_size: company.company_size || '',
        email: settings.email || company.created_by_email || '',
        phone: settings.phone || '',
        address: settings.address || '',
        office_start: settings.office_start || settings.officeStart || '09:00',
        office_end: settings.office_end || settings.officeEnd || '17:00',
      }
    });
  } catch (error) {
    console.error('Get admin settings error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateAdminSettings = async (req, res) => {
  try {
    const { company_name, industry, company_size, email, phone, address, office_start, office_end } = req.body;

    // Only update company fields that were explicitly provided, so partial
    // updates (e.g. saving only office hours from the Time Attendance page)
    // do not wipe the existing company details.
    const companyUpdates = [];
    const companyValues = [];
    if (company_name !== undefined) { companyUpdates.push('company_name = ?'); companyValues.push(company_name || ''); }
    if (industry !== undefined) { companyUpdates.push('industry = ?'); companyValues.push(industry || ''); }
    if (company_size !== undefined) { companyUpdates.push('company_size = ?'); companyValues.push(company_size || ''); }
    if (email !== undefined) { companyUpdates.push('created_by_email = ?'); companyValues.push(email || ''); }
    if (companyUpdates.length > 0) {
      companyValues.push(req.user.company_id);
      await db.query(
        `UPDATE companies SET ${companyUpdates.join(', ')} WHERE id = ?`,
        companyValues
      );
    }

    // single upsert for all settings including office hours
    await db.query(
      `INSERT INTO settings (company_id, user_id, email, phone, address, office_start, office_end)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         phone = VALUES(phone),
         address = VALUES(address),
         office_start = VALUES(office_start),
         office_end = VALUES(office_end)`,
      [
        req.user.company_id,
        req.user.id,
        email !== undefined ? (email || '') : '',
        phone !== undefined ? (phone || '') : '',
        address !== undefined ? (address || '') : '',
        office_start !== undefined ? (office_start || '09:00') : '09:00',
        office_end !== undefined ? (office_end || '17:00') : '17:00'
      ]
    );

    res.status(200).json({ success: true, message: 'Settings updated.' });
  } catch (error) {
    console.error('Update admin settings error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAdminTasks = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.full_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.company_id = ?
       ORDER BY t.id DESC`,
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Admin task list error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAdminDashboard,
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getTeams,
  getProjects,
  getReports,
  getAdminSettings,
  updateAdminSettings,
  getAdminTasks,
};
