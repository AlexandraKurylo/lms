import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RealLesson } from './pythonLessons.js';

const dir = fileURLToPath(new URL('./cpp/', import.meta.url));

function parseLesson(file: string): RealLesson {
  const [heading = '', ...rest] = readFileSync(`${dir}${file}`, 'utf8').split('\n');
  const match = /^#\s*Урок\s*\d+\.\s*(.+)$/i.exec(heading);
  return {
    title: match?.[1]?.trim() ?? heading.replace(/^#\s*/, '').trim(),
    content: rest.join('\n').trim(),
  };
}

export const CPP_LESSONS: RealLesson[] = readdirSync(dir)
  .filter((file) => /^lesson_\d+\.md$/.test(file))
  .sort()
  .map(parseLesson);
