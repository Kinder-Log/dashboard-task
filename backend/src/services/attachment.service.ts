import { Attachment, Role } from '@prisma/client';
import { storageProvider } from './storage.service.js';
import { authorizationService } from './authorization.service.js';
import { transactionService } from './transaction.service.js';
import { AuthorizationContext } from '../types/auth.js';
import { AppError } from '../types/api.js';
import prisma from '../config/db.js';

export class AttachmentService {
  public async uploadAttachment(
    ctx: AuthorizationContext,
    taskId: string,
    file: Express.Multer.File
  ): Promise<Attachment> {
    // 1. Validate user has task read access (belonging to project)
    await authorizationService.authorizeTaskAccess(ctx, taskId, 'TASK_READ');

    // 2. Upload file through Storage Provider to get path
    const filepath = await storageProvider.uploadFile(file);

    // 3. Save DB record inside transaction
    return transactionService.run(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          taskId,
          uploaderId: ctx.userId,
          filename: file.originalname,
          filepath,
          mimetype: file.mimetype,
          size: file.size,
        },
      });

      // Log activity
      await tx.activity.create({
        data: {
          taskId,
          userId: ctx.userId,
          action: 'uploaded file',
          details: `Filename: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`,
        },
      });

      // Write-ahead audit log
      await tx.auditLog.create({
        data: {
          action: 'ATTACHMENT_UPLOADED',
          entityName: 'Attachment',
          entityId: attachment.id,
          userId: ctx.userId,
          details: {
            taskId,
            filename: file.originalname,
            size: file.size,
          },
        },
      });

      return attachment;
    });
  }

  public async deleteAttachment(
    ctx: AuthorizationContext,
    attachmentId: string
  ): Promise<void> {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Attachment not found', 404);
    }

    // 1. Authorize file deletion
    // Non-admins and non-PMs can only delete attachments they uploaded themselves
    if (ctx.role === Role.DEVELOPER && attachment.uploaderId !== ctx.userId) {
      throw new AppError('FORBIDDEN', 'Access denied: developers can only delete their own uploaded files', 403);
    }

    // 2. Run delete operations inside transaction
    await transactionService.run(async (tx) => {
      await tx.attachment.delete({
        where: { id: attachmentId },
      });

      // Remove from physical disk
      await storageProvider.deleteFile(attachment.filepath);

      // Write activity
      await tx.activity.create({
        data: {
          taskId: attachment.taskId,
          userId: ctx.userId,
          action: 'deleted file',
          details: `Filename: ${attachment.filename}`,
        },
      });

      // Write audit
      await tx.auditLog.create({
        data: {
          action: 'ATTACHMENT_DELETED',
          entityName: 'Attachment',
          entityId: attachmentId,
          userId: ctx.userId,
          details: {
            taskId: attachment.taskId,
            filename: attachment.filename,
          },
        },
      });
    });
  }
}

export const attachmentService = new AttachmentService();
