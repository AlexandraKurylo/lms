import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Те, чим користуються репозиторії: звичайний клієнт АБО клієнт усередині транзакції
 * (`prisma.$transaction(async (tx) => …)`). Репозиторії не знають, у транзакції вони чи ні.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

export interface PrismaOptions {
  /** 'query' виводить кожен SQL у консоль: так видно N+1 (див. PRISMA_LOG у .env). */
  log?: 'query' | 'off';
}

export function createPrisma(url: string, options: PrismaOptions = {}): PrismaClient {
  return new PrismaClient({
    datasourceUrl: url,
    log: options.log === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/** Помилка унікальності (P2002): працює і для індексів, яких Prisma не описує в схемі. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export { Prisma, PrismaClient };
