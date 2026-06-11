import { Role, Task, TaskType, TaskPriority, TaskStatus, Comment, TaskLink, LinkType } from '@prisma/client';
import { taskRepository, TaskFilters } from '../repositories/task.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { authorizationService } from './authorization.service.js';
import { transactionService } from './transaction.service.js';
import { TaskRules } from './task-rules.js';
import { AuthorizationContext } from '../types/auth.js';
import { AppError } from '../types/api.js';

export interface CreateTaskDto {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedHours?: number;
  dueDate?: Date;
  parentTaskId?: string;
  source?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  estimatedHours?: number;
  dueDate?: Date | null;
  source?: string;
}

export class TaskService {
  public async createTask(
    ctx: AuthorizationContext,
    dto: CreateTaskDto
  ): Promise<Task> {
    // 1. Enforce creator permissions (Admin or PM only)
    if (ctx.role !== Role.ADMIN && ctx.role !== Role.PROJECT_MANAGER) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators and Project Managers can create tasks', 403);
    }

    // 2. Enforce Project access
    const project = await projectRepository.findById(dto.projectId);
    if (!project) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Project not found', 404);
    }

    const isMember = await projectRepository.findMember(dto.projectId, ctx.userId);
    if (!isMember && ctx.role !== Role.ADMIN) {
      throw new AppError('FORBIDDEN', 'Access denied: you are not a member of this project', 403);
    }

    // 3. Verify assignee (if provided)
    if (dto.assigneeId) {
      const assigneeUser = await userRepository.findById(dto.assigneeId);
      if (!assigneeUser || !assigneeUser.active) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Assignee user not found or de-activated', 404);
      }

      const isAssigneeProjectMember = await projectRepository.findMember(dto.projectId, dto.assigneeId);
      if (!isAssigneeProjectMember && assigneeUser.role !== Role.ADMIN) {
        throw new AppError('VALIDATION_ERROR', 'Assignee must be a member of this project', 400);
      }
    }

    // 4. Verify parent task (if provided)
    if (dto.parentTaskId) {
      const parentTask = await taskRepository.findById(dto.parentTaskId);
      if (!parentTask) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Parent task not found', 404);
      }
    }

    // 5. Execute creation within transactional boundary for atomic numbering
    return transactionService.run(async (tx) => {
      // Fetch and increment project-specific task counter atomically
      const counter = await tx.projectCounter.update({
        where: { projectId: dto.projectId },
        data: { lastNumber: { increment: 1 } },
      });

      const taskNumber = counter.lastNumber;
      const taskKey = `${project.key}-${taskNumber}`;

      const task = await tx.task.create({
        data: {
          taskNumber,
          taskKey,
          title: dto.title,
          description: dto.description || null,
          projectId: dto.projectId,
          assigneeId: dto.assigneeId || null,
          type: dto.type,
          priority: dto.priority,
          statusKey: 'TODO', // Default starting status
          estimatedHours: dto.estimatedHours || null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          parentTaskId: dto.parentTaskId || null,
          source: dto.source || null,
        },
      });

      // Write activity
      await tx.activity.create({
        data: {
          taskId: task.id,
          userId: ctx.userId,
          action: 'created task',
          details: `Task key: ${taskKey}`,
        },
      });

      // Log event
      await tx.domainEventLog.create({
        data: {
          type: 'TaskCreated',
          payload: { taskId: task.id, title: task.title, assigneeId: task.assigneeId },
          status: 'PENDING',
          idempotencyKey: `task-created-${task.id}`,
        },
      });

      return task;
    });
  }

  public async updateTask(
    ctx: AuthorizationContext,
    id: string,
    dto: UpdateTaskDto,
    version: number
  ): Promise<Task> {
    // 1. Authorize access & operations permissions
    const task = await authorizationService.authorizeTaskAccess(ctx, id, 'TASK_UPDATE');

    // 2. Role restriction on properties: Developer can only update own assigned tasks or self-assign unassigned tasks
    if (ctx.role === Role.DEVELOPER) {
      const isSelfAssigningUnassigned = task.assigneeId === null && dto.assigneeId === ctx.userId;
      const isOwnTask = task.assigneeId === ctx.userId;

      if (!isOwnTask && !isSelfAssigningUnassigned) {
        throw new AppError('FORBIDDEN', 'Access denied: developers can only update tasks assigned to them or self-assign unassigned tasks', 403);
      }

      // Prevent developers from assigning to others: assigneeId must be ctx.userId, null (unassign), or undefined (no change)
      if (dto.assigneeId !== undefined && dto.assigneeId !== ctx.userId && dto.assigneeId !== null) {
        throw new AppError('FORBIDDEN', 'Access denied: developers cannot assign tasks to others', 403);
      }
      
      // Developers cannot change estimation, due date, or project details
      if (dto.estimatedHours !== undefined || dto.dueDate !== undefined) {
        throw new AppError('FORBIDDEN', 'Access denied: developers cannot modify estimations or due dates', 403);
      }
    }

    // 3. Verify assignee if changing
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      const assigneeUser = await userRepository.findById(dto.assigneeId);
      if (!assigneeUser || !assigneeUser.active) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Assignee user not found or de-activated', 404);
      }
      const isAssigneeProjectMember = await projectRepository.findMember(task.projectId, dto.assigneeId);
      if (!isAssigneeProjectMember && assigneeUser.role !== Role.ADMIN) {
        throw new AppError('VALIDATION_ERROR', 'Assignee must be a member of this project', 400);
      }
    }

    // 4. Update task
    const updated = await taskRepository.update(id, version, {
      title: dto.title,
      description: dto.description,
      assigneeId: dto.assigneeId,
      type: dto.type,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      dueDate: dto.dueDate === null ? null : (dto.dueDate ? new Date(dto.dueDate) : undefined),
      source: dto.source,
    });

    // Write activity & domain log
    await prisma.activity.create({
      data: {
        taskId: id,
        userId: ctx.userId,
        action: 'updated task properties',
      },
    });

    return updated;
  }

  public async changeStatus(
    ctx: AuthorizationContext,
    id: string,
    toStatusKey: string,
    version: number
  ): Promise<Task> {
    // 1. Fetch and authorize task access (must be assigned project member)
    const task = await authorizationService.authorizeTaskAccess(ctx, id, 'TASK_READ');

    // 2. Developers can only update status of their OWN assigned tasks
    if (ctx.role === Role.DEVELOPER && task.assigneeId !== ctx.userId) {
      throw new AppError('FORBIDDEN', 'Access denied: developers can only update the status of their assigned tasks', 403);
    }

    // 3. Validate workflow transitions rules
    const isValidTransition = await TaskRules.canChangeStatus(task.statusKey, toStatusKey, ctx.role);
    if (!isValidTransition) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `Status transition from ${task.statusKey} to ${toStatusKey} is not allowed for role ${ctx.role}`,
        400
      );
    }

    // 4. Update task status inside transaction
    return transactionService.run(async (tx) => {
      try {
        const updated = await tx.task.update({
          where: { id, version },
          data: {
            statusKey: toStatusKey,
            version: { increment: 1 },
          },
        });

        // Log activity
        await tx.activity.create({
          data: {
            taskId: id,
            userId: ctx.userId,
            action: 'changed status',
            details: `From ${task.statusKey} to ${toStatusKey}`,
          },
        });

        // Queue domain event log for notification workers
        await tx.domainEventLog.create({
          data: {
            type: 'TaskStatusChanged',
            payload: { taskId: id, from: task.statusKey, to: toStatusKey, userId: ctx.userId },
            status: 'PENDING',
            idempotencyKey: `task-status-change-${id}-${version}`,
          },
        });

        return updated;
      } catch (error: any) {
        if (error.code === 'P2025') {
          throw new AppError(
            'CONFLICT',
            'Task has been modified by another user. Please reload and try again.',
            409
          );
        }
        throw error;
      }
    });
  }

  public async deleteTask(
    ctx: AuthorizationContext,
    id: string
  ): Promise<void> {
    // Authorize delete (Admin/PM only)
    await authorizationService.authorizeTaskAccess(ctx, id, 'TASK_DELETE');

    // Perform soft delete
    await taskRepository.archive(id);

    // Create activity
    await prisma.activity.create({
      data: {
        taskId: id,
        userId: ctx.userId,
        action: 'archived task',
      },
    });
  }

  public async listTasks(
    ctx: AuthorizationContext,
    filters: TaskFilters,
    page: number,
    limit: number
  ): Promise<{ tasks: Task[]; total: number }> {
    const skip = (page - 1) * limit;

    // Enforce project membership check if project filter is passed
    if (filters.projectId) {
      await authorizationService.authorizeProjectAccess(ctx, filters.projectId, 'PROJECT_VIEW');
    } else {
      // If no project filter, non-admins can only see tasks of projects they are members of
      if (ctx.role !== Role.ADMIN) {
        throw new AppError('VALIDATION_ERROR', 'Non-administrator users must specify a projectId to list tasks', 400);
      }
    }

    return taskRepository.listActive(filters, skip, limit);
  }

  public async getTaskDetails(
    ctx: AuthorizationContext,
    id: string
  ): Promise<Task> {
    const task = await authorizationService.authorizeTaskAccess(ctx, id, 'TASK_READ');
    return task;
  }

  public async listStatuses(): Promise<TaskStatus[]> {
    return taskRepository.listStatuses();
  }

  public async listAllStatuses(ctx: AuthorizationContext): Promise<TaskStatus[]> {
    if (ctx.role !== Role.ADMIN) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators can list all statuses', 403);
    }
    return taskRepository.listAllStatuses();
  }

  public async updateStatus(
    ctx: AuthorizationContext,
    key: string,
    dto: { name?: string; color?: string; position?: number; active?: boolean }
  ): Promise<TaskStatus> {
    if (ctx.role !== Role.ADMIN) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators can configure task statuses', 403);
    }

    const status = await prisma.taskStatus.findUnique({ where: { key } });
    if (!status) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Status not found', 404);
    }

    if (status.protected && dto.active === false) {
      throw new AppError('VALIDATION_ERROR', 'Protected core workflow statuses cannot be de-activated', 400);
    }

    return taskRepository.updateStatus(key, dto);
  }

  public async addComment(
    ctx: AuthorizationContext,
    taskId: string,
    content: string
  ): Promise<Comment> {
    // 1. Verify task access
    await authorizationService.authorizeTaskAccess(ctx, taskId, 'TASK_READ');

    // 2. Add comment
    const comment = await taskRepository.addComment(taskId, ctx.userId, content);

    // 3. Log activity
    await prisma.activity.create({
      data: {
        taskId,
        userId: ctx.userId,
        action: 'added comment',
        details: content.substring(0, 100),
      }
    });

    return comment;
  }

  public async deleteComment(
    ctx: AuthorizationContext,
    commentId: string
  ): Promise<void> {
    const comment = await taskRepository.findComment(commentId);
    if (!comment) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Comment not found', 404);
    }

    // 1. Verify task access
    await authorizationService.authorizeTaskAccess(ctx, comment.taskId, 'TASK_READ');

    // 2. Enforce only author, Admin, or PM can delete a comment
    const isAuthor = comment.authorId === ctx.userId;
    const isPrivileged = ctx.role === Role.ADMIN || ctx.role === Role.PROJECT_MANAGER;

    if (!isAuthor && !isPrivileged) {
      throw new AppError('FORBIDDEN', 'Access denied: you can only delete your own comments', 403);
    }

    await taskRepository.deleteComment(commentId);
  }

  public async addLink(
    ctx: AuthorizationContext,
    taskId: string,
    url: string,
    title: string,
    type: LinkType
  ): Promise<TaskLink> {
    // 1. Verify task write access
    await authorizationService.authorizeTaskAccess(ctx, taskId, 'TASK_UPDATE');

    const link = await taskRepository.addLink(taskId, url, title, type);

    // 2. Log activity
    await prisma.activity.create({
      data: {
        taskId,
        userId: ctx.userId,
        action: 'added link',
        details: `${title} (${url})`,
      }
    });

    return link;
  }

  public async deleteLink(
    ctx: AuthorizationContext,
    linkId: string
  ): Promise<void> {
    const link = await taskRepository.findLink(linkId);
    if (!link) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Task link not found', 404);
    }

    // 1. Verify task write access
    await authorizationService.authorizeTaskAccess(ctx, link.taskId, 'TASK_UPDATE');

    await taskRepository.deleteLink(linkId);
  }
}

// Global DB instance wrapper for activities
import prisma from '../config/db.js';

export const taskService = new TaskService();
