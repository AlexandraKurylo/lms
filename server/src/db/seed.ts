import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import type { CourseLevel, MaterialKind } from '@prisma/client';
import { createPrisma } from '../shared/db.js';
import {
  COURSES,
  FEEDBACK_PHRASES,
  FIRST_NAMES,
  LAST_NAMES,
  LESSON_PHRASES,
  LESSON_SENTENCES,
  MATERIAL_TEMPLATES,
  TEACHER_BIOS,
  TOPICS,
} from './seedData.js';

/** Пароль усіх демо-акаунтів. Лише для розробки: у production сид не запускається. */
export const DEMO_PASSWORD = 'Demo12345!';

export const SEED_COUNTS = {
  teachers: 10,
  students: 200,
  streams: 80,
  lessons: 500,
  enrollments: 800,
} as const;

// ---------- детермінований генератор ----------
// Той самий seed дає ті самі дані, тож сторінки, тести й скріншоти відтворювані.

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      const item = items[int(0, items.length - 1)];
      if (item === undefined) throw new Error('pick з порожнього масиву');
      return item;
    },
    chance: (p) => next() < p,
  };
}

// ---------- модель сид-даних ----------

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  bio: string | null;
}
interface CourseRow {
  id: number;
  title: string;
  description: string;
  language: string;
  level: string;
  teacherId: number;
  status: 'draft' | 'published';
  sequential: boolean;
}
interface LessonRow {
  id: number;
  courseId: number;
  position: number;
  title: string;
  content: string;
  freeIntro: boolean;
  homework: boolean;
}
interface StreamRow {
  id: number;
  courseId: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
}
interface EnrollmentRow {
  id: number;
  studentId: number;
  streamId: number;
  courseId: number;
  status: 'active' | 'completed' | 'cancelled';
  enrolledAt: string;
}
interface ProgressRow {
  studentId: number;
  lessonId: number;
  completedAt: string;
}
interface SubmissionRow {
  id: number;
  studentId: number;
  lessonId: number;
  streamId: number;
  comment: string;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}
interface MaterialRow {
  id: number;
  lessonId: number;
  title: string;
  kind: string;
  url: string;
}

export interface SeedData {
  topics: { id: number; name: string }[];
  users: (UserRow & { passwordHash: string })[];
  courses: CourseRow[];
  courseTopics: { courseId: number; topicId: number }[];
  lessons: LessonRow[];
  materials: MaterialRow[];
  streams: StreamRow[];
  enrollments: EnrollmentRow[];
  progress: ProgressRow[];
  submissions: SubmissionRow[];
}

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 0, 1);
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isoTime = (ms: number) => new Date(ms).toISOString();

/** Чиста функція: збирає всі дані в пам'яті, до бази не звертається. */
export function buildSeed(passwordHash: string, seed = 20260101): SeedData {
  const rng = createRng(seed);

  // теми
  const topics = TOPICS.map((name, i) => ({ id: i + 1, name }));
  const topicId = new Map(topics.map((t) => [t.name as string, t.id]));

  // користувачі: 1 адміністратор, 10 викладачів, 200 студентів
  const users: SeedData['users'] = [];
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const fullName = (i: number) =>
    `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7 + Math.floor(i / 30)) % LAST_NAMES.length]}`;

  users.push({
    id: 1,
    email: 'admin@example.com',
    name: 'Адміністратор Системи',
    role: 'admin',
    bio: null,
    passwordHash,
  });
  const teacherIds: number[] = [];
  for (let i = 1; i <= SEED_COUNTS.teachers; i++) {
    const id = users.length + 1;
    teacherIds.push(id);
    users.push({
      id,
      email: `teacher${pad(i, 2)}@example.com`,
      name: fullName(i + 100),
      role: 'teacher',
      bio: TEACHER_BIOS[i % TEACHER_BIOS.length] ?? null,
      passwordHash,
    });
  }
  const studentIds: number[] = [];
  for (let i = 1; i <= SEED_COUNTS.students; i++) {
    const id = users.length + 1;
    studentIds.push(id);
    users.push({
      id,
      email: `student${pad(i, 3)}@example.com`,
      name: fullName(i),
      role: 'student',
      bio: null,
      passwordHash,
    });
  }

  // курси та зв'язок з темами
  const courses: CourseRow[] = [];
  const courseTopics: SeedData['courseTopics'] = [];
  COURSES.forEach((c, i) => {
    const id = i + 1;
    courses.push({
      id,
      title: c.title,
      description: `${c.title}. Курс з практичними завданнями, розбором прикладів і підтримкою викладача.`,
      language: c.language,
      level: c.level,
      teacherId: teacherIds[i % teacherIds.length]!,
      status: c.draft ? 'draft' : 'published',
      sequential: rng.chance(0.75),
    });
    for (const t of c.topics) {
      const tid = topicId.get(t);
      if (tid === undefined) throw new Error(`Невідома тема: ${t}`);
      courseTopics.push({ courseId: id, topicId: tid });
    }
  });

  // уроки: рівно 500, у кожному курсі 8–18
  const sizes = courses.map(() => 8);
  let left = SEED_COUNTS.lessons - sizes.reduce((a, b) => a + b, 0);
  while (left > 0) {
    const i = rng.int(0, sizes.length - 1);
    if (sizes[i]! < 18) {
      sizes[i]!++;
      left--;
    }
  }
  const lessons: LessonRow[] = [];
  const materials: MaterialRow[] = [];
  courses.forEach((course, ci) => {
    for (let p = 1; p <= sizes[ci]!; p++) {
      const id = lessons.length + 1;
      const intro = p === 1;
      lessons.push({
        id,
        courseId: course.id,
        position: p,
        title: intro ? 'Вступ до курсу' : `${rng.pick(LESSON_PHRASES)} №${p}`,
        content: [
          rng.pick(LESSON_SENTENCES),
          rng.pick(LESSON_SENTENCES),
          rng.pick(LESSON_SENTENCES),
        ].join(' '),
        freeIntro: intro,
        homework: !intro && rng.chance(0.3),
      });
      const count = rng.int(1, 3);
      for (let m = 0; m < count; m++) {
        const tpl = MATERIAL_TEMPLATES[m % MATERIAL_TEMPLATES.length]!;
        materials.push({
          id: materials.length + 1,
          lessonId: id,
          title: tpl.title,
          kind: tpl.kind,
          url: `https://example.com/materials/${id}/${m + 1}`,
        });
      }
    }
  });

  // потоки: 80, лише для опублікованих курсів (по 2 на курс, решта — додаткові)
  const published = courses.filter((c) => c.status === 'published');
  const streams: StreamRow[] = [];
  const addStream = (course: CourseRow, n: number) => {
    const start = BASE + rng.int(-120, 240) * DAY;
    streams.push({
      id: streams.length + 1,
      courseId: course.id,
      title: `Потік ${n}`,
      startsOn: isoDate(start),
      endsOn: isoDate(start + rng.int(30, 90) * DAY),
      capacity: rng.int(8, 25),
    });
  };
  published.forEach((c) => {
    addStream(c, 1);
    addStream(c, 2);
  });
  let extra = 3;
  for (let i = 0; streams.length < SEED_COUNTS.streams; i++) {
    addStream(published[i % published.length]!, extra);
    if (i % published.length === published.length - 1) extra++;
  }
  const streamsByCourse = new Map<number, StreamRow[]>();
  for (const s of streams) {
    const list = streamsByCourse.get(s.courseId) ?? [];
    list.push(s);
    streamsByCourse.set(s.courseId, list);
  }

  // записи: кожен студент на 4 різних курси, по одному потоку на курс
  const enrollments: EnrollmentRow[] = [];
  const perStudent = SEED_COUNTS.enrollments / SEED_COUNTS.students;
  for (const studentId of studentIds) {
    const chosen = new Set<number>();
    while (chosen.size < perStudent) chosen.add(rng.pick(published).id);
    for (const courseId of chosen) {
      const stream = rng.pick(streamsByCourse.get(courseId)!);
      const r = rng.next();
      enrollments.push({
        id: enrollments.length + 1,
        studentId,
        streamId: stream.id,
        courseId,
        status: r < 0.7 ? 'active' : r < 0.85 ? 'completed' : 'cancelled',
        enrolledAt: isoTime(Date.parse(stream.startsOn) - rng.int(1, 30) * DAY),
      });
    }
  }

  // місткість: не менша за кількість зайнятих місць; кілька потоків — особливі
  const occupied = new Map<number, number>();
  for (const e of enrollments) {
    if (e.status !== 'cancelled') occupied.set(e.streamId, (occupied.get(e.streamId) ?? 0) + 1);
  }
  const taken = (s: StreamRow) => occupied.get(s.id) ?? 0;
  for (const s of streams) s.capacity = Math.max(s.capacity, taken(s) + rng.int(1, 6));
  const byLoad = [...streams].sort((a, b) => taken(b) - taken(a) || a.id - b.id);
  // три повні потоки та один із єдиним вільним місцем — для демонстрації й тестів
  for (const s of byLoad.slice(0, 3)) s.capacity = taken(s);
  const lastSeat = byLoad[3]!;
  lastSeat.capacity = taken(lastSeat) + 1;

  // прогрес: впорядкований префікс уроків, для completed — усі уроки
  const lessonsByCourse = new Map<number, LessonRow[]>();
  for (const l of lessons) {
    const list = lessonsByCourse.get(l.courseId) ?? [];
    list.push(l);
    lessonsByCourse.set(l.courseId, list);
  }
  const streamById = new Map(streams.map((s) => [s.id, s]));
  const progress: ProgressRow[] = [];
  const submissions: SubmissionRow[] = [];
  for (const e of enrollments) {
    const list = lessonsByCourse.get(e.courseId)!;
    const stream = streamById.get(e.streamId)!;
    const done =
      e.status === 'completed'
        ? list.length
        : e.status === 'active'
          ? rng.int(0, list.length - 1)
          : rng.int(0, Math.min(2, list.length - 1));
    for (let i = 0; i < done; i++) {
      const lesson = list[i]!;
      const at = Date.parse(stream.startsOn) + (i + 1) * rng.int(1, 3) * DAY;
      progress.push({ studentId: e.studentId, lessonId: lesson.id, completedAt: isoTime(at) });
      if (lesson.homework && rng.chance(0.7)) {
        const graded = rng.chance(0.6);
        const gradedAt = at + rng.int(1, 4) * DAY;
        submissions.push({
          id: submissions.length + 1,
          studentId: e.studentId,
          lessonId: lesson.id,
          streamId: e.streamId,
          comment: 'Надсилаю виконане завдання.',
          submittedAt: isoTime(at),
          grade: graded ? rng.int(40, 100) : null,
          feedback: graded ? rng.pick(FEEDBACK_PHRASES) : null,
          gradedAt: graded ? isoTime(gradedAt) : null,
        });
      }
    }
  }

  return {
    topics,
    users,
    courses,
    courseTopics,
    lessons,
    materials,
    streams,
    enrollments,
    progress,
    submissions,
  };
}

// ---------- запис у базу (Prisma) ----------

const SEQUENCE_TABLES = [
  'users',
  'topics',
  'courses',
  'lessons',
  'materials',
  'streams',
  'enrollments',
  'submissions',
];

/** createMany порціями: так жоден запит не впирається в ліміт параметрів PostgreSQL. */
function chunks<T>(items: T[], size = 2000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Очищає таблиці й записує сид однією транзакцією: або все, або нічого.
 * Повторний запуск дає той самий результат (ідемпотентність): спершу TRUNCATE, потім ті самі
 * дані з тими самими id. Явні id вставляються як є, а після цього послідовності зсуваються.
 */
export async function writeSeed(connectionString: string, data: SeedData): Promise<void> {
  const prisma = createPrisma(connectionString);
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `TRUNCATE submissions, lesson_progress, enrollments, streams, materials, lessons,
                    course_topics, courses, topics, users RESTART IDENTITY CASCADE`,
        );

        await tx.topic.createMany({ data: data.topics });
        await tx.user.createMany({
          data: data.users.map((u) => ({
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            role: u.role,
            bio: u.bio,
          })),
        });
        await tx.course.createMany({
          data: data.courses.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            language: c.language,
            level: c.level as CourseLevel,
            teacherId: c.teacherId,
            status: c.status,
            sequentialLessons: c.sequential,
          })),
        });
        await tx.courseTopic.createMany({ data: data.courseTopics });
        await tx.lesson.createMany({
          data: data.lessons.map((l) => ({
            id: l.id,
            courseId: l.courseId,
            position: l.position,
            title: l.title,
            content: l.content,
            isFreeIntro: l.freeIntro,
            hasHomework: l.homework,
          })),
        });
        await tx.material.createMany({
          data: data.materials.map((m) => ({
            id: m.id,
            lessonId: m.lessonId,
            title: m.title,
            kind: m.kind as MaterialKind,
            url: m.url,
          })),
        });
        await tx.stream.createMany({
          data: data.streams.map((s) => ({
            id: s.id,
            courseId: s.courseId,
            title: s.title,
            startsOn: new Date(s.startsOn),
            endsOn: new Date(s.endsOn),
            capacity: s.capacity,
          })),
        });
        for (const part of chunks(data.enrollments)) {
          await tx.enrollment.createMany({
            data: part.map((e) => ({
              id: e.id,
              studentId: e.studentId,
              streamId: e.streamId,
              courseId: e.courseId,
              status: e.status,
              enrolledAt: new Date(e.enrolledAt),
            })),
          });
        }
        for (const part of chunks(data.progress)) {
          await tx.lessonProgress.createMany({
            data: part.map((p) => ({
              studentId: p.studentId,
              lessonId: p.lessonId,
              completedAt: new Date(p.completedAt),
            })),
          });
        }
        for (const part of chunks(data.submissions)) {
          await tx.submission.createMany({
            data: part.map((s) => ({
              id: s.id,
              studentId: s.studentId,
              lessonId: s.lessonId,
              streamId: s.streamId,
              comment: s.comment,
              submittedAt: new Date(s.submittedAt),
              grade: s.grade,
              feedback: s.feedback,
              gradedAt: s.gradedAt === null ? null : new Date(s.gradedAt),
            })),
          });
        }

        // після вставки з явними id послідовності треба зсунути, інакше наступний INSERT дасть дубль
        for (const table of SEQUENCE_TABLES) {
          await tx.$queryRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
          );
        }
      },
      // сид великий: стандартних 5 секунд інтерактивної транзакції не вистачить
      { timeout: 120_000, maxWait: 10_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск із командного рядка: `npm run db:seed`. `prisma migrate reset` викликає цей файл сам.
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('DATABASE_URL не задано\n');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('Сид заборонено в production\n');
    process.exit(1);
  }
  bcrypt
    .hash(DEMO_PASSWORD, 10)
    .then((hash) => writeSeed(url, buildSeed(hash)))
    .then(() => {
      process.stdout.write(`[seed] done. Демо-пароль для всіх акаунтів: ${DEMO_PASSWORD}\n`);
    })
    .catch((err: unknown) => {
      process.stderr.write(`[seed] ${(err as Error).message}\n`);
      process.exit(1);
    });
}
