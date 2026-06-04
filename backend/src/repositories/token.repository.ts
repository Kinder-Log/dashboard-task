import { RefreshToken } from '@prisma/client';
import prisma from '../config/db.js';

export interface ITokenRepository {
  create(token: string, userId: string, expiresAt: Date): Promise<RefreshToken>;
  find(token: string): Promise<RefreshToken | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export class TokenRepository implements ITokenRepository {
  public async create(token: string, userId: string, expiresAt: Date): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  public async find(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  public async revoke(token: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }
}

export const tokenRepository = new TokenRepository();
