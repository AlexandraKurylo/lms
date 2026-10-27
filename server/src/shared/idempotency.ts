import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { DomainError } from './errors.js';
import { inTransaction, type Db } from './db.js';

export const idempotencyKeyHeader = z
  .string()
  .regex(/^[\x21-\x7e]{1,255}$/, 'Від 1 до 255 видимих ASCII-символів без пробілів')
  .optional();

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotentResult extends StoredResponse {
  replayed: boolean;
}

export function requestFingerprint(req: Request): string {
  const material = `${req.method} ${req.originalUrl}\n${JSON.stringify(req.body ?? null)}`;
  return createHash('sha256').update(material).digest('hex');
}

interface SavedRow {
  fingerprint: string;
  statusCode: number;
  response: unknown;
}

export async function runIdempotent(
  db: Db,
  scope: { userId: number; key: string; fingerprint: string },
  action: (tx: Db) => Promise<StoredResponse>,
): Promise<IdempotentResult> {
  const { userId, key, fingerprint } = scope;
  return inTransaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${key}`}, 0))`;

    await tx.$executeRaw`
      DELETE FROM idempotency_keys
      WHERE user_id = ${userId} AND key = ${key} AND created_at < now() - interval '24 hours'`;

    const [saved] = await tx.$queryRaw<SavedRow[]>`
      SELECT fingerprint, status_code AS "statusCode", response
      FROM idempotency_keys
      WHERE user_id = ${userId} AND key = ${key}`;

    if (saved) {
      if (saved.fingerprint !== fingerprint) {
        throw new DomainError(
          'idempotency-key-reuse',
          'Цей Idempotency-Key уже використано з іншим запитом',
        );
      }
      return { status: saved.statusCode, body: saved.response, replayed: true };
    }

    const result = await action(tx);
    await tx.$executeRaw`
      INSERT INTO idempotency_keys (user_id, key, fingerprint, status_code, response)
      VALUES (${userId}, ${key}, ${fingerprint}, ${result.status}, ${JSON.stringify(result.body)}::jsonb)`;
    return { ...result, replayed: false };
  });
}
