import { User, Prisma } from '@prisma/client';
import prisma from '../config/db.js';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
  list(skip: number, take: number, active?: boolean): Promise<{ users: User[]; total: number }>;
}

export class UserRepository implements IUserRepository {
  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  public async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  public async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  public async list(
    skip: number,
    take: number,
    active?: boolean
  ): Promise<{ users: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
    if (active !== undefined) {
      where.active = active;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}

export const userRepository = new UserRepository();
