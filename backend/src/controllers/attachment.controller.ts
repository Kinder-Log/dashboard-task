import { Request, Response, NextFunction } from 'express';
import { attachmentService } from '../services/attachment.service.js';
import { AppError } from '../types/api.js';

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    await attachmentService.deleteAttachment(req.user, id);

    res.json({
      data: { message: 'Attachment deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}
