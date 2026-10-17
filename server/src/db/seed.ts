import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
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

const { Client } = pg;

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

// ---------- запис у базу ----------

interface Column {
  name: string;
  type: string;
}

async function insertRows(
  client: pg.Client,
  table: string,
  columns: Column[],
  rows: unknown[][],
  overridingIds: boolean,
): Promise<void> {
  if (rows.length === 0) return;
  const params = columns.map((_, c) => rows.map((r) => r[c]));
  const unnest = columns.map((c, i) => `$${i + 1}::${c.type}[]`).join(', ');
  const names = columns.map((c) => c.name).join(', ');
  const override = overridingIds ? ' OVERRIDING SYSTEM VALUE' : '';
  await client.query(
    `INSERT INTO ${table} (${names})${override} SELECT * FROM unnest(${unnest})`,
    params,
  );
}

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

/** Очищає таблиці й записує сид однією транзакцією: або все, або нічого. */
export async function writeSeed(connectionString: string, data: SeedData): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE submissions, lesson_progress, enrollments, streams, materials, lessons,
                course_topics, courses, topics, users RESTART IDENTITY CASCADE`,
    );

    await insertRows(
      client,
      'topics',
      [
        { name: 'id', type: 'int' },
        { name: 'name', type: 'text' },
      ],
      data.topics.map((t) => [t.id, t.name]),
      true,
    );

    await insertRows(
      client,
      'users',
      [
        { name: 'id', type: 'int' },
        { name: 'email', type: 'text' },
        { name: 'password_hash', type: 'text' },
        { name: 'name', type: 'text' },
        { name: 'role', type: 'user_role' },
        { name: 'bio', type: 'text' },
      ],
      data.users.map((u) => [u.id, u.email, u.passwordHash, u.name, u.role, u.bio]),
      true,
    );

    await insertRows(
      client,
      'courses',
      [
        { name: 'id', type: 'int' },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'language', type: 'text' },
        { name: 'level', type: 'course_level' },
        { name: 'teacher_id', type: 'int' },
        { name: 'status', type: 'course_status' },
        { name: 'sequential_lessons', type: 'boolean' },
      ],
      data.courses.map((c) => [
        c.id,
        c.title,
        c.description,
        c.language,
        c.level,
        c.teacherId,
        c.status,
        c.sequential,
      ]),
      true,
    );

    await insertRows(
      client,
      'course_topics',
      [
        { name: 'course_id', type: 'int' },
        { name: 'topic_id', type: 'int' },
      ],
      data.courseTopics.map((x) => [x.courseId, x.topicId]),
      false,
    );

    await insertRows(
      client,
      'lessons',
      [
        { name: 'id', type: 'int' },
        { name: 'course_id', type: 'int' },
        { name: 'position', type: 'int' },
        { name: 'title', type: 'text' },
        { name: 'content', type: 'text' },
        { name: 'is_free_intro', type: 'boolean' },
        { name: 'has_homework', type: 'boolean' },
      ],
      data.lessons.map((l) => [
        l.id,
        l.courseId,
        l.position,
        l.title,
        l.content,
        l.freeIntro,
        l.homework,
      ]),
      true,
    );

    await insertRows(
      client,
      'materials',
      [
        { name: 'id', type: 'int' },
        { name: 'lesson_id', type: 'int' },
        { name: 'title', type: 'text' },
        { name: 'kind', type: 'material_kind' },
        { name: 'url', type: 'text' },
      ],
      data.materials.map((m) => [m.id, m.lessonId, m.title, m.kind, m.url]),
      true,
    );

    await insertRows(
      client,
      'streams',
      [
        { name: 'id', type: 'int' },
        { name: 'course_id', type: 'int' },
        { name: 'title', type: 'text' },
        { name: 'starts_on', type: 'date' },
        { name: 'ends_on', type: 'date' },
        { name: 'capacity', type: 'int' },
      ],
      data.streams.map((s) => [s.id, s.courseId, s.title, s.startsOn, s.endsOn, s.capacity]),
      true,
    );

    await insertRows(
      client,
      'enrollments',
      [
        { name: 'id', type: 'int' },
        { name: 'student_id', type: 'int' },
        { name: 'stream_id', type: 'int' },
        { name: 'course_id', type: 'int' },
        { name: 'status', type: 'enrollment_status' },
        { name: 'enrolled_at', type: 'timestamptz' },
      ],
      data.enrollments.map((e) => [
        e.id,
        e.studentId,
        e.streamId,
        e.courseId,
        e.status,
        e.enrolledAt,
      ]),
      true,
    );

    await insertRows(
      client,
      'lesson_progress',
      [
        { name: 'student_id', type: 'int' },
        { name: 'lesson_id', type: 'int' },
        { name: 'completed_at', type: 'timestamptz' },
      ],
      data.progress.map((p) => [p.studentId, p.lessonId, p.completedAt]),
      false,
    );

    await insertRows(
      client,
      'submissions',
      [
        { name: 'id', type: 'int' },
        { name: 'student_id', type: 'int' },
        { name: 'lesson_id', type: 'int' },
        { name: 'stream_id', type: 'int' },
        { name: 'comment', type: 'text' },
        { name: 'submitted_at', type: 'timestamptz' },
        { name: 'grade', type: 'smallint' },
        { name: 'feedback', type: 'text' },
        { name: 'graded_at', type: 'timestamptz' },
      ],
      data.submissions.map((s) => [
        s.id,
        s.studentId,
        s.lessonId,
        s.streamId,
        s.comment,
        s.submittedAt,
        s.grade,
        s.feedback,
        s.gradedAt,
      ]),
      true,
    );

    // після вставки з явними id послідовності треба зсунути, інакше наступний INSERT дасть дубль
    for (const table of SEQUENCE_TABLES) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Запуск із командного рядка: `npm run db:seed` або `npm run db:reset`
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
