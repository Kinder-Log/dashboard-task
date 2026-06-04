import { Router } from 'express';
import { createProject, listProjects, getProjectDetails, addMember, removeMember, getProjectActivities, deleteProject } from '../controllers/project.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.js';
import { Role } from '@prisma/client';

const router = Router();

// Secure all routes
router.use(authenticateJWT);

router.post('/', createProject); // Creating projects (restricted inside service to ADMIN/PM)
router.get('/', listProjects);
router.get('/:id', getProjectDetails);
router.get('/:id/activities', getProjectActivities);
router.delete('/:id', requireRole([Role.ADMIN]), deleteProject);

// Membership management (restricted inside service to ADMIN)
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

export default router;
