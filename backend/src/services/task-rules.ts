import { Role } from '@prisma/client';
import prisma from '../config/db.js';

export class TaskRules {
  public static async canChangeStatus(
    fromStatus: string,
    toStatus: string,
    role: Role
  ): Promise<boolean> {
    // If Admin, bypass transition rule restrictions
    if (role === Role.ADMIN) {
      return true;
    }

    const rule = await prisma.taskTransitionRule.findUnique({
      where: {
        fromStatus_toStatus_roleAllowed: {
          fromStatus,
          toStatus,
          roleAllowed: role,
        },
      },
    });

    return !!rule;
  }
}
