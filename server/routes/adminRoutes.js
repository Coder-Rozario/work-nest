const express = require('express');
const { authRole } = require('../middleware/auth');
const { getAdminDashboard, getEmployees, addEmployee, updateEmployee, deleteEmployee, getTeams, getProjects, getReports, getAdminSettings, updateAdminSettings, getAdminTasks } = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard', authRole('admin'), getAdminDashboard);
router.get('/tasks', authRole('admin'), getAdminTasks);
router.get('/employees', authRole('admin'), getEmployees);
router.post('/employees', authRole('admin'), addEmployee);
router.put('/employees/:id', authRole('admin'), updateEmployee);
router.delete('/employees/:id', authRole('admin'), deleteEmployee);
router.get('/teams', authRole('admin'), getTeams);
router.get('/projects', authRole('admin'), getProjects);
router.get('/reports', authRole('admin'), getReports);
router.get('/settings', authRole('admin'), getAdminSettings);
router.put('/settings', authRole('admin'), updateAdminSettings);

module.exports = router;
