import { pipeline } from 'node:stream/promises';
import express, { type Request, type RequestHandler, type Response } from 'express';
import { DomainError, notFound } from './errors.js';
import type { FileStorage } from './storage.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'txt',
  'md',
  'csv',
  'zip',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'py',
  'cpp',
  'c',
  'h',
  'java',
  'js',
  'ts',
  'json',
  'ipynb',
  'sql',
]);

export interface UploadedFile {
  name: string;
  data: Buffer;
}

export const receiveRaw: RequestHandler = express.raw({
  type: () => true,
  limit: MAX_UPLOAD_BYTES,
});

function cleanName(raw: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const base = decoded.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

export function readUpload(req: Request): UploadedFile {
  const name = cleanName(req.header('x-file-name') ?? '');
  const fail = (message: string): never => {
    throw new DomainError('validation', 'Файл не пройшов перевірку', [
      { path: 'headers.x-file-name', message },
    ]);
  };
  if (name === '' || name.length > 200) fail('Вкажіть назву файлу (до 200 символів)');
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    fail('Цей тип файлу не підтримується');
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new DomainError('validation', 'Файл не пройшов перевірку', [
      { path: 'body', message: 'Файл порожній' },
    ]);
  }
  return { name, data: req.body };
}

export async function sendStoredFile(
  res: Response,
  storage: FileStorage,
  file: { key: string; name: string },
): Promise<void> {
  const opened = await storage.open(file.key);
  if (!opened) throw notFound('Файл');
  const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(opened.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  await pipeline(opened.stream, res);
}
