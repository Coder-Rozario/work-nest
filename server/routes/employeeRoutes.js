const express = require('express');
const { authRole } = require('../middleware/auth');
const {
  getEmployeeDashboard,
  getEmployeeTasks,
  updateTaskProgress,
  submitTask,
  getEmployeeProjects,
  getEmployeeTeamMembers,
  getTimeLog,
  getProfile,
  updateProfile
} = require('../controllers/employeeController');
const { uploadFiles } = require('../utils/upload');

const router = express.Router();

router.get('/dashboard', authRole('employee', 'manager', 'admin'), getEmployeeDashboard);
router.get('/tasks', authRole('employee', 'manager', 'admin'), getEmployeeTasks);
router.put('/tasks/:id/progress', authRole('employee', 'manager'), updateTaskProgress);
router.put('/tasks/:id/submit', authRole('employee'), uploadFiles.array('files', 2), submitTask);
router.get('/projects', authRole('employee', 'manager', 'admin'), getEmployeeProjects);
router.get('/team-members', authRole('employee', 'manager', 'admin'), getEmployeeTeamMembers);
router.get('/time-log', authRole('employee', 'manager', 'admin'), getTimeLog);
router.get('/profile', authRole('employee', 'manager', 'admin'), getProfile);
router.put('/profile', authRole('employee', 'manager', 'admin'), updateProfile);

module.exports = router;
