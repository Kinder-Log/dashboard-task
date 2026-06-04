import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectService } from '../services/project.service.js';
import { AppError } from '../types/api.js';

const CreateProjectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters'),
  key: z.string().min(2, 'Project key must be at least 2 characters').max(10, 'Project key must be at most 10 characters'),
  description: z.string().optional(),
});

const AddMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs schema', 400, parsed.error.format());
    }

    const project = await projectService.createProject(req.user, parsed.data);

    res.status(211).json({
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { projects, total } = await projectService.listProjects(req.user, page, limit);

    res.json({
      data: projects,
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

export async function getProjectDetails(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const project = await projectService.getProjectDetails(req.user, id);

    res.json({
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = req.params;
    const parsed = AddMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid user ID format', 400, parsed.error.format());
    }

    await projectService.addMember(req.user, id, parsed.data.userId);

    res.json({
      data: { message: 'Member added successfully' },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id, userId } = req.params;
    await projectService.removeMember(req.user, id, userId);

    res.json({
      data: { message: 'Member removed successfully' },
    });
  } catch (error) {
    next(error);
  }
}
