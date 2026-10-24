const db = require('../config/database');
const { getOfficeHours, getProfilePhotoUrl } = require('./timeAttendanceController');
const { getCompanyUploadUrl } = require('../utils/upload');

const getEmployeeDashboard = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const [taskRows] = await db.query(
      'SELECT COUNT(*) AS total FROM tasks WHERE assignee_id = ? AND company_id = ?',
      [userId, companyId]
    );

    const [inProgressRows] = await db.query(
      'SELECT COUNT(*) AS total FROM tasks WHERE assignee_id = ? AND company_id = ? AND status = ?',
      [userId, companyId, 'In Progress']
    );

    res.status(200).json({
      success: true,
      data: {
        assigned_tasks: taskRows[0].total,
        in_progress: inProgressRows[0].total,
      }
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getEmployeeTasks = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const [rows] = await db.query(
      'SELECT * FROM tasks WHERE assignee_id = ? AND company_id = ? ORDER BY id DESC',
      [userId, companyId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Employee task list error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateTaskProgress = async (req, res) => {
  try {
    const { progress, note } = req.body;
    const taskId = Number(req.params.id);
    const userId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const progressVal = Number.isFinite(Number(progress)) ? Number(progress) : 0;
    const nextStatus = progressVal >= 100 ? 'Submitted' : 'In Progress';

    await db.query(
      'UPDATE tasks SET progress = ?, progress_note = ?, status = ? WHERE id = ? AND assignee_id = ? AND company_id = ?',
      [progressVal, note || '', nextStatus, taskId, userId, companyId]
    );

    res.status(200).json({ success: true, message: 'Progress updated.' });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const submitTask = async (req, res) => {
  try {
    const { work_description, work_url } = req.body;
    const taskId = Number(req.params.id);
    const userId = Number(req.user.id);
    const companyId = Number(req.user.company_id);

    let fileMeta = [];
    if (Array.isArray(req.files) && req.files.length) {
      fileMeta = req.files.map((f) => ({
        name: String(f.originalname || 'upload-file'),
        url: getCompanyUploadUrl(req.user, f.filename), // path
      }));
    }

    const filesJson = fileMeta.length ? JSON.stringify(fileMeta) : ''; // save

    await db.query(
      `UPDATE tasks
       SET submission_description = ?, submission_url = ?, submission_files = ?, progress = 100, status = 'Submitted', submitted_at = NOW()
       WHERE id = ? AND assignee_id = ? AND company_id = ?`,
      [work_description || '', work_url || '', filesJson, taskId, userId, companyId]
    );

    res.status(200).json({ success: true, message: 'Task submitted for review.', data: { files: fileMeta } });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getEmployeeProjects = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM projects WHERE company_id = ? ORDER BY id DESC',
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Employee projects error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getEmployeeTeamMembers = async (req, res) => {
  try {
    if (!req.user.team_id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.position, u.team_id, t.name AS team_name,
              COALESCE((SELECT COUNT(*) FROM tasks t2 WHERE t2.company_id = u.company_id AND t2.assignee_id = u.id), 0) AS task_count
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.company_id = ?
         AND u.team_id = ?
         AND u.id != ?
         AND u.role IN ('manager', 'employee')
       ORDER BY CASE WHEN u.role = 'manager' THEN 0 ELSE 1 END, u.full_name ASC`,
      [req.user.company_id, req.user.team_id, req.user.id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Employee team members error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTimeLog = async (req, res) => {
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

    res.status(200).json({
      success: true,
      data: { records, ...officeHours }
    });
  } catch (error) {
    console.error('Time log error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT u.*, c.company_name FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ? AND u.company_id = ?',
      [req.user.id, req.user.company_id]
    );

    const user = rows[0] || {};
    const finalUser = {
      ...user,
      full_name: String(user.full_name || '').trim() || user.email || 'User',
      profile_photo: getProfilePhotoUrl(user.profile_photo),
    };

    res.status(200).json({ success: true, data: finalUser });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, position } = req.body;
    const normalizedFullName = String(full_name || '').trim() || '';

    await db.query(
      'UPDATE users SET full_name = ?, position = ? WHERE id = ? AND company_id = ?',
      [normalizedFullName, position || '', req.user.id, req.user.company_id]
    );

    res.status(200).json({ success: true, message: 'Profile updated.' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getEmployeeDashboard,
  getEmployeeTasks,
  updateTaskProgress,
  submitTask,
  getEmployeeProjects,
  getEmployeeTeamMembers,
  getTimeLog,
  getProfile,
  updateProfile,
};
