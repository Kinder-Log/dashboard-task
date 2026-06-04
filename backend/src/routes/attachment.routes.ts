import { Router } from 'express';
import { deleteAttachment } from '../controllers/attachment.controller.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateJWT);

router.delete('/:id', deleteAttachment);

export default router;
