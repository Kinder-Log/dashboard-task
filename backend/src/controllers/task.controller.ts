import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TaskType, TaskPriority, LinkType } from '@prisma/client';
import { taskService } from '../services/task.service.js';
import { timeTrackingService } from '../services/time-tracking.service.js';
import { attachmentService } from '../services/attachment.service.js';
import { AppError } from '../types/api.js';

const CreateTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  projectId: z.string().uuid('Invalid project ID format'),
  assigneeId: z.string().uuid('Invalid user ID format').optional(),
  type: z.nativeEnum(TaskType),
  priority: z.nativeEnum(TaskPriority),
  estimatedHours: z.number().nonnegative('Hours must be non-negative').optional(),
  dueDate: z.string().datetime({ precision: 3 }).optional().or(z.string().date().optional()), // Allow ISO date or standard format
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
  source: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  estimatedHours: z.number().nonnegative().optional(),
  dueDate: z.string().datetime().optional().or(z.string().date().optional()).nullable(),
  source: z.string().optional(),
  version: z.number({ required_error: 'Task version is required for optimistic locking concurrency control' }),
});

const ChangeStatusSchema = z.object({
  statusKey: z.string().min(1, 'Status key is required'),
  version: z.number({ required_error: 'Task version is required for optimistic locking concurrency control' }),
});

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const data = parsed.data;
    const task = await taskService.createTask(req.user, {
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      assigneeId: data.assigneeId,
      type: data.type,
      priority: data.priority,
      estimatedHours: data.estimatedHours,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      parentTaskId: data.parentTaskId,
      source: data.source,
    });

    res.status(211).json({
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const projectId = req.query.projectId as string | undefined;
    const assigneeId = req.query.assigneeId as string | undefined;
    const statusKey = req.query.statusKey as string | undefined;
    const priority = req.query.priority as TaskPriority | undefined;
    const type = req.query.type as TaskType | undefined;
    const search = req.query.search as string | undefined;
    const tag = req.query.tag as string | undefined;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { tasks, total } = await taskService.listTasks(
      req.user,
      { projectId, assigneeId, statusKey, priority, type, search, tag },
      page,
      limit
    );

    res.json({
      data: tasks,
      meta: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaskDetails(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const task = await taskService.getTaskDetails(req.user, id);

    res.json({
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const { version, ...updateFields } = parsed.data;
    const task = await taskService.updateTask(
      req.user,
      id,
      {
        ...updateFields,
        dueDate: updateFields.dueDate === null ? null : (updateFields.dueDate ? new Date(updateFields.dueDate) : undefined),
        assigneeId: updateFields.assigneeId,
      },
      version
    );

    res.json({
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = ChangeStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const { statusKey, version } = parsed.data;
    const task = await taskService.changeStatus(req.user, id, statusKey, version);

    res.json({
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    await taskService.deleteTask(req.user, id);

    res.json({
      data: { message: 'Task archived successfully' },
    });
  } catch (error) {
    next(error);
  }
}

const LogTimeSchema = z.object({
  hours: z.number().positive('Logged hours must be a positive number greater than 0'),
  description: z.string().optional(),
});

export async function logTime(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = LogTimeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const { hours, description } = parsed.data;
    const timeLog = await timeTrackingService.logTime(req.user, id, hours, description);

    res.json({
      data: timeLog,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const file = req.file;

    if (!file) {
      throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400);
    }

    const attachment = await attachmentService.uploadAttachment(req.user, id, file);

    res.json({
      data: attachment,
    });
  } catch (error) {
    next(error);
  }
}

export async function listStatuses(req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = await taskService.listStatuses();
    res.json({
      data: statuses,
    });
  } catch (error) {
    next(error);
  }
}

const AddCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty'),
});

const AddLinkSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().min(1, 'Link title is required'),
  type: z.nativeEnum(LinkType),
});

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = AddCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const comment = await taskService.addComment(req.user, id, parsed.data.content);

    res.json({
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { commentId } = req.params;
    await taskService.deleteComment(req.user, commentId);

    res.json({
      data: { message: 'Comment deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}

export async function addLink(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = AddLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const { url, title, type } = parsed.data;
    const link = await taskService.addLink(req.user, id, url, title, type);

    res.json({
      data: link,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLink(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { linkId } = req.params;
    await taskService.deleteLink(req.user, linkId);

    res.json({
      data: { message: 'Link deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}

const UpdateStatusSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  position: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

export async function listAllStatuses(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const statuses = await taskService.listAllStatuses(req.user);
    res.json({
      data: statuses,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const { key } = req.params;
    const parsed = UpdateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }
    const updated = await taskService.updateStatus(req.user, key, parsed.data);
    res.json({
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}


