const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');

const MAX_FAILED_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      company_id: user.company_id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateResetCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashResetCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const getProfilePhotoUrl = (photo) => {
  if (!photo) return '';
  if (String(photo).startsWith('http://') || String(photo).startsWith('https://')) return photo;
  if (String(photo).startsWith('/')) return photo;
  return `/uploads/companies/${photo}`;
};

const getUserDisplayName = (user) => {
  if (!user) return '';
  if (user.full_name && String(user.full_name).trim()) {
    return String(user.full_name).trim();
  }
  return '';
};

const normalizeUserResponse = (user) => ({
  id: user.id,
  company_id: user.company_id,
  email: user.email,
  role: user.role,
  name: getUserDisplayName(user),
  company_name: user.company_name || '',
  position: user.position || '',
  profile_photo: getProfilePhotoUrl(user.profile_photo),
});

const requestPasswordReset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const userRows = await db.query(
      'SELECT id, email, is_active FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );

    const user = userRows[0]?.[0];
    if (!user || Number(user.is_active) !== 1) {
      return res.status(200).json({
        success: true,
        message: 'If this account exists, a reset code has been generated.',
      });
    }

    const resetCode = generateResetCode();
    const tokenHash = hashResetCode(resetCode);

    await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    await db.query(
      'INSERT INTO password_resets (user_id, email, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [user.id, user.email, tokenHash]
    );

    return res.status(200).json({
      success: true,
      message: 'Reset code created successfully. Use it to set a new password.',
      reset_code: resetCode,
      expires_in_minutes: 15,
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    return res.status(500).json({ success: false, message: 'Could not generate reset code.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const resetCode = String(req.body.reset_code || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const [resetRows] = await db.query(
      'SELECT * FROM password_resets WHERE LOWER(email) = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    const resetEntry = resetRows[0];
    if (!resetEntry) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid or has already been used.' });
    }

    if (hashResetCode(resetCode) !== resetEntry.token_hash) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid.' });
    }

    const [expiryRows] = await db.query(
      'SELECT NOW() > expires_at AS expired FROM password_resets WHERE id = ?',
      [resetEntry.id]
    );

    if (expiryRows[0]?.expired) {
      await db.query('UPDATE password_resets SET used_at = ? WHERE id = ?', [new Date(), resetEntry.id]);
      return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
    }

    const [userRows] = await db.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await db.query('UPDATE password_resets SET used_at = ? WHERE id = ?', [new Date(), resetEntry.id]);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Could not reset password.' });
  }
};

const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      company_name,
      industry,
      company_size,
      full_name,
      work_email,
      password,
      role = 'admin',
      position = 'Administration'
    } = req.body;

    const email = String(work_email || '').trim().toLowerCase();

    if (!email || !password || !company_name) {
      return res.status(400).json({ success: false, message: 'Company name, email and password are required.' });
    }

    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ? AND company_id IS NOT NULL', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [companyResult] = await db.query(
      'INSERT INTO companies (company_name, industry, company_size, created_by_email) VALUES (?, ?, ?, ?)',
      [company_name, industry, company_size, email]
    );

    const companyId = companyResult.insertId;
    const normalizedFullName = String(full_name || '').trim() || 'Admin User';

    const [userResult] = await db.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [companyId, normalizedFullName, email, password_hash, role, position]
    );

    const [newUser] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [userResult.insertId]
    );

    const user = newUser[0];
    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: normalizeUserResponse({ ...user, company_name })
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

const setLockoutCookie = (res) => {
  res.cookie('worknest_locked', '1', {
    maxAge: LOCKOUT_MINUTES * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie('worknest_token');
  res.clearCookie('worknest_session');
};

const isUserLocked = (user) => {
  if (!user || !user.locked_until) {
    return false;
  }

  return new Date(user.locked_until).getTime() > Date.now();
};

const createLockoutMessage = () => {
  return `Too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`;
};

const getLoginLockState = (user) => {
  if (!user) {
    return { canLogin: false, attempted: 0, locked: false };
  }

  const failedAttempts = Number(user.failed_login_attempts || 0);
  const locked = isUserLocked(user);

  return {
    canLogin: !locked,
    attempted: failedAttempts,
    locked,
  };
};

const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const [rows] = await db.query(
      'SELECT u.*, c.company_name FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE LOWER(u.email) = ? AND u.is_active = 1 ORDER BY u.id DESC LIMIT 1',
      [normalizedEmail]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const lockState = getLoginLockState(user);

    if (!lockState.canLogin) {
      setLockoutCookie(res);
      return res.status(423).json({
        success: false,
        message: createLockoutMessage(),
        locked: true,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!isMatch) {
      const nextFailedAttempts = Number(user.failed_login_attempts || 0) + 1;
      const lockUntil = nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

      await db.query(
        'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [nextFailedAttempts, lockUntil ? lockUntil.toISOString().slice(0, 19).replace('T', ' ') : null, user.id]
      );

      if (nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        setLockoutCookie(res);
        return res.status(423).json({
          success: false,
          message: createLockoutMessage(),
          locked: true,
        });
      }

      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${MAX_FAILED_LOGIN_ATTEMPTS - nextFailedAttempts} attempts remaining.`,
      });
    }

    res.clearCookie('worknest_locked');
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [user.id]
    );

    const token = createToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: normalizeUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT u.*, c.company_name FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ? AND u.company_id = ?',
      [req.user.id, req.user.company_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];
    res.status(200).json({
      success: true,
      user: normalizeUserResponse(user)
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ? AND company_id = ?', [req.user.id, req.user.company_id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ? AND company_id = ?', [password_hash, req.user.id, req.user.company_id]);

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
};
