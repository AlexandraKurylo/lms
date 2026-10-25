import { Link, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FormError } from '../../components/FormError';
import { HomeworkForm } from '../../components/HomeworkForm';
import { LessonContent } from '../../components/LessonContent';
import { Loading } from '../../components/Loading';
import { MaterialList } from '../../components/MaterialList';
import { ProgressBar } from '../../components/ProgressBar';
import { useLesson, useSetLessonDone } from '../../features/learning/queries';
import { generalError } from '../../shared/lib/formErrors';
import { NotFoundPage } from '../NotFoundPage';
import styles from './StudentLessonPage.module.css';

export function StudentLessonPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: lesson, error, isPending } = useLesson(id);
  const setDone = useSetLessonDone(id);

  if (!valid) return <NotFoundPage />;
  if (isPending) return <Loading />;
  if (error) {
    return (
      <div className={styles.page}>
        <BackLink to="/my-enrollments">Мої записи</BackLink>
        <ErrorMessage error={error} notFoundText="Урок не знайдено" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <BackLink to={`/learn/${lesson.courseId}`}>{lesson.courseTitle}</BackLink>
      <ProgressBar percent={lesson.progress.percent} label="Прогрес курсу" />

      <article className={`glassPanel ${styles.article}`}>
        <span className={styles.position}>Урок {lesson.position}</span>
        <h1 className={`fontDisplay ${styles.title}`}>{lesson.title}</h1>
        <LessonContent>{lesson.content}</LessonContent>
        <MaterialList materials={lesson.materials} />
      </article>

      {lesson.hasHomework && (
        <HomeworkForm
          key={`${lesson.id}-${lesson.submission?.submittedAt ?? 'new'}`}
          lessonId={lesson.id}
          submission={lesson.submission}
        />
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={lesson.completed ? 'btnGhost' : 'btnSteel'}
          disabled={setDone.isPending}
          onClick={() => setDone.mutate(!lesson.completed)}
        >
          {lesson.completed ? 'Зняти позначку «пройдено»' : 'Позначити пройденим'}
        </button>
        <FormError message={generalError(setDone.error)} />
      </div>

      <nav className={styles.nav}>
        {lesson.previousLessonId !== null ? (
          <Link to={`/lessons/${lesson.previousLessonId}`} className="btnGhost">
            ← Попередній урок
          </Link>
        ) : (
          <span />
        )}
        {lesson.nextLessonId !== null && (
          <Link to={`/lessons/${lesson.nextLessonId}`} className="btnGhost">
            Наступний урок →
          </Link>
        )}
      </nav>
    </div>
  );
}
