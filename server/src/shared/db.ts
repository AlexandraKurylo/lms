import { Prisma, PrismaClient } from '@prisma/client';


export type Db = PrismaClient | Prisma.TransactionClient;

export interface PrismaOptions {
  log?: 'query' | 'off';
}

export function createPrisma(url: string, options: PrismaOptions = {}): PrismaClient {
  return new PrismaClient({
    datasourceUrl: url,
    log: options.log === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

export function inTransaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if ('$transaction' in db) {
    return db.$transaction((tx) => fn(tx), { timeout: 10_000, maxWait: 5_000 });
  }
  return fn(db);
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export { Prisma, PrismaClient };
