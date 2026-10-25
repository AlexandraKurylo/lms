import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export interface FileStorage {
  save(data: Buffer): Promise<string>;
  open(key: string): Promise<{ stream: ReadStream; size: number } | null>;
  remove(key: string): Promise<void>;
}

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createFileStorage(dir: string): FileStorage {
  const pathOf = (key: string): string | null => (KEY_PATTERN.test(key) ? join(dir, key) : null);

  return {
    async save(data) {
      await mkdir(dir, { recursive: true });
      const key = randomUUID();
      await writeFile(join(dir, key), data, { flag: 'wx' });
      return key;
    },

    async open(key) {
      const path = pathOf(key);
      if (!path) return null;
      try {
        const info = await stat(path);
        return { stream: createReadStream(path), size: info.size };
      } catch {
        return null;
      }
    },

    async remove(key) {
      const path = pathOf(key);
      if (path) await rm(path, { force: true });
    },
  };
}
