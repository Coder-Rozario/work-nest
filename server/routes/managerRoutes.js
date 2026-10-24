const express = require('express');
const { authRole } = require('../middleware/auth');
const { getManagerDashboard, getManagerTeam, getManagerTeamMembers, getManagerTasks, createTask, updateTask, deleteTask, updateTaskStatus, getManagerReports, getManagerTimeLog } = require('../controllers/managerController');

const router = express.Router();

router.get('/dashboard', authRole('manager'), getManagerDashboard);
router.get('/team', authRole('manager'), getManagerTeam);
router.get('/team-members', authRole('manager'), getManagerTeamMembers);
router.get('/tasks', authRole('manager'), getManagerTasks);
router.post('/tasks', authRole('manager'), createTask);
router.put('/tasks/:id', authRole('manager'), updateTask);
router.delete('/tasks/:id', authRole('manager'), deleteTask);
router.put('/tasks/:id/status', authRole('manager'), updateTaskStatus);
router.get('/reports', authRole('manager'), getManagerReports);
router.get('/time-log', authRole('manager'), getManagerTimeLog);

module.exports = router;
