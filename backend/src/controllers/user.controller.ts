import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../types/api.js';
import { SECURITY_CONFIG } from '../config/security.js';

const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(SECURITY_CONFIG.PASSWORD_MIN_LENGTH, `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']).optional(),
  active: z.boolean().optional(),
});

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const activeQuery = req.query.active !== undefined ? req.query.active === 'true' : undefined;

    const { users, total } = await userRepository.list(skip, limit, activeQuery);

    const usersData = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      changePasswordOnFirstLogin: u.changePasswordOnFirstLogin,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json({
      data: usersData,
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

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs', 400, parsed.error.format());
    }

    const { name, email, password, role } = parsed.data;

    // Check email uniqueness
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('VALIDATION_ERROR', 'Email already in use', 400);
    }

    const salt = await bcrypt.genSalt(SECURITY_CONFIG.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      role,
      changePasswordOnFirstLogin: true, // Force change on first login
    });

    res.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        changePasswordOnFirstLogin: user.changePasswordOnFirstLogin,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid inputs', 400, parsed.error.format());
    }

    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    // Check email uniqueness if changing email
    if (parsed.data.email && parsed.data.email !== existing.email) {
      const emailDup = await userRepository.findByEmail(parsed.data.email);
      if (emailDup) {
        throw new AppError('VALIDATION_ERROR', 'Email already in use', 400);
      }
    }

    const updated = await userRepository.update(id, parsed.data);

    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        active: updated.active,
        changePasswordOnFirstLogin: updated.changePasswordOnFirstLogin,
      },
    });
  } catch (error) {
    next(error);
  }
}
