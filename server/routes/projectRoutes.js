const express = require('express');
const { authRole } = require('../middleware/auth');
const { getProjects, createProject, updateProject, deleteProject, getTeams, createTeam, updateTeam, deleteTeam } = require('../controllers/projectController');

const router = express.Router();

router.get('/', authRole('admin', 'manager', 'employee'), getProjects);
router.post('/', authRole('admin', 'manager'), createProject);
router.put('/:id', authRole('admin', 'manager'), updateProject);
router.delete('/:id', authRole('admin', 'manager'), deleteProject);

router.get('/teams', authRole('admin', 'manager', 'employee'), getTeams);
router.post('/teams', authRole('admin', 'manager'), createTeam);
router.put('/teams/:id', authRole('admin', 'manager'), updateTeam);
router.delete('/teams/:id', authRole('admin', 'manager'), deleteTeam);

module.exports = router;
