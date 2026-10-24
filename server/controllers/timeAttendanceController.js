const db = require('../config/database');

const pad = (n) => String(n).padStart(2, '0');


const getProfilePhotoUrl = (photo, companyId) => {
  if (!photo) return '';
  const str = String(photo).trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  if (str.startsWith('/')) return str;
  if (str.startsWith('uploads/')) return `/${str}`;
  if (str.startsWith('companies/')) return `/uploads/${str}`;
  // Bare filename -> prepend the company folder.
  return `/uploads/companies/${companyId}/${str}`;
};


const normalizeDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '0000-00-00 00:00:00' || trimmed === '0000-00-00') return null;

  // Already in MySQL local datetime format -> keep as-is.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
};

// Office hours are company-wide and are set by the admin. Fetch the admin's
// settings row so every role sees the exact office hours the admin configured.
const getOfficeHours = async (companyId) => {
  let officeStart = '09:00';
  let officeEnd = '17:00';
  const [settingsRows] = await db.query(
    `SELECT s.office_start, s.office_end
     FROM settings s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.company_id = ? AND u.role = 'admin'
     ORDER BY s.id ASC LIMIT 1`,
    [companyId]
  );
  if (settingsRows && settingsRows[0]) {
    if (settingsRows[0].office_start) officeStart = String(settingsRows[0].office_start).slice(0, 5);
    if (settingsRows[0].office_end) officeEnd = String(settingsRows[0].office_end).slice(0, 5);
  }
  return { office_start: officeStart, office_end: officeEnd };
};

const calculateDurationMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;

  return Math.round(diffMs / 60000);
};

const getTimeAttendance = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tl.*, u.id as user_id_ref, u.full_name, u.role, u.profile_photo
       FROM time_logs tl
       LEFT JOIN users u ON u.id = tl.user_id
       WHERE tl.company_id = ?
       ORDER BY tl.created_at DESC
       LIMIT 100`,
      [req.user.company_id]
    );

    const records = rows.map((r) => ({
      ...r,
      profile_photo: getProfilePhotoUrl(r.profile_photo, r.company_id),
    }));

    const officeHours = await getOfficeHours(req.user.company_id);

    res.status(200).json({
      success: true,
      data: { records, ...officeHours }
    });
  } catch (error) {
    console.error('Get time attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addTimeLog = async (req, res) => {
  try {
    const { user_id, task_id, check_in, check_out, note } = req.body;
    const userId = user_id || req.user.id;
    const companyId = req.user.company_id;
    const safeCheckIn = normalizeDateTime(check_in);
    const safeCheckOut = normalizeDateTime(check_out);

    // When clocking back in on the same day, continue the existing record
    // instead of creating a new one. Clear the previous check_out so the
    // session keeps running from the original check_in until the final
    // check-out of the day.
    if (safeCheckIn && !safeCheckOut) {
      const checkInDate = safeCheckIn.slice(0, 10); // YYYY-MM-DD
      const [existing] = await db.query(
        `SELECT id FROM time_logs
         WHERE user_id = ? AND company_id = ? AND DATE(check_in) = ?
         ORDER BY id ASC LIMIT 1`,
        [userId, companyId, checkInDate]
      );

      if (existing && existing[0]) {
        await db.query(
          `UPDATE time_logs
           SET check_out = NULL, duration_minutes = 0, note = ?
           WHERE id = ?`,
          [note || 'Clock in', existing[0].id]
        );
        return res.status(200).json({
          success: true,
          message: 'Time log continued.',
          data: { id: existing[0].id }
        });
      }
    }

    const durationMinutes = calculateDurationMinutes(safeCheckIn, safeCheckOut);

    const [result] = await db.query(
      `INSERT INTO time_logs (company_id, user_id, task_id, check_in, check_out, note, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, userId, task_id || null, safeCheckIn, safeCheckOut, note || '', durationMinutes]
    );

    res.status(201).json({ success: true, message: 'Time log added.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Add time log error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateTimeLog = async (req, res) => {
  try {
    const { check_in, check_out, note } = req.body;

    const [existingRows] = await db.query(
      `SELECT check_in, check_out, note, duration_minutes
       FROM time_logs
       WHERE id = ? AND company_id = ?`,
      [req.params.id, req.user.company_id]
    );

    const existing = existingRows[0] || {};
    const nextCheckIn = normalizeDateTime(check_in !== undefined ? check_in : existing.check_in);
    const nextCheckOut = normalizeDateTime(check_out !== undefined ? check_out : existing.check_out);
    const nextNote = note !== undefined ? String(note || '') : String(existing.note || '');
    const durationMinutes = calculateDurationMinutes(nextCheckIn, nextCheckOut) || Number(existing.duration_minutes || 0);

    await db.query(
      `UPDATE time_logs
       SET check_in = ?, check_out = ?, note = ?, duration_minutes = ?
       WHERE id = ? AND company_id = ?`,
      [nextCheckIn, nextCheckOut, nextNote, durationMinutes, req.params.id, req.user.company_id]
    );

    res.status(200).json({ success: true, message: 'Time log updated.' });
  } catch (error) {
    console.error('Update time log error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteTimeLog = async (req, res) => {
  try {
    await db.query('DELETE FROM time_logs WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    res.status(200).json({ success: true, message: 'Time log deleted.' });
  } catch (error) {
    console.error('Delete time log error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getTimeAttendance,
  addTimeLog,
  updateTimeLog,
  deleteTimeLog,
  getOfficeHours,
  getProfilePhotoUrl,
};
