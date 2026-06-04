import { TimeLog } from '@prisma/client';
import { authorizationService } from './authorization.service.js';
import { transactionService } from './transaction.service.js';
import { AuthorizationContext } from '../types/auth.js';
import { AppError } from '../types/api.js';
import prisma from '../config/db.js';

export class TimeTrackingService {
  public async logTime(
    ctx: AuthorizationContext,
    taskId: string,
    hours: number,
    description?: string
  ): Promise<TimeLog> {
    // 1. Enforce access to task (must be member of project)
    const task = await authorizationService.authorizeTaskAccess(ctx, taskId, 'TASK_READ');

    // 2. Validate hours parameter
    if (hours <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Logged hours must be a positive number greater than 0', 400);
    }

    // 3. Perform logs creation and aggregate updates inside transaction
    return transactionService.run(async (tx) => {
      // Create TimeLog
      const timeLog = await tx.timeLog.create({
        data: {
          taskId,
          userId: ctx.userId,
          hours,
          description: description || null,
        },
      });

      // Sum all logs hours for this task
      const totalAggregate = await tx.timeLog.aggregate({
        where: { taskId },
        _sum: {
          hours: true,
        },
      });

      const totalHours = totalAggregate._sum.hours || 0;

      // Update actualHours cached sum on Task record
      await tx.task.update({
        where: { id: taskId },
        data: {
          actualHours: totalHours,
        },
      });

      // Write user activity
      await tx.activity.create({
        data: {
          taskId,
          userId: ctx.userId,
          action: 'logged time',
          details: `${hours} hours logged. Total task actual hours: ${totalHours}`,
        },
      });

      // Write-Ahead Audit Log (inside the transaction)
      await tx.auditLog.create({
        data: {
          action: 'TIME_LOGGED',
          entityName: 'TimeLog',
          entityId: timeLog.id,
          userId: ctx.userId,
          details: {
            taskId,
            hours,
            totalHours,
            description,
          },
        },
      });

      // Emit domain event for worker processing
      await tx.domainEventLog.create({
        data: {
          type: 'TimeLogged',
          payload: { taskId, userId: ctx.userId, hours, totalHours },
          status: 'PENDING',
          idempotencyKey: `time-logged-${timeLog.id}`,
        },
      });

      return timeLog;
    });
  }

  public async calculateActualHours(taskId: string): Promise<number> {
    const totalAggregate = await prisma.timeLog.aggregate({
      where: { taskId },
      _sum: {
        hours: true,
      },
    });
    return totalAggregate._sum.hours || 0;
  }
}

export const timeTrackingService = new TimeTrackingService();
