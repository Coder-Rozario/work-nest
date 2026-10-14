const express = require('express');
const { authRole } = require('../middleware/auth');
const { getMeetings, createMeeting, updateMeeting, deleteMeeting, getMeetingAttendeeOptions } = require('../controllers/meetingController');

const router = express.Router();

router.get('/options', authRole('admin', 'manager', 'employee'), getMeetingAttendeeOptions);
router.get('/', authRole('admin', 'manager', 'employee'), getMeetings);
router.post('/', authRole('admin', 'manager', 'employee'), createMeeting);
router.put('/:id', authRole('admin', 'manager', 'employee'), updateMeeting);
router.delete('/:id', authRole('admin', 'manager', 'employee'), deleteMeeting);

module.exports = router;
