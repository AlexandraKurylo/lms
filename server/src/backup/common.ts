import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

export class BackupError extends Error {}

export const ROOT = resolve(import.meta.dirname, '../../..');
export const MODE = process.env.BACKUP_MODE ?? 'docker';
export const BACKUP_DIR = resolve(ROOT, process.env.BACKUP_DIR ?? 'backups');
export const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 7);
export const PG_USER = process.env.POSTGRES_USER ?? 'lms';
export const ADMIN_DB = 'postgres';
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';
export const UPLOADS_PATH = isAbsolute(UPLOAD_DIR) ? UPLOAD_DIR : join(ROOT, 'server', UPLOAD_DIR);
const HELPER_IMAGE = process.env.BACKUP_HELPER_IMAGE ?? 'postgres:16-alpine';

export function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function die(message: string): never {
  throw new BackupError(message);
}

export async function main(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    log(`Помилка: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

interface RunOptions {
  input?: string | Readable;
  outFile?: string;
  allowFail?: boolean;
}

interface RunResult {
  code: number;
  stdout: string;
}

export function run(cmd: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let sinkDone: Promise<void> = Promise.resolve();

    if (options.outFile) {
      const sink = createWriteStream(options.outFile);
      child.stdout.pipe(sink);
      sinkDone = new Promise((done, fail) => {
        sink.on('finish', done);
        sink.on('error', fail);
      });
    } else {
      child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    }
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));

    child.stdin.on('error', () => {});
    if (typeof options.input === 'string') child.stdin.end(options.input);
    else if (options.input) options.input.pipe(child.stdin);
    else child.stdin.end();

    child.on('error', (e) => reject(new BackupError(`Не вдалося запустити ${cmd}: ${e.message}`)));
    child.on('close', (code) => {
      sinkDone.then(() => {
        const result = { code: code ?? 1, stdout: Buffer.concat(out).toString('utf8') };
        if (result.code !== 0 && !options.allowFail) {
          const text = Buffer.concat(err).toString('utf8').trim();
          reject(
            new BackupError(`${cmd} завершився з кодом ${result.code}${text ? `: ${text}` : ''}`),
          );
          return;
        }
        resolvePromise(result);
      }, reject);
    });
  });
}

const compose = (args: string[], options?: RunOptions) =>
  run('docker', ['compose', ...args], options);

function databaseUrl(): URL {
  if (!process.env.DATABASE_URL) die('У режимі local потрібна змінна DATABASE_URL');
  return new URL(process.env.DATABASE_URL);
}

function urlFor(name: string): string {
  const url = databaseUrl();
  url.pathname = `/${name}`;
  url.search = '';
  return url.toString();
}

export function sourceDb(): string {
  return MODE === 'docker' ? (process.env.POSTGRES_DB ?? 'lms') : databaseUrl().pathname.slice(1);
}

let filesInVolume = false;

export async function checkMode(): Promise<void> {
  if (MODE === 'docker') {
    const result = await run('docker', ['compose', 'ps', '-q', 'db'], { allowFail: true });
    if (result.code !== 0 || !result.stdout.trim()) {
      die('Контейнер бази не запущено. Виконайте: docker compose up -d');
    }
    const source = process.env.UPLOADS_SOURCE;
    if (source === 'volume') filesInVolume = true;
    else if (source !== 'dir') {
      const api = await run(
        'docker',
        ['compose', '--profile', 'app', 'ps', '--status', 'running', '-q', 'api'],
        {
          allowFail: true,
        },
      );
      const localFiles = await readdir(UPLOADS_PATH).catch(() => [] as string[]);
      filesInVolume = api.stdout.trim() !== '' && localFiles.length === 0;
    }
    log(`Файли користувачів: ${filesInVolume ? 'volume lms_uploads' : UPLOADS_PATH}`);
    return;
  }
  if (MODE !== 'local') die('BACKUP_MODE має бути docker або local');
  for (const tool of ['psql', 'pg_dump', 'pg_restore', 'tar']) {
    const probe = await run(tool, ['--version'], { allowFail: true }).catch(() => ({ code: 1 }));
    if (probe.code !== 0) die(`Не знайдено ${tool}. Встановіть клієнт PostgreSQL 16`);
  }
}

export async function pgDump(outFile: string): Promise<void> {
  if (MODE === 'docker') {
    await compose(
      [
        'exec',
        '-T',
        'db',
        'pg_dump',
        '-U',
        PG_USER,
        '-d',
        sourceDb(),
        '-Fc',
        '--no-owner',
        '--no-acl',
      ],
      { outFile },
    );
  } else {
    await run('pg_dump', [urlFor(sourceDb()), '-Fc', '--no-owner', '--no-acl'], { outFile });
  }
}

export async function pgRestore(dbName: string, dumpFile: string): Promise<void> {
  if (MODE === 'docker') {
    await compose(
      [
        'exec',
        '-T',
        'db',
        'pg_restore',
        '-U',
        PG_USER,
        '-d',
        dbName,
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
      ],
      { input: createReadStream(dumpFile) },
    );
  } else {
    await run('pg_restore', [
      '-d',
      urlFor(dbName),
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      dumpFile,
    ]);
  }
}

export async function pgRestoreList(dumpFile: string): Promise<void> {
  if (MODE === 'docker') {
    await compose(['exec', '-T', 'db', 'pg_restore', '-l'], { input: createReadStream(dumpFile) });
  } else {
    await run('pg_restore', ['-l', dumpFile]);
  }
}

export async function psql(dbName: string, sql: string, separator = '|'): Promise<string> {
  const flags = ['-v', 'ON_ERROR_STOP=1', '-qAt', '-F', separator, '-c', sql];
  const result =
    MODE === 'docker'
      ? await compose(['exec', '-T', 'db', 'psql', '-U', PG_USER, '-d', dbName, ...flags])
      : await run('psql', [urlFor(dbName), ...flags]);
  return result.stdout.trim();
}

export type Stats = Array<[string, string]>;

export async function snapshotStats(dbName: string): Promise<Stats> {
  const tables = (
    await psql(
      dbName,
      "SELECT relname FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname",
    )
  )
    .split('\n')
    .filter(Boolean);
  const counts = tables.map(
    (t) => `SELECT '${t}' AS t, count(*) AS n FROM public."${t.replaceAll('"', '""')}"`,
  );
  const parts = [
    ...(counts.length
      ? [`SELECT 'table:' || t AS k, n::text AS v FROM (${counts.join(' UNION ALL ')}) s`]
      : []),
    "SELECT 'indexes', count(*)::text FROM pg_indexes WHERE schemaname = 'public'",
    "SELECT 'constraints', count(*)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'",
  ];
  const text = await psql(dbName, `SELECT k, v FROM (${parts.join(' UNION ALL ')}) x ORDER BY k`);
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [key = '', value = ''] = line.split('|');
      return [key, value];
    });
}

export function formatStats(stats: Stats): string {
  return stats.map(([k, v]) => `${k}|${v}`).join('\n');
}

export function compareStats(restored: Stats, savedText: string, tolerant: boolean): boolean {
  const got = new Map(restored);
  let ok = true;
  for (const line of savedText.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [key = '', want = ''] = line.split('|');
    const actual = got.get(key);
    if (actual === want) continue;
    if (tolerant && key.startsWith('table:')) {
      log(
        `  попередження: ${key}: у копії ${want}, після відновлення ${actual ?? 'немає'} (база змінювалась під час копіювання)`,
      );
      continue;
    }
    log(`  РОЗБІЖНІСТЬ: ${key}: у копії ${want}, після відновлення ${actual ?? 'немає'}`);
    ok = false;
  }
  return ok;
}

export async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export async function checkSums(sumsFile: string): Promise<void> {
  const dir = resolve(sumsFile, '..');
  const lines = (await readFile(sumsFile, 'utf8')).split('\n').filter(Boolean);
  for (const line of lines) {
    const [expected = '', name = ''] = line.split(/\s+/);
    if ((await sha256(join(dir, name))) !== expected) die(`Контрольна сума не збігається: ${name}`);
  }
  log(`Контрольні суми збігаються (${lines.length})`);
}

export interface BackupFiles {
  dump: string;
  stats: string;
  uploads: string;
  sums: string;
}

export function companions(dump: string): BackupFiles {
  const base = dump.replace(/\.dump$/, '');
  return { dump, stats: `${base}.stats`, uploads: `${base}-uploads.tgz`, sums: `${base}.sha256` };
}

export async function listDumps(): Promise<string[]> {
  const names = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  return names
    .filter((n) => /^lms-\d{8}-\d{6}\.dump$/.test(n))
    .sort()
    .map((n) => join(BACKUP_DIR, n));
}

export async function latestDump(): Promise<string | undefined> {
  return (await listDumps()).at(-1);
}

async function uploadsVolume(): Promise<string> {
  if (process.env.UPLOADS_VOLUME) return process.env.UPLOADS_VOLUME;
  const result = await run('docker', ['volume', 'ls', '-q', '--filter', 'name=lms_uploads']);
  return result.stdout.split('\n').find(Boolean) ?? '';
}

export async function uploadsPack(outFile: string): Promise<boolean> {
  if (MODE === 'docker' && filesInVolume) {
    const volume = await uploadsVolume();
    if (!volume) return false;
    await run(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${volume}:/data:ro`,
        '--entrypoint',
        'tar',
        HELPER_IMAGE,
        '-C',
        '/data',
        '-czf',
        '-',
        '.',
      ],
      { outFile },
    );
    return true;
  }
  const exists = await readdir(UPLOADS_PATH).then(
    () => true,
    () => false,
  );
  if (!exists) return false;
  await run('tar', ['-C', UPLOADS_PATH, '-czf', '-', '.'], { outFile });
  return true;
}

export async function uploadsUnpack(archive: string): Promise<void> {
  if (MODE === 'docker' && filesInVolume) {
    const volume = await uploadsVolume();
    if (!volume) die('Не знайдено volume з файлами (lms_uploads). Задайте UPLOADS_VOLUME');
    await run(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '-v',
        `${volume}:/data`,
        '--entrypoint',
        'sh',
        HELPER_IMAGE,
        '-c',
        'find /data -mindepth 1 -delete && tar -C /data -xzf -',
      ],
      { input: createReadStream(archive) },
    );
    return;
  }
  await mkdir(UPLOADS_PATH, { recursive: true });
  for (const entry of await readdir(UPLOADS_PATH)) {
    await rm(join(UPLOADS_PATH, entry), { recursive: true, force: true });
  }
  await run('tar', ['-C', UPLOADS_PATH, '-xzf', '-'], { input: createReadStream(archive) });
}

export async function listArchive(archive: string): Promise<string[]> {
  const result = await run('tar', ['-tzf', '-'], { input: createReadStream(archive) });
  return result.stdout
    .split('\n')
    .map((n) => n.replace(/^\.\//, '').trim())
    .filter((n) => n && !n.endsWith('/'));
}

export async function composeService(args: string[]): Promise<string> {
  return (await compose(['--profile', 'app', ...args], { allowFail: true })).stdout.trim();
}
