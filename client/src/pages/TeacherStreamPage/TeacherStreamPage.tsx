import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { StreamStudentList } from '../../components/StreamStudentList';
import { SubmissionCard } from '../../components/SubmissionCard';
import {
  useOwnStream,
  useStreamStudents,
  useStreamSubmissions,
} from '../../features/teacher/queries';
import type { SubmissionFilter } from '../../shared/api/types';
import { formatDate } from '../../shared/lib/format';
import { NotFoundPage } from '../NotFoundPage';
import styles from './TeacherStreamPage.module.css';

type Tab = 'students' | 'submissions';

const FILTERS: { value: SubmissionFilter; label: string }[] = [
  { value: 'pending', label: 'Не перевірені' },
  { value: 'graded', label: 'Оцінені' },
  { value: 'all', label: 'Усі' },
];

function Submissions({ streamId }: { streamId: number }) {
  const [filter, setFilter] = useState<SubmissionFilter>('pending');
  const list = useStreamSubmissions(streamId, filter);

  return (
    <div className={styles.section}>
      <div className={styles.filters} role="group" aria-label="Фільтр робіт">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? 'btnSteel btnSm' : 'btnGhost btnSm'}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.isPending && <Loading />}
      {list.error && <ErrorMessage error={list.error} />}
      {list.data && list.data.items.length === 0 && <p className={styles.empty}>Робіт немає.</p>}
      {list.data?.items.map((s) => (
        <SubmissionCard key={s.id} streamId={streamId} submission={s} />
      ))}
    </div>
  );
}

export function TeacherStreamPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const [tab, setTab] = useState<Tab>('students');
  const stream = useOwnStream(id);
  const students = useStreamStudents(id);

  if (!valid) return <NotFoundPage />;
  if (stream.isPending) return <Loading />;
  if (stream.error) return <ErrorMessage error={stream.error} notFoundText="Потік не знайдено" />;

  const data = stream.data;

  return (
    <div className={styles.page}>
      <BackLink to={`/teacher/courses/${data.courseId}`}>До курсу</BackLink>
      <header className={styles.header}>
        <h1 className={`fontDisplay ${styles.title}`}>{data.title}</h1>
        <p className={styles.muted}>
          {formatDate(data.startsOn)} — {formatDate(data.endsOn)}. Місць: {data.seatsTaken} з{' '}
          {data.capacity}
        </p>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'students'}
          className={tab === 'students' ? 'btnSteel btnSm' : 'btnGhost btnSm'}
          onClick={() => setTab('students')}
        >
          Студенти
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'submissions'}
          className={tab === 'submissions' ? 'btnSteel btnSm' : 'btnGhost btnSm'}
          onClick={() => setTab('submissions')}
        >
          Домашні роботи
        </button>
      </div>

      {tab === 'students' ? (
        <>
          {students.isPending && <Loading />}
          {students.error && <ErrorMessage error={students.error} />}
          {students.data && <StreamStudentList students={students.data.items} />}
        </>
      ) : (
        <Submissions streamId={id} />
      )}
    </div>
  );
}
