const db = require('../config/database');

const normalizeMessageText = (row) => {
  const value = row?.encrypted_text ?? row?.content ?? '';
  return typeof value === 'string' ? value : String(value || '');
};

const getTeamIdsForUser = async (companyId, userId, teamId) => {
  const [teamRows] = await db.query(
    `SELECT id FROM teams WHERE company_id = ? AND leader_id = ?`,
    [companyId, userId]
  );

  const userTeamId = Number(teamId || 0);
  const ids = [
    ...new Set([
      ...((teamRows || []).map((team) => Number(team.id)).filter((id) => Number.isFinite(id) && id > 0)),
      ...(userTeamId > 0 ? [userTeamId] : [])
    ])
  ];

  return ids;
};

const getAllowedRecipients = async (user) => {
  const companyId = Number(user.company_id);
  const currentUserId = Number(user.id);

  const [rows] = await db.query(
    `SELECT u.id,
            u.full_name,
            u.email,
            u.role,
            u.team_id,
            t.name AS team_name
     FROM users u
     LEFT JOIN teams t ON t.id = u.team_id
     WHERE u.company_id = ?
       AND u.id != ?
     ORDER BY t.name ASC, u.role ASC, u.full_name ASC, u.email ASC`,
    [companyId, currentUserId]
  );

  return rows;
};

const assertAllowedRecipient = async (currentUser, recipientId) => {
  const allowed = await getAllowedRecipients(currentUser);
  const match = (allowed || []).some((user) => Number(user.id) === Number(recipientId));

  if (!match) {
    throw new Error('You are not allowed to message this user.');
  }
};

const getProfilePhotoUrl = (photo) => {
  if (!photo) return '';
  if (String(photo).startsWith('http://') || String(photo).startsWith('https://')) return photo;
  if (String(photo).startsWith('/')) return photo;
  return `/uploads/companies/${photo}`;
};

const getConversations = async (req, res) => {
  try {
    const currentUserId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const allowedUsers = await getAllowedRecipients(req.user);

    if (!allowedUsers.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const contactIds = allowedUsers.map((user) => Number(user.id));
    const [rows] = await db.query(
      `SELECT u.id,
              u.full_name,
              u.email,
              u.role,
              u.profile_photo,
              t.name AS team_name,
              (
                SELECT m.encrypted_text
                FROM messages m
                WHERE ((m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id))
                  AND m.company_id = ?
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message,
              (
                SELECT m.created_at
                FROM messages m
                WHERE ((m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id))
                  AND m.company_id = ?
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_at
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.id IN (?)
       ORDER BY last_message_at DESC, u.full_name ASC`,
      [currentUserId, currentUserId, companyId, currentUserId, currentUserId, companyId, contactIds]
    );

    const conversations = (rows || []).map((row) => {
      const profilePhoto = getProfilePhotoUrl(row.profile_photo);
      return {
        id: row.id,
        full_name: row.full_name || row.email || 'Unknown User',
        email: row.email || '',
        role: String(row.role || 'employee').trim().toLowerCase(),
        team_name: row.team_name || 'Unassigned Team',
        team: row.team_name || 'Unassigned Team',
        profile_photo: profilePhoto,
        profilePhoto: profilePhoto,
        content: normalizeMessageText({ encrypted_text: row.last_message }),
        encrypted_text: normalizeMessageText({ encrypted_text: row.last_message }),
        created_at: row.last_message_at,
      };
    });

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMessages = async (req, res) => {
  try {
    const currentUserId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const otherUserId = Number(req.params.userId);
    await assertAllowedRecipient(req.user, otherUserId);

    const [rows] = await db.query(
      `SELECT id, company_id, sender_id, receiver_id, content, encrypted_text, nonce, key_version, created_at
       FROM messages
       WHERE company_id = ?
         AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
       ORDER BY created_at ASC`,
      [companyId, currentUserId, otherUserId, otherUserId, currentUserId]
    );

    const messages = (rows || []).map((row) => ({
      ...row,
      display_text: normalizeMessageText(row),
    }));

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    if (String(error.message).includes('not allowed')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { receiver_id, content, encrypted_text, nonce, key_version } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'Receiver is required.' });
    }

    const senderId = Number(req.user.id);
    const companyId = Number(req.user.company_id);
    const receiverId = Number(receiver_id);

    await assertAllowedRecipient(req.user, receiverId);

    const encryptedBody = String(encrypted_text || content || '').trim();

    const [result] = await db.query(
      `INSERT INTO messages (company_id, sender_id, receiver_id, content, encrypted_text, nonce, key_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [companyId, senderId, receiverId, encryptedBody, encryptedBody, nonce || '', key_version || 'v1']
    );

    res.status(201).json({ success: true, message: 'Message sent.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Send message error:', error);
    if (String(error.message).includes('not allowed')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
};
