import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses, useTopics, type CatalogFilters } from '../features/catalog/queries';
import type { CourseSummary, Level } from '../shared/api/types';
import { LEVEL_LABEL, plural } from '../shared/lib/format';
import { useDebouncedValue } from '../shared/lib/useDebouncedValue';
import { ErrorMessage, Loading } from '../shared/ui/StateMessage';
import styles from './CatalogPage.module.css';

function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <li>
      <Link to={`/courses/${course.id}`} className={`glassPanel ${styles.card}`}>
        <div className={styles.badges}>
          <span className="badge">{LEVEL_LABEL[course.level]}</span>
          {course.topics.map((t) => (
            <span key={t} className="badge">
              {t}
            </span>
          ))}
        </div>
        <h2 className={`fontDisplay ${styles.cardTitle}`}>{course.title}</h2>
        <p className={styles.cardText}>{course.description}</p>
        <div className={styles.cardFooter}>
          <span>{course.teacher?.name ?? 'Викладача не призначено'}</span>
          <span>
            {course.lessonCount} {plural(course.lessonCount, 'урок', 'уроки', 'уроків')}
          </span>
        </div>
      </Link>
    </li>
  );
}

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [topic, setTopic] = useState<number | null>(null);
  const q = useDebouncedValue(search.trim(), 300);

  const filters: CatalogFilters = { q, level, topic };
  const topics = useTopics();
  const courses = useCourses(filters);
  const items = courses.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className={styles.page}>
      <h1 className={`fontDisplay ${styles.title}`}>Каталог курсів</h1>

      <div className={`glassPanel ${styles.filters}`}>
        <input
          className="field"
          type="search"
          placeholder="Пошук за назвою або описом"
          aria-label="Пошук курсів"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="field"
          aria-label="Рівень"
          value={level}
          onChange={(e) => setLevel(e.target.value as Level | '')}
        >
          <option value="">Усі рівні</option>
          {Object.entries(LEVEL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="field"
          aria-label="Тема"
          value={topic ?? ''}
          onChange={(e) => setTopic(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Усі теми</option>
          {topics.data?.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {courses.isPending && <Loading />}
      {courses.error && <ErrorMessage error={courses.error} />}
      {courses.isSuccess && items.length === 0 && (
        <p className={styles.empty}>За цими умовами курсів не знайдено.</p>
      )}

      {items.length > 0 && (
        <ul className={styles.grid}>
          {items.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </ul>
      )}

      {courses.hasNextPage && (
        <button
          type="button"
          className={`btnGhost ${styles.more}`}
          disabled={courses.isFetchingNextPage}
          onClick={() => void courses.fetchNextPage()}
        >
          {courses.isFetchingNextPage ? 'Завантаження…' : 'Показати ще'}
        </button>
      )}
    </div>
  );
}
