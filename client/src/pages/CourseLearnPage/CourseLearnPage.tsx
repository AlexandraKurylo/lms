import { Link, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LearnLessonList } from '../../components/LearnLessonList';
import { Loading } from '../../components/Loading';
import { ProgressBar } from '../../components/ProgressBar';
import { useCourseProgress } from '../../features/learning/queries';
import { NotFoundPage } from '../NotFoundPage';
import styles from './CourseLearnPage.module.css';

export function CourseLearnPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { data, error, isPending } = useCourseProgress(id);

  if (!valid) return <NotFoundPage />;
  if (isPending) return <Loading />;
  if (error) {
    return (
      <div className={styles.page}>
        <BackLink to="/my-enrollments">Мої записи</BackLink>
        <ErrorMessage error={error} notFoundText="Курс не знайдено" />
      </div>
    );
  }

  const next = data.lessons.find((l) => !l.completed && !l.locked);

  return (
    <div className={styles.page}>
      <BackLink to="/my-enrollments">Мої записи</BackLink>
      <header className={styles.header}>
        <h1 className={`fontDisplay ${styles.title}`}>{data.title}</h1>
        <ProgressBar percent={data.progress.percent} label="Прогрес курсу" />
        <p className={styles.note}>
          Пройдено {data.progress.completed} з {data.progress.total}
          {data.sequentialLessons && ', уроки відкриваються по черзі'}
        </p>
        {next && (
          <Link to={`/lessons/${next.id}`} className="btnSteel">
            {data.progress.completed === 0 ? 'Почати навчання' : 'Продовжити'}
          </Link>
        )}
      </header>
      <LearnLessonList lessons={data.lessons} />
    </div>
  );
}
