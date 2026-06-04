import { Role, Project } from '@prisma/client';
import { projectRepository } from '../repositories/project.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { authorizationService } from './authorization.service.js';
import { AuthorizationContext } from '../types/auth.js';
import { AppError } from '../types/api.js';

export interface CreateProjectDto {
  name: string;
  key: string;
  description?: string;
}

export class ProjectService {
  public async createProject(
    ctx: AuthorizationContext,
    dto: CreateProjectDto
  ): Promise<Project> {
    // Only Admin or PM can create projects
    if (ctx.role !== Role.ADMIN && ctx.role !== Role.PROJECT_MANAGER) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators and Project Managers can create projects', 403);
    }

    const uppercaseKey = dto.key.toUpperCase();

    // Check key format (must be alphanumeric and 2-10 chars)
    const keyRegex = /^[A-Z0-9]{2,10}$/;
    if (!keyRegex.test(uppercaseKey)) {
      throw new AppError('VALIDATION_ERROR', 'Project key must be alphanumeric and between 2 to 10 characters long', 400);
    }

    // Check duplicate key
    const existing = await projectRepository.findByKey(uppercaseKey);
    if (existing) {
      throw new AppError('DUPLICATE_RESOURCE', `Project with key ${uppercaseKey} already exists`, 409);
    }

    // Create project
    const project = await projectRepository.create({
      name: dto.name,
      key: uppercaseKey,
      description: dto.description,
    });

    // Auto add creator as project member
    await projectRepository.addMember(project.id, ctx.userId);

    return project;
  }

  public async addMember(
    ctx: AuthorizationContext,
    projectId: string,
    userId: string
  ): Promise<void> {
    // 1. Enforce PROJECT_MANAGE action (Admin only)
    await authorizationService.authorizeProjectAccess(ctx, projectId, 'PROJECT_MANAGE');

    // 2. Verify target user exists and is active
    const user = await userRepository.findById(userId);
    if (!user || !user.active) {
      throw new AppError('RESOURCE_NOT_FOUND', 'User not found or de-activated', 404);
    }

    // 3. Verify not already a member
    const existing = await projectRepository.findMember(projectId, userId);
    if (existing) {
      throw new AppError('DUPLICATE_RESOURCE', 'User is already a member of this project', 409);
    }

    await projectRepository.addMember(projectId, userId);
  }

  public async removeMember(
    ctx: AuthorizationContext,
    projectId: string,
    userId: string
  ): Promise<void> {
    // 1. Enforce PROJECT_MANAGE action (Admin only)
    await authorizationService.authorizeProjectAccess(ctx, projectId, 'PROJECT_MANAGE');

    // 2. Verify membership exists
    const existing = await projectRepository.findMember(projectId, userId);
    if (!existing) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Project membership not found', 404);
    }

    await projectRepository.removeMember(projectId, userId);
  }

  public async listProjects(
    ctx: AuthorizationContext,
    page: number,
    limit: number
  ): Promise<{ projects: Project[]; total: number }> {
    const skip = (page - 1) * limit;

    if (ctx.role === Role.ADMIN) {
      return projectRepository.listAll(skip, limit);
    }

    return projectRepository.listForUser(ctx.userId, skip, limit);
  }

  public async getProjectDetails(
    ctx: AuthorizationContext,
    projectId: string
  ): Promise<Project> {
    await authorizationService.authorizeProjectAccess(ctx, projectId, 'PROJECT_VIEW');
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Project not found', 404);
    }
    return project;
  }

  public async getProjectActivities(
    ctx: AuthorizationContext,
    projectId: string,
    limit: number = 20
  ): Promise<any[]> {
    await authorizationService.authorizeProjectAccess(ctx, projectId, 'PROJECT_VIEW');
    return prisma.activity.findMany({
      where: {
        task: {
          projectId,
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        task: {
          select: { id: true, taskKey: true, title: true },
        },
      },
    });
  }

  public async deleteProject(
    ctx: AuthorizationContext,
    projectId: string
  ): Promise<void> {
    if (ctx.role !== Role.ADMIN) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators can delete projects', 403);
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Project not found', 404);
    }

    await projectRepository.delete(projectId);
  }
}

import prisma from '../config/db.js';

export const projectService = new ProjectService();
