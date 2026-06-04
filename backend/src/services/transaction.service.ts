import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/db.js';

export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

export interface ITransactionService {
  run<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T>;
}

export class TransactionService implements ITransactionService {
  public async run<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      return fn(tx as any);
    });
  }
}

export const transactionService = new TransactionService();
