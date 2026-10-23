import { Link, useParams } from 'react-router-dom';
import { useCourse } from '../features/catalog/queries';
import type { StreamInfo } from '../shared/api/types';
import { formatDate, LEVEL_LABEL, PHASE_LABEL, plural, seatsText } from '../shared/lib/format';
import { ErrorMessage, Loading } from '../shared/ui/StateMessage';
import { NotFoundPage } from './NotFoundPage';
import styles from './CoursePage.module.css';

function StreamRow({ stream }: { stream: StreamInfo }) {
  const full = stream.seatsLeft === 0;
  return (
    <li className={`glassPanel ${styles.stream}`}>
      <div className={styles.streamMain}>
        <strong>{stream.title}</strong>
        <span className={styles.muted}>
          {formatDate(stream.startsOn)} — {formatDate(stream.endsOn)}
        </span>
      </div>
      <div className={styles.streamSide}>
        <span className="badge">{PHASE_LABEL[stream.phase]}</span>
        <span className={full ? styles.full : styles.seats}>{seatsText(stream.seatsLeft)}</span>
        <span className={styles.muted}>
          {stream.seatsTaken} з {stream.capacity}
        </span>
      </div>
    </li>
  );
}

export function CoursePage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: course, error, isPending } = useCourse(id);

  if (!valid) return <NotFoundPage />;
  if (isPending) return <Loading />;
  if (error) return <ErrorMessage error={error} notFoundText="Курс не знайдено" />;

  const intro = course.lessons.find((l) => l.isFreeIntro);

  return (
    <div className={styles.page}>
      <Link to="/courses" className={styles.back}>
        ← Усі курси
      </Link>

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
        {intro && (
          <Link to={`/courses/${course.id}/intro`} className={`btnSteel ${styles.introButton}`}>
            Безкоштовний вступний урок
          </Link>
        )}
      </header>

      <div className={styles.columns}>
        <section className={styles.section}>
          <h2 className={`fontDisplay ${styles.h2}`}>Програма</h2>
          <ol className={`glassPanel ${styles.lessons}`}>
            {course.lessons.map((l) => (
              <li key={l.id} className={styles.lesson}>
                <span className={styles.position}>{l.position}</span>
                <span className={styles.lessonTitle}>{l.title}</span>
                {l.isFreeIntro && <span className="badge">Безкоштовно</span>}
                {l.hasHomework && <span className="badge">Домашня робота</span>}
              </li>
            ))}
          </ol>
          <p className={styles.muted}>
            {course.lessons.length} {plural(course.lessons.length, 'урок', 'уроки', 'уроків')}
            {course.sequentialLessons && ', уроки відкриваються по черзі'}
          </p>
        </section>

        <aside className={styles.section}>
          <h2 className={`fontDisplay ${styles.h2}`}>Потоки</h2>
          {course.streams.length === 0 ? (
            <p className={styles.muted}>Потоків поки немає.</p>
          ) : (
            <ul className={styles.streams}>
              {course.streams.map((s) => (
                <StreamRow key={s.id} stream={s} />
              ))}
            </ul>
          )}

          {course.teacher && (
            <div className={`glassPanel ${styles.teacher}`}>
              <span className={styles.muted}>Викладач</span>
              <strong>{course.teacher.name}</strong>
              {course.teacher.bio && <p className={styles.bio}>{course.teacher.bio}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
