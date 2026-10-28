import { chmod, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  BACKUP_DIR,
  BACKUP_KEEP,
  MODE,
  checkMode,
  companions,
  die,
  formatStats,
  listDumps,
  log,
  main,
  pgDump,
  pgRestoreList,
  sha256,
  snapshotStats,
  sourceDb,
  uploadsPack,
} from './common.js';

const pad = (n: number) => String(n).padStart(2, '0');

function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function backup(): Promise<void> {
  await checkMode();
  await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });

  const files = companions(join(BACKUP_DIR, `lms-${timestamp()}.dump`));
  const db = sourceDb();
  log(`Копіювання бази ${db} (${MODE})...`);

  try {
    const before = formatStats(await snapshotStats(db));
    await pgDump(`${files.dump}.partial`);
    if ((await stat(`${files.dump}.partial`)).size === 0) die('pg_dump створив порожній файл');
    await pgRestoreList(`${files.dump}.partial`).catch(() =>
      die('Файл копії не читається pg_restore'),
    );
    await rename(`${files.dump}.partial`, files.dump);
    const after = formatStats(await snapshotStats(db));
    await writeFile(files.stats, `${before === after ? '' : '# drift\n'}${after}\n`);
  } finally {
    await rm(`${files.dump}.partial`, { force: true });
  }

  const packed = await uploadsPack(`${files.uploads}.partial`).catch(() => false);
  const hasUploads = packed && (await stat(`${files.uploads}.partial`)).size > 0;
  if (hasUploads) {
    await rename(`${files.uploads}.partial`, files.uploads);
  } else {
    await rm(`${files.uploads}.partial`, { force: true });
    log('Попередження: файли користувачів не скопійовано (немає каталогу або volume)');
  }

  const names = [files.dump, files.stats, ...(hasUploads ? [files.uploads] : [])];
  const sums = await Promise.all(names.map(async (f) => `${await sha256(f)}  ${basename(f)}`));
  await writeFile(files.sums, `${sums.join('\n')}\n`);
  await Promise.all([...names, files.sums].map((f) => chmod(f, 0o600).catch(() => {})));

  if (BACKUP_KEEP > 0) {
    for (const old of (await listDumps()).slice(0, -BACKUP_KEEP)) {
      const c = companions(old);
      await Promise.all([c.dump, c.stats, c.sums, c.uploads].map((f) => rm(f, { force: true })));
      log(`Видалено стару копію: ${basename(old)}`);
    }
  }

  const size = ((await stat(files.dump)).size / 1024 / 1024).toFixed(2);
  log(`Готово: ${files.dump} (${size} МБ)`);
  if (hasUploads) log(`Файли: ${files.uploads}`);
}

await main(backup);
