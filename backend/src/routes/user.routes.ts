import { Router } from 'express';
import { listUsers, createUser, updateUser } from '../controllers/user.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.js';
import { Role } from '@prisma/client';

const router = Router();

// Protect all routes with auth + admin checks
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

export default router;
