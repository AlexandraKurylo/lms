import { Link, useParams } from 'react-router-dom';
import { AssignTeacher } from '../../components/AssignTeacher';
import { BackLink } from '../../components/BackLink';
import { CourseForm } from '../../components/CourseForm';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LessonForm } from '../../components/LessonForm';
import { LessonList } from '../../components/LessonList';
import { Loading } from '../../components/Loading';
import { PublishControl } from '../../components/PublishControl';
import { StreamForm } from '../../components/StreamForm';
import { TeacherStreamCard } from '../../components/TeacherStreamCard';
import { useAuth } from '../../features/auth/useAuth';
import { useCourse } from '../../features/catalog/queries';
import {
  useAddLesson,
  useCreateStream,
  useOwnCourse,
  useOwnStreams,
  useUpdateCourse,
} from '../../features/teacher/queries';
import { COURSE_STATUS_LABEL } from '../../shared/lib/format';
import { NotFoundPage } from '../NotFoundPage';
import styles from './TeacherCoursePage.module.css';

export function TeacherCoursePage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { user } = useAuth();
  const own = useOwnCourse(id);
  const outline = useCourse(id);
  const streams = useOwnStreams(id);
  const update = useUpdateCourse(id);
  const addLesson = useAddLesson(id);
  const createStream = useCreateStream(id);

  if (!valid) return <NotFoundPage />;
  if (own.isPending) return <Loading />;
  if (own.error) return <ErrorMessage error={own.error} notFoundText="Курс не знайдено" />;

  const course = own.data;

  return (
    <div className={styles.page}>
      <BackLink to="/teacher">Мої курси</BackLink>

      <header className={styles.header}>
        <div className={styles.titleBox}>
          <span className="badge">{COURSE_STATUS_LABEL[course.status]}</span>
          <h1 className={`fontDisplay ${styles.title}`}>{course.title}</h1>
          <Link to={`/courses/${course.id}`} className={styles.preview}>
            Переглянути як студент
          </Link>
        </div>
        {user?.role === 'admin' ? (
          <div className={styles.adminTools}>
            <PublishControl courseId={course.id} status={course.status} />
            <AssignTeacher courseId={course.id} teacherId={course.teacherId} />
          </div>
        ) : (
          course.status === 'draft' && (
            <p className={styles.note}>Курс опублікує адміністратор, коли в ньому будуть уроки.</p>
          )
        )}
      </header>

      <section className={`glassPanel ${styles.panel}`}>
        <h2 className={`fontDisplay ${styles.h2}`}>Про курс</h2>
        <CourseForm
          key={course.updatedAt}
          initial={{
            title: course.title,
            description: course.description,
            language: course.language,
            level: course.level,
            sequentialLessons: course.sequentialLessons,
          }}
          submitLabel="Зберегти"
          pending={update.isPending}
          error={update.error}
          onSubmit={(values) => update.mutate(values)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={`fontDisplay ${styles.h2}`}>Уроки</h2>
        {outline.data && outline.data.lessons.length > 0 && (
          <LessonList
            lessons={outline.data.lessons}
            sequential={course.sequentialLessons}
            lessonHref={(lessonId) => `/teacher/lessons/${lessonId}`}
          />
        )}
        <div className={`glassPanel ${styles.panel}`}>
          <LessonForm
            pending={addLesson.isPending}
            error={addLesson.error}
            onSubmit={(values, reset) => addLesson.mutate(values, { onSuccess: reset })}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={`fontDisplay ${styles.h2}`}>Потоки</h2>
        {streams.isPending && <Loading />}
        {streams.error && <ErrorMessage error={streams.error} />}
        {streams.data && streams.data.items.length > 0 && (
          <ul className={styles.streams}>
            {streams.data.items.map((s) => (
              <li key={s.id}>
                <TeacherStreamCard stream={s} />
              </li>
            ))}
          </ul>
        )}
        <div className={`glassPanel ${styles.panel}`}>
          <h3 className={styles.h3}>Новий потік</h3>
          <StreamForm
            submitLabel="Додати потік"
            pending={createStream.isPending}
            error={createStream.error}
            onSubmit={(values, reset) => createStream.mutate(values, { onSuccess: reset })}
          />
        </div>
      </section>
    </div>
  );
}
