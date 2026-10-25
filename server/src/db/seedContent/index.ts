import { CPP_LESSONS } from './cppLessons.js';
import { PYTHON_LESSONS, type RealLesson } from './pythonLessons.js';

export interface RealCourse {
  title: string;
  description: string;
  lessons: RealLesson[];
  homeworkPositions: number[];
  streams: { startsInDays: number; lengthDays: number }[];
}

export type RealCourseKey = 'python' | 'cpp';

export const REAL_COURSES: Record<RealCourseKey, RealCourse> = {
  python: {
    title: 'Python для аналізу даних',
    description:
      'Курс для тих, хто втомився від ручних звітів в Excel. Читаємо CSV, фільтруємо, групуємо, малюємо графіки й збираємо все в один скрипт, який можна запускати щомісяця не передумуючи.',
    lessons: PYTHON_LESSONS,
    homeworkPositions: [2, 3],
    streams: [
      { startsInDays: 10, lengthDays: 90 },
      { startsInDays: 40, lengthDays: 90 },
    ],
  },
  cpp: {
    title: 'C++ на живому проєкті: SAMSKRTA',
    description:
      'Курс із 20 уроків на основі книги «C++ на живому проєкті». Будуємо SAMSKRTA, настільний тренажер санскриту, з нуля, урок за уроком: від першого коду й Qt-вікна до розумних вказівників, SIMD, асемблера та роботи з AI-кодогенерацією.',
    lessons: CPP_LESSONS,
    homeworkPositions: [],
    streams: [
      { startsInDays: 14, lengthDays: 120 },
      { startsInDays: 45, lengthDays: 120 },
    ],
  },
};
