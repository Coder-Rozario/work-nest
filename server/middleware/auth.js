const jwt = require('jsonwebtoken');
const db = require('../config/database');

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization') || req.header('authorization');
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!token) {
      // guard
      return res.status(401).json({ success: false, message: 'No token, authorization denied.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // auth
    const [rows] = await db.query(
      'SELECT u.id, u.company_id, u.email, u.role, u.team_id, u.full_name, u.is_active, c.company_name FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ? LIMIT 1',
      [decoded?.id]
    ); // fetch

    const user = rows[0];
    if (!user || Number(user.is_active) !== 1) {
      // guard
      return res.status(401).json({ success: false, message: 'User account is inactive.' });
    }

    req.user = {
      ...decoded,
      id: Number(user.id),
      company_id: Number(user.company_id),
      company_name: user.company_name || decoded?.company_name || '',
      email: user.email,
      role: user.role,
      team_id: user.team_id ? Number(user.team_id) : null,
      full_name: user.full_name || decoded?.name || '',
    }; // user

    next();
  } catch (error) {
    // fail
    return res.status(401).json({ success: false, message: 'Token is not valid.' });
  }
};

const authRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      // guard
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const userRole = normalizeRole(req.user.role);
    const allowed = allowedRoles.map(normalizeRole);

    if (!allowed.includes(userRole)) {
      // access
      return res.status(403).json({ success: false, message: 'Access denied for this role.' });
    }

    next();
  };
};

module.exports = authMiddleware;
module.exports.authRole = authRole;