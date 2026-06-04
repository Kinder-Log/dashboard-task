import { Router } from 'express';
import { createTask, listTasks, getTaskDetails, updateTask, changeStatus, deleteTask } from '../controllers/task.controller.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

// Secure all task routes
router.use(authenticateJWT);

router.post('/', createTask); // Task creation (restricted inside service to ADMIN/PM)
router.get('/', listTasks);
router.get('/:id', getTaskDetails);
router.patch('/:id/status', changeStatus); // Drop actions
router.patch('/:id', updateTask); // Partial updates
router.delete('/:id', deleteTask); // Soft delete task (restricted inside service to ADMIN/PM)

export default router;
