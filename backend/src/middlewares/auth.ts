import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../types/api.js';

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Authorization token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
      }
      throw new AppError('UNAUTHORIZED', 'Invalid authorization token', 401);
    }

    // Double check user is active and exists
    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User not found', 401);
    }

    if (!user.active) {
      throw new AppError('USER_DISABLED', 'Your account has been deactivated', 403);
    }

    req.user = {
      userId: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Access denied: insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
