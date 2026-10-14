const jwt = require('jsonwebtoken');
const db = require('../config/database');

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization') || req.header('authorization');
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token, authorization denied.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, company_id, email, role, team_id, full_name, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded?.id]
    );

    const user = rows[0];
    if (Number(user.is_active) !== 1) {
      return res.status(401).json({ success: false, message: 'User account is inactive.' });
    }

    req.user = {
      ...decoded,
      id: Number(user.id),
      company_id: Number(user.company_id),
      email: user.email,
      role: user.role,
      team_id: user.team_id ? Number(user.team_id) : null,
      full_name: user.full_name || decoded?.name || '',
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token is not valid.' });
  }
};

const authRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const userRole = normalizeRole(req.user.role);
    const allowed = allowedRoles.map(normalizeRole);

    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied for this role.' });
    }

    next();
  };
};

module.exports = authMiddleware;
module.exports.authRole = authRole;