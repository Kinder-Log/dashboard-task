import { Role, Task, Project } from '@prisma/client';
import { AuthorizationContext } from '../types/auth.js';
import { taskRepository } from '../repositories/task.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { AppError } from '../types/api.js';

export type PermissionAction =
  | 'TASK_READ'
  | 'TASK_UPDATE'
  | 'TASK_DELETE'
  | 'TASK_ASSIGN'
  | 'PROJECT_MANAGE'
  | 'PROJECT_VIEW';

export interface IAuthorizationService {
  authorizeTaskAccess(ctx: AuthorizationContext, taskId: string, action: PermissionAction): Promise<Task>;
  authorizeProjectAccess(ctx: AuthorizationContext, projectId: string, action: PermissionAction): Promise<Project>;
}

export class AuthorizationService implements IAuthorizationService {
  public async authorizeTaskAccess(
    ctx: AuthorizationContext,
    taskId: string,
    action: PermissionAction
  ): Promise<Task> {
    // 1. Fetch Task
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Task not found', 404);
    }

    // 2. Global bypass for Admin
    if (ctx.role === Role.ADMIN) {
      return task;
    }

    // 3. Project Membership check
    const isMember = await projectRepository.findMember(task.projectId, ctx.userId);
    if (!isMember) {
      throw new AppError('FORBIDDEN', 'Access denied: you are not a member of this project', 403);
    }

    // 4. Role restrictions for task mutations
    if (action === 'TASK_DELETE' && ctx.role !== Role.PROJECT_MANAGER) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators and Project Managers can delete tasks', 403);
    }

    if (action === 'TASK_ASSIGN' && ctx.role !== Role.PROJECT_MANAGER) {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators and Project Managers can assign tasks', 403);
    }

    return task;
  }

  public async authorizeProjectAccess(
    ctx: AuthorizationContext,
    projectId: string,
    action: PermissionAction
  ): Promise<Project> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AppError('RESOURCE_NOT_FOUND', 'Project not found', 404);
    }

    // Admin bypass
    if (ctx.role === Role.ADMIN) {
      return project;
    }

    // Admin-only operations (e.g. creating projects, project member modifications)
    if (action === 'PROJECT_MANAGE') {
      throw new AppError('FORBIDDEN', 'Access denied: only Administrators can manage projects', 403);
    }

    // Project view check
    const isMember = await projectRepository.findMember(projectId, ctx.userId);
    if (!isMember) {
      throw new AppError('FORBIDDEN', 'Access denied: you are not a member of this project', 403);
    }

    return project;
  }
}

export const authorizationService = new AuthorizationService();
