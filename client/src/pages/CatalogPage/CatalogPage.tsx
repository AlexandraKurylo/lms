import { useState } from 'react';
import { CatalogFilters } from '../../components/CatalogFilters';
import { CourseCard } from '../../components/CourseCard';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import {
  useCourses,
  useTopics,
  type CatalogFilters as Filters,
} from '../../features/catalog/queries';
import type { Level } from '../../shared/api/types';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import styles from './CatalogPage.module.css';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [topic, setTopic] = useState<number | null>(null);
  const q = useDebouncedValue(search.trim(), 300);

  const filters: Filters = { q, level, topic };
  const topics = useTopics();
  const courses = useCourses(filters);
  const items = courses.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className={styles.page}>
      <h1 className={`fontDisplay ${styles.title}`}>Каталог курсів</h1>

      <CatalogFilters
        search={search}
        level={level}
        topic={topic}
        topics={topics.data?.items ?? []}
        onSearchChange={setSearch}
        onLevelChange={setLevel}
        onTopicChange={setTopic}
      />

      {courses.isPending && <Loading />}
      {courses.error && <ErrorMessage error={courses.error} />}
      {courses.isSuccess && items.length === 0 && (
        <p className={styles.empty}>За цими умовами курсів не знайдено.</p>
      )}

      {items.length > 0 && (
        <ul className={styles.grid}>
          {items.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} />
            </li>
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
