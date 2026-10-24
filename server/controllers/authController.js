const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const { sendResetCodeEmail } = require('../utils/mailer');

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MAX_RESEND_ATTEMPTS = 10;
const RESET_CODE_TTL_MINUTES = 15;

const pad = (n) => String(n).padStart(2, '0');

const normalizeDateTime = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

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

const normalizeText = (value) => String(value || '').trim();

const identityMatches = (user, { name, position }) => {
  if (!user) return false;
  return (
    normalizeText(user.full_name).toLowerCase() === name.toLowerCase() &&
    normalizeText(user.position).toLowerCase() === position.toLowerCase()
  );
};

const findIdentityUser = async (email) => {
  const [rows] = await db.query(
    `SELECT u.*, c.company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE LOWER(u.email) = ? AND u.is_active = 1
     ORDER BY u.id DESC LIMIT 1`,
    [email]
  );

  return rows[0] || null;
};

const requestPasswordReset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const name = normalizeText(req.body.name);
    const position = normalizeText(req.body.position);
    const email = normalizeText(req.body.email).toLowerCase();

    const user = await findIdentityUser(email);

    if (!identityMatches(user, { name, position })) {
      return res.status(400).json({
        success: false,
        message: 'The name, email and position you entered do not match an active account.',
      });
    }

    const [existingRows] = await db.query(
      'SELECT id, resend_count, expires_at FROM password_resets WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1',
      [user.id]
    );

    const existing = existingRows[0];
    let resendCount = 0;

    // Only count a resend while the previous code is still valid.
    if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
      resendCount = Number(existing.resend_count || 0);
      if (resendCount >= MAX_RESEND_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          message: 'You have reached the maximum number of resend attempts. Please try again later.',
          resend_remaining: 0,
        });
      }
      resendCount += 1;
    }

    const resetCode = generateResetCode();
    const tokenHash = hashResetCode(resetCode);

    // Keep only the newest code valid for this account.
    await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    await db.query(
      'INSERT INTO password_resets (user_id, email, token_hash, resend_count, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [user.id, user.email, tokenHash, resendCount, RESET_CODE_TTL_MINUTES]
    );

    await sendResetCodeEmail({
      to: user.email,
      name: user.full_name,
      code: resetCode,
      expiresInMinutes: RESET_CODE_TTL_MINUTES,
    });

    return res.status(200).json({
      success: true,
      message: `A verification code has been sent to your registered email (${user.email}).`,
      resend_remaining: MAX_RESEND_ATTEMPTS - resendCount,
      expires_in_minutes: RESET_CODE_TTL_MINUTES,
    });
  } catch (error) {
    console.error('Request password reset error:', error);

    if (error.code === 'SMTP_NOT_CONFIGURED') {
      return res.status(500).json({
        success: false,
        message: 'The email service is not configured on the server. Please contact your administrator.',
      });
    }

    return res.status(500).json({ success: false, message: 'Could not send the verification code. Please try again.' });
  }
};

const verifyResetCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const name = normalizeText(req.body.name);
    const position = normalizeText(req.body.position);
    const email = normalizeText(req.body.email).toLowerCase();
    const code = normalizeText(req.body.code);

    const user = await findIdentityUser(email);

    if (!identityMatches(user, { name, position })) {
      return res.status(400).json({
        success: false,
        message: 'The name, email and position you entered do not match an active account.',
      });
    }

    const [resetRows] = await db.query(
      'SELECT * FROM password_resets WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1',
      [user.id]
    );

    const resetEntry = resetRows[0];
    if (!resetEntry) {
      return res.status(400).json({ success: false, message: 'No active verification code found. Please request a new code.' });
    }

    if (new Date(resetEntry.expires_at).getTime() <= Date.now()) {
      await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetEntry.id]);
      return res.status(400).json({ success: false, message: 'The verification code has expired. Please request a new code.' });
    }

    if (hashResetCode(code) !== resetEntry.token_hash) {
      return res.status(400).json({ success: false, message: 'The verification code is incorrect.' });
    }

    await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetEntry.id]);
    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    // Valid code grants direct account access; the password can be changed from the profile afterwards.
    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: 'Verification successful.',
      token,
      user: normalizeUserResponse(user),
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    return res.status(500).json({ success: false, message: 'Could not verify the code. Please try again.' });
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
        [nextFailedAttempts, lockUntil ? normalizeDateTime(lockUntil) : null, user.id]
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
  verifyResetCode,
};
