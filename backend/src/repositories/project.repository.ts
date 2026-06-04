import { Project, ProjectMember, Prisma } from '@prisma/client';
import prisma from '../config/db.js';

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByKey(key: string): Promise<Project | null>;
  create(data: Prisma.ProjectCreateInput): Promise<Project>;
  listForUser(userId: string, skip: number, take: number): Promise<{ projects: Project[]; total: number }>;
  listAll(skip: number, take: number): Promise<{ projects: Project[]; total: number }>;
  
  // Membership management
  addMember(projectId: string, userId: string): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;
}

export class ProjectRepository implements IProjectRepository {
  public async findById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        }
      }
    });
  }

  public async findByKey(key: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { key },
    });
  }

  public async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data });
      // Create associated counter
      await tx.projectCounter.create({
        data: {
          projectId: project.id,
          lastNumber: 0,
        }
      });
      return project;
    });
  }

  public async listForUser(
    userId: string,
    skip: number,
    take: number
  ): Promise<{ projects: Project[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      members: {
        some: { userId },
      },
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, total };
  }

  public async listAll(
    skip: number,
    take: number
  ): Promise<{ projects: Project[]; total: number }> {
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count(),
    ]);

    return { projects, total };
  }

  public async addMember(projectId: string, userId: string): Promise<ProjectMember> {
    return prisma.projectMember.create({
      data: {
        projectId,
        userId,
      },
    });
  }

  public async removeMember(projectId: string, userId: string): Promise<void> {
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  public async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    return prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }
}

export const projectRepository = new ProjectRepository();
