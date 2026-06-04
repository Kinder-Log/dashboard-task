import { Router } from 'express';
import { login, refresh, logout, changePassword } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/change-password', authenticateJWT, changePassword);

export default router;
