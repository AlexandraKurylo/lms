import { Link, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LessonList } from '../../components/LessonList';
import { Loading } from '../../components/Loading';
import { StreamCard } from '../../components/StreamCard';
import { TeacherCard } from '../../components/TeacherCard';
import { useCourse } from '../../features/catalog/queries';
import { LEVEL_LABEL } from '../../shared/lib/format';
import { NotFoundPage } from '../NotFoundPage';
import styles from './CoursePage.module.css';

export function CoursePage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: course, error, isPending } = useCourse(id);

  if (!valid) return <NotFoundPage />;
  if (isPending) return <Loading />;
  if (error) return <ErrorMessage error={error} notFoundText="Курс не знайдено" />;

  const hasIntro = course.lessons.some((l) => l.isFreeIntro);

  return (
    <div className={styles.page}>
      <BackLink to="/courses">Усі курси</BackLink>

      <header className={styles.header}>
        <div className={styles.badges}>
          <span className="badge">{LEVEL_LABEL[course.level]}</span>
          {course.topics.map((t) => (
            <span key={t.id} className="badge">
              {t.name}
            </span>
          ))}
        </div>
        <h1 className={`fontDisplay ${styles.title}`}>{course.title}</h1>
        <p className={styles.lead}>{course.description}</p>
        {hasIntro && (
          <Link to={`/courses/${course.id}/intro`} className="btnSteel">
            Безкоштовний вступний урок
          </Link>
        )}
      </header>

      <div className={styles.columns}>
        <section className={styles.section}>
          <h2 className={`fontDisplay ${styles.h2}`}>Програма</h2>
          <LessonList lessons={course.lessons} sequential={course.sequentialLessons} />
        </section>

        <aside className={styles.section}>
          <h2 className={`fontDisplay ${styles.h2}`}>Потоки</h2>
          {course.streams.length === 0 ? (
            <p className={styles.muted}>Потоків поки немає.</p>
          ) : (
            <ul className={styles.streams}>
              {course.streams.map((s) => (
                <li key={s.id}>
                  <StreamCard stream={s} />
                </li>
              ))}
            </ul>
          )}
          {course.teacher && <TeacherCard name={course.teacher.name} bio={course.teacher.bio} />}
        </aside>
      </div>
    </div>
  );
}
