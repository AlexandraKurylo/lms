import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  ADMIN_DB,
  checkMode,
  checkSums,
  companions,
  compareStats,
  die,
  latestDump,
  listArchive,
  log,
  main,
  pgRestore,
  psql,
  snapshotStats,
  sourceDb,
} from './common.js';

async function verify(): Promise<void> {
  const dump = process.argv[2] ?? (await latestDump());
  if (!dump || !existsSync(dump)) die('Файл копії не знайдено');
  await checkMode();

  const files = companions(dump);
  const checkDb = `${sourceDb()}_restore_check`;
  const started = Date.now();
  const drop = () =>
    psql(ADMIN_DB, `DROP DATABASE IF EXISTS "${checkDb}" WITH (FORCE)`).catch(() => '');

  if (!existsSync(files.sums)) die(`Немає файлу контрольних сум ${basename(files.sums)}`);
  await checkSums(files.sums);
  if (!existsSync(files.stats)) die(`Немає файлу ${basename(files.stats)}`);

  let ok: boolean;
  try {
    await drop();
    await psql(ADMIN_DB, `CREATE DATABASE "${checkDb}"`);
    log(`Відновлення ${basename(dump)} у тимчасову базу ${checkDb}...`);
    await pgRestore(checkDb, dump);

    const restored = await snapshotStats(checkDb);
    const saved = await readFile(files.stats, 'utf8');
    log('Порівняння з даними на момент копіювання:');
    ok = compareStats(restored, saved, saved.startsWith('# drift'));
    for (const [key, value] of restored) log(`  ${key} = ${value}`);

    const refs = (
      await psql(
        checkDb,
        'SELECT file_path FROM materials WHERE file_path IS NOT NULL UNION SELECT file_path FROM submissions WHERE file_path IS NOT NULL ORDER BY 1',
      )
    )
      .split('\n')
      .filter(Boolean);

    if (refs.length === 0) {
      log('  файли: база не посилається на завантажені файли');
    } else if (!existsSync(files.uploads)) {
      log('  РОЗБІЖНІСТЬ: база посилається на файли, але архіву файлів немає');
      ok = false;
    } else {
      const listed = new Set(await listArchive(files.uploads));
      const missing = refs.filter((r) => !listed.has(r));
      if (missing.length > 0) {
        log(
          `  РОЗБІЖНІСТЬ: в архіві немає ${missing.length} з ${refs.length} файлів, на які посилається база`,
        );
        ok = false;
      } else {
        log(`  файли: усі ${refs.length} посилань із бази є в архіві`);
      }
    }
  } finally {
    await drop();
  }

  if (!ok) die('Перевірка не пройдена');
  log(`Перевірка пройдена за ${Math.round((Date.now() - started) / 1000)} с.`);
}

await main(verify);
