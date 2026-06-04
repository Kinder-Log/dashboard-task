import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/security.js';
import { AuthorizationContext } from '../types/auth.js';

import crypto from 'crypto';

interface JWTPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECURITY_CONFIG.JWT_ACCESS_SECRET, {
    expiresIn: SECURITY_CONFIG.JWT_ACCESS_EXPIRY,
  });
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    SECURITY_CONFIG.JWT_REFRESH_SECRET,
    {
      expiresIn: SECURITY_CONFIG.JWT_REFRESH_EXPIRY,
    }
  );
}

export function verifyAccessToken(token: string): AuthorizationContext {
  const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_ACCESS_SECRET) as JWTPayload & jwt.JwtPayload;
  return {
    userId: decoded.userId,
    role: decoded.role as any,
  };
}

export function verifyRefreshToken(token: string): AuthorizationContext {
  const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_REFRESH_SECRET) as JWTPayload & jwt.JwtPayload;
  return {
    userId: decoded.userId,
    role: decoded.role as any,
  };
}
