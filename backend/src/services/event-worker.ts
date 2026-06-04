import { DomainEventLog } from '@prisma/client';
import prisma from '../config/db.js';
import { logger } from '../utils/logger.js';

export class EventWorkerService {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  public start(intervalMs: number = 5000): void {
    if (this.intervalId) return;
    logger.info(`Starting Event Outbox Worker polling every ${intervalMs}ms...`);
    this.intervalId = setInterval(() => this.processPendingEvents(), intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Stopped Event Outbox Worker.');
    }
  }

  public async processPendingEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Fetch pending outbox records
      const events = await prisma.domainEventLog.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      if (events.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.info(`Processing ${events.length} domain events from outbox...`);

      for (const event of events) {
        await this.processEventWithRetry(event);
      }
    } catch (error: any) {
      logger.error(new Error(`Failed outbox worker cycle: ${error.message}`));
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEventWithRetry(event: DomainEventLog): Promise<void> {
    try {
      // 1. Orchestrate event execution side-effects
      await this.handleEvent(event.type, event.payload);

      // 2. Mark processed on success
      await prisma.domainEventLog.update({
        where: { id: event.id },
        data: { status: 'PROCESSED' },
      });
    } catch (err: any) {
      const nextRetryCount = event.retryCount + 1;
      const status = nextRetryCount >= 3 ? 'FAILED' : 'PENDING'; // DLQ threshold is 3

      logger.warn(`Event ${event.id} of type ${event.type} failed (retry ${nextRetryCount}/3): ${err.message}`);

      await prisma.domainEventLog.update({
        where: { id: event.id },
        data: {
          retryCount: nextRetryCount,
          status,
        },
      });
    }
  }

  private async handleEvent(type: string, payload: any): Promise<void> {
    switch (type) {
      case 'TaskCreated': {
        const { taskId, title, assigneeId } = payload;
        if (assigneeId) {
          const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
          const taskKey = task?.taskKey || 'Task';
          
          await prisma.notification.create({
            data: {
              userId: assigneeId,
              title: 'New Task Assigned',
              content: `You have been assigned to task ${taskKey}: "${title}" in project "${task?.project?.name || ''}".`,
            },
          });
        }
        break;
      }

      case 'TaskStatusChanged': {
        const { taskId, from, to, userId } = payload;
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: {
            watchers: true,
            project: true,
          },
        });

        if (!task) return;

        // Notify assignee (if not the one who changed status)
        if (task.assigneeId && task.assigneeId !== userId) {
          await prisma.notification.create({
            data: {
              userId: task.assigneeId,
              title: 'Task Status Updated',
              content: `Task ${task.taskKey} was moved from ${from} to ${to}.`,
            },
          });
        }

        // Notify all other watchers
        for (const watcher of task.watchers) {
          if (watcher.userId !== userId && watcher.userId !== task.assigneeId) {
            await prisma.notification.create({
              data: {
                userId: watcher.userId,
                title: 'Task Status Updated',
                content: `Watched task ${task.taskKey} was moved from ${from} to ${to}.`,
              },
            });
          }
        }
        break;
      }

      case 'TimeLogged': {
        const { taskId, userId, hours, totalHours } = payload;
        // Optional alert logic for PM or watcher. For now: log and proceed
        break;
      }

      default:
        logger.warn(`Unhandled event type in outbox worker: ${type}`);
        break;
    }
  }
}

export const eventWorkerService = new EventWorkerService();
