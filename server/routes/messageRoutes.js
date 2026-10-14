const express = require('express');
const { authRole } = require('../middleware/auth');
const { getConversations, getMessages, sendMessage } = require('../controllers/messageController');

const router = express.Router();

router.get('/conversations', authRole('admin', 'manager', 'employee'), getConversations);
router.get('/:userId', authRole('admin', 'manager', 'employee'), getMessages);
router.post('/send', authRole('admin', 'manager', 'employee'), sendMessage);

module.exports = router;
