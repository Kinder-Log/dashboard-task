import { Router } from 'express';
import multer from 'multer';
import {
  createTask,
  listTasks,
  listStatuses,
  getTaskDetails,
  updateTask,
  changeStatus,
  deleteTask,
  logTime,
  uploadAttachment,
  addComment,
  deleteComment,
  addLink,
  deleteLink,
  listAllStatuses,
  updateStatus
} from '../controllers/task.controller.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  }
});

// Secure all task routes
router.use(authenticateJWT);

router.post('/', createTask); // Task creation (restricted inside service to ADMIN/PM)
router.get('/', listTasks);

// Status Config routes (must be registered before /:id)
router.get('/statuses/all', listAllStatuses);
router.put('/statuses/:key', updateStatus);

router.get('/statuses', listStatuses);
router.get('/:id', getTaskDetails);
router.patch('/:id/status', changeStatus); // Drop actions
router.patch('/:id', updateTask); // Partial updates
router.delete('/:id', deleteTask); // Soft delete task (restricted inside service to ADMIN/PM)

router.post('/:id/timelogs', logTime);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

// Comments
router.post('/:id/comments', addComment);
router.delete('/comments/:commentId', deleteComment);

// Links
router.post('/:id/links', addLink);
router.delete('/links/:linkId', deleteLink);

export default router;
