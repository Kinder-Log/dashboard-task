import { Task, Prisma, TaskPriority, TaskType, TaskStatus, Comment, TaskLink, LinkType } from '@prisma/client';
import prisma from '../config/db.js';
import { AppError } from '../types/api.js';

export interface TaskFilters {
  projectId?: string;
  assigneeId?: string;
  statusKey?: string;
  priority?: TaskPriority;
  type?: TaskType;
  search?: string;
  tag?: string;
}

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByKey(key: string): Promise<Task | null>;
  create(tx: Prisma.TransactionClient, data: Prisma.TaskUncheckedCreateInput): Promise<Task>;
  update(id: string, version: number, data: Prisma.TaskUncheckedUpdateInput): Promise<Task>;
  archive(id: string): Promise<void>;
  listActive(filters: TaskFilters, skip: number, take: number): Promise<{ tasks: Task[]; total: number }>;
  listStatuses(): Promise<TaskStatus[]>;
  listAllStatuses(): Promise<TaskStatus[]>;
  updateStatus(key: string, data: Prisma.TaskStatusUpdateInput): Promise<TaskStatus>;
  addComment(taskId: string, authorId: string, content: string): Promise<Comment>;
  deleteComment(commentId: string): Promise<void>;
  findComment(commentId: string): Promise<Comment | null>;
  addLink(taskId: string, url: string, title: string, type: LinkType): Promise<TaskLink>;
  deleteLink(linkId: string): Promise<void>;
  findLink(linkId: string): Promise<TaskLink | null>;
}

export class TaskRepository implements ITaskRepository {
  public async findById(id: string): Promise<Task | null> {
    return prisma.task.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, role: true } },
        project: true,
        tags: { include: { tag: true } },
        subtasks: {
          where: { deletedAt: null },
          include: { assignee: { select: { id: true, name: true, role: true } } }
        },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        timeLogs: {
          include: {
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        links: {
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          include: {
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
    });
  }

  public async findByKey(key: string): Promise<Task | null> {
    return prisma.task.findFirst({
      where: {
        taskKey: key,
        deletedAt: null,
      },
    });
  }

  public async create(tx: Prisma.TransactionClient, data: Prisma.TaskUncheckedCreateInput): Promise<Task> {
    return tx.task.create({
      data,
    });
  }

  public async update(id: string, version: number, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> {
    try {
      // Enforce optimistic locking by matching version & updating it
      const updated = await prisma.task.update({
        where: {
          id,
          version,
        },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });
      return updated;
    } catch (error: any) {
      // Prisma error for record not found or condition mismatch: P2025
      if (error.code === 'P2025') {
        throw new AppError(
          'CONFLICT',
          'Task has been modified by another user. Please reload and try again.',
          409
        );
      }
      throw error;
    }
  }

  public async archive(id: string): Promise<void> {
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async listActive(
    filters: TaskFilters,
    skip: number,
    take: number
  ): Promise<{ tasks: Task[]; total: number }> {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
    };

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }
    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters.statusKey) {
      where.statusKey = filters.statusKey;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.tag) {
      where.tags = {
        some: {
          tag: {
            name: { equals: filters.tag, mode: 'insensitive' },
          },
        },
      };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  public async listStatuses(): Promise<TaskStatus[]> {
    return prisma.taskStatus.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
    });
  }

  public async listAllStatuses(): Promise<TaskStatus[]> {
    return prisma.taskStatus.findMany({
      orderBy: { position: 'asc' },
    });
  }

  public async updateStatus(key: string, data: Prisma.TaskStatusUpdateInput): Promise<TaskStatus> {
    return prisma.taskStatus.update({
      where: { key },
      data,
    });
  }

  public async addComment(taskId: string, authorId: string, content: string): Promise<Comment> {
    return prisma.comment.create({
      data: {
        taskId,
        authorId,
        content,
      },
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    });
  }

  public async deleteComment(commentId: string): Promise<void> {
    await prisma.comment.delete({
      where: { id: commentId },
    });
  }

  public async findComment(commentId: string): Promise<Comment | null> {
    return prisma.comment.findUnique({
      where: { id: commentId },
    });
  }

  public async addLink(taskId: string, url: string, title: string, type: LinkType): Promise<TaskLink> {
    return prisma.taskLink.create({
      data: {
        taskId,
        url,
        title,
        type,
      },
    });
  }

  public async deleteLink(linkId: string): Promise<void> {
    await prisma.taskLink.delete({
      where: { id: linkId },
    });
  }

  public async findLink(linkId: string): Promise<TaskLink | null> {
    return prisma.taskLink.findUnique({
      where: { id: linkId },
    });
  }
}

export const taskRepository = new TaskRepository();
