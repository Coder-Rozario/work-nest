const express = require('express');
const { authRole } = require('../middleware/auth');
const { getTimeAttendance, addTimeLog, updateTimeLog, deleteTimeLog } = require('../controllers/timeAttendanceController');

const router = express.Router();

router.get('/', authRole('admin', 'manager', 'employee'), getTimeAttendance);
router.post('/', authRole('admin', 'manager', 'employee'), addTimeLog);
router.put('/:id', authRole('admin', 'manager', 'employee'), updateTimeLog);
router.delete('/:id', authRole('admin', 'manager', 'employee'), deleteTimeLog);

module.exports = router;
