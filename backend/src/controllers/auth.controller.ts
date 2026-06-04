import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/user.repository.js';
import { tokenRepository } from '../repositories/token.repository.js';
import { securityService } from '../services/security.service.ts';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { parseCookies } from '../utils/cookies.ts';
import { AppError } from '../types/api.js';
import { SECURITY_CONFIG } from '../config/security.js';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(SECURITY_CONFIG.PASSWORD_MIN_LENGTH, `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // 1. Parse and validate parameters
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid credentials schema format', 400, parsed.error.format());
    }

    const { email, password } = parsed.data;

    // 2. Lookup user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      await securityService.logSecurityEvent({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'Email not found' },
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // 3. Check active state
    if (!user.active) {
      await securityService.logSecurityEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'Account de-activated' },
      });
      throw new AppError('USER_DISABLED', 'Your account has been deactivated', 403);
    }

    // 4. Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      await securityService.logSecurityEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'Password mismatch' },
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // 5. Generate Access Token & Refresh Token
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 6. Persist Refresh Token
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.JWT_REFRESH_COOKIE_MAX_AGE);
    await tokenRepository.create(refreshToken, user.id, expiresAt);

    // 7. Log security event
    await securityService.logSecurityEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    // 8. Set HTTP-only secure Cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: SECURITY_CONFIG.JWT_REFRESH_COOKIE_MAX_AGE,
    });

    res.json({
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          changePasswordOnFirstLogin: user.changePasswordOnFirstLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['refreshToken'];

    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Refresh token missing', 401);
    }

    // 1. Detect token reuse (session hijacking mitigation)
    const isReused = await securityService.detectTokenReuse(token);
    if (isReused) {
      await securityService.logSecurityEvent({
        action: 'TOKEN_REUSE_DETECTED',
        ipAddress,
        userAgent,
        details: { token },
      });
      res.clearCookie('refreshToken');
      throw new AppError('UNAUTHORIZED', 'Session compromised. Please log in again.', 401);
    }

    // 2. Verify token signature
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
    }

    // 3. Fetch token record
    const tokenRecord = await tokenRepository.find(token);
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
    }

    // 4. Revoke old refresh token (as part of rotation rule)
    await tokenRepository.revoke(token);

    // 5. Check if user is active
    const user = await userRepository.findById(decoded.userId);
    if (!user || !user.active) {
      throw new AppError('UNAUTHORIZED', 'User not found or account de-activated', 401);
    }

    // 6. Generate new access and refresh tokens
    const payload = { userId: user.id, role: user.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    // 7. Persist new Refresh Token
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.JWT_REFRESH_COOKIE_MAX_AGE);
    await tokenRepository.create(newRefreshToken, user.id, expiresAt);

    // 8. Set HTTP-only cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: SECURITY_CONFIG.JWT_REFRESH_COOKIE_MAX_AGE,
    });

    res.json({
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['refreshToken'];

    if (token) {
      const tokenRecord = await tokenRepository.find(token);
      if (tokenRecord) {
        // Revoke token in DB
        await tokenRepository.revoke(token);
        await securityService.logSecurityEvent({
          userId: tokenRecord.userId,
          action: 'LOGOUT',
          ipAddress,
          userAgent,
        });
      }
    }

    res.clearCookie('refreshToken');
    res.json({
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}
