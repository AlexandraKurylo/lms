import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LessonForm } from '../../components/LessonForm';
import { Loading } from '../../components/Loading';
import { useOwnLesson, useUpdateLesson } from '../../features/teacher/queries';
import { NotFoundPage } from '../NotFoundPage';
import styles from './TeacherLessonPage.module.css';

export function TeacherLessonPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const lesson = useOwnLesson(id);
  const update = useUpdateLesson(id, lesson.data?.courseId ?? 0);

  if (!valid) return <NotFoundPage />;
  if (lesson.isPending) return <Loading />;
  if (lesson.error) return <ErrorMessage error={lesson.error} notFoundText="Урок не знайдено" />;

  const data = lesson.data;

  return (
    <div className={styles.page}>
      <BackLink to={`/teacher/courses/${data.courseId}`}>{data.courseTitle}</BackLink>
      <h1 className={`fontDisplay ${styles.title}`}>Урок {data.position}</h1>
      <section className={`glassPanel ${styles.panel}`}>
        {update.isSuccess && (
          <p className={styles.saved} role="status">
            Зміни збережено
          </p>
        )}
        <LessonForm
          key={`${data.id}-${data.title}-${data.content}-${data.isFreeIntro}-${data.hasHomework}`}
          initial={{
            title: data.title,
            content: data.content,
            isFreeIntro: data.isFreeIntro,
            hasHomework: data.hasHomework,
          }}
          submitLabel="Зберегти"
          pendingLabel="Зберігаємо…"
          pending={update.isPending}
          error={update.error}
          onSubmit={(values) => update.mutate(values)}
        />
      </section>
    </div>
  );
}
