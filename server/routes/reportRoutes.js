const express = require('express');
const { authRole } = require('../middleware/auth');
const { getReports, getTaskSummary } = require('../controllers/reportController');

const router = express.Router();

router.get('/', authRole('admin', 'manager', 'employee'), getReports);
router.get('/summary', authRole('admin', 'manager', 'employee'), getTaskSummary);

module.exports = router;
