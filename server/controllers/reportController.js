const db = require('../config/database');

const getReports = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.full_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.company_id = ?
       ORDER BY t.updated_at DESC`,
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTaskSummary = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT status, COUNT(*) AS total
       FROM tasks
       WHERE company_id = ?
       GROUP BY status`,
      [req.user.company_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Get task summary error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getReports,
  getTaskSummary,
};
