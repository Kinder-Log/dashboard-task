import prisma from '../config/db.js';
import { SECURITY_CONFIG } from '../config/security.js';

export interface SecurityEvent {
  userId?: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REUSE_DETECTED';
  ipAddress: string;
  userAgent: string;
  details?: any;
}

export interface ISecurityService {
  validatePasswordPolicy(password: string): boolean;
  detectTokenReuse(token: string): Promise<boolean>;
  logSecurityEvent(event: SecurityEvent): Promise<void>;
}

export class SecurityService implements ISecurityService {
  public validatePasswordPolicy(password: string): boolean {
    return password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH;
  }

  public async detectTokenReuse(token: string): Promise<boolean> {
    // 1. Fetch token
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!tokenRecord) {
      return false; // Token not found or fake
    }

    // 2. If it is already revoked, reuse detected!
    if (tokenRecord.revoked) {
      // Theft detected! Revoke all tokens for this user to lock out the session hijacking
      await prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId },
        data: { revoked: true },
      });
      return true;
    }

    return false;
  }

  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await prisma.securityAuditLog.create({
      data: {
        userId: event.userId || null,
        action: event.action,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details || {},
      },
    });
  }
}

export const securityService = new SecurityService();
