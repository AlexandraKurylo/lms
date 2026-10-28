import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  ADMIN_DB,
  BACKUP_DIR,
  MODE,
  checkMode,
  checkSums,
  companions,
  compareStats,
  composeService,
  die,
  latestDump,
  log,
  main,
  pgRestore,
  psql,
  snapshotStats,
  sourceDb,
  uploadsUnpack,
} from './common.js';

async function restore(): Promise<void> {
  const args = process.argv.slice(2);
  const known = ['--yes', '--no-uploads'];
  if (args.some((a) => a.startsWith('-') && !known.includes(a))) {
    log('Використання: npm run db:restore -- [--yes] [--no-uploads] [файл.dump]');
    log(`Без файлу береться найновіша копія з каталогу ${BACKUP_DIR}.`);
    process.exitCode = 2;
    return;
  }
  const assumeYes = args.includes('--yes');
  const withUploads = !args.includes('--no-uploads');
  const dump = args.find((a) => !a.startsWith('-')) ?? (await latestDump());
  if (!dump || !existsSync(dump)) die('Файл копії не знайдено');

  await checkMode();

  const files = companions(dump);
  if (existsSync(files.sums))
    await checkSums(files.sums).catch((e: Error) => die(`${e.message}. Копія пошкоджена`));
  else log('Попередження: немає файлу контрольних сум, цілісність не перевірено');

  const db = sourceDb();
  const restoreFiles = withUploads && existsSync(files.uploads);
  log(`Буде відновлено базу ${db} з ${basename(dump)}`);
  if (restoreFiles) log(`і файли користувачів з ${basename(files.uploads)}`);
  log(
    `Поточні дані бази${restoreFiles ? ' і файлів' : ''} буде видалено без можливості повернення.`,
  );

  if (!assumeYes) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await rl.question('Введіть "так" для продовження: ');
    rl.close();
    if (answer.trim() !== 'так') die('Скасовано');
  }

  const stopped: string[] = [];
  if (MODE === 'docker') {
    for (const service of ['web', 'api']) {
      if (await composeService(['ps', '--status', 'running', '-q', service])) {
        await composeService(['stop', service]);
        stopped.push(service);
      }
    }
  }

  let ok = true;
  try {
    await psql(ADMIN_DB, `DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
    await psql(ADMIN_DB, `CREATE DATABASE "${db}"`);
    log('Відновлення бази...');
    await pgRestore(db, dump);

    if (restoreFiles) {
      log('Відновлення файлів...');
      await uploadsUnpack(files.uploads);
    }

    log('Перевірка після відновлення...');
    if (existsSync(files.stats)) {
      const saved = await readFile(files.stats, 'utf8');
      ok = compareStats(await snapshotStats(db), saved, saved.startsWith('# drift'));
    }
  } finally {
    for (const service of ['api', 'web']) {
      if (stopped.includes(service)) await composeService(['start', service]);
    }
  }

  if (!ok) die('Відновлення завершено з розбіжностями, перевірте повідомлення вище');
  log('Відновлення завершено.');
}

await main(restore);
