import { Role } from '@prisma/client';

export interface AuthorizationContext {
  userId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthorizationContext;
    }
  }
}
