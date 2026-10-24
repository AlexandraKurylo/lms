import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CourseForm } from '../../components/CourseForm';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { TeacherCourseCard } from '../../components/TeacherCourseCard';
import { useCreateCourse, useOwnCourses } from '../../features/teacher/queries';
import styles from './TeacherCoursesPage.module.css';

export function TeacherCoursesPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, error, isPending } = useOwnCourses();
  const create = useCreateCourse();

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={`fontDisplay ${styles.title}`}>Кабінет викладача</h1>
        {!creating && (
          <button type="button" className="btnSteel" onClick={() => setCreating(true)}>
            Створити курс
          </button>
        )}
      </div>

      {creating && (
        <section className={`glassPanel ${styles.panel}`}>
          <h2 className={`fontDisplay ${styles.h2}`}>Новий курс</h2>
          <CourseForm
            submitLabel="Створити курс"
            pending={create.isPending}
            error={create.error}
            onSubmit={(values) =>
              create.mutate(values, {
                onSuccess: (course) => navigate(`/teacher/courses/${course.id}`),
              })
            }
          />
        </section>
      )}

      {isPending && <Loading />}
      {error && <ErrorMessage error={error} />}
      {data && data.items.length === 0 && !creating && (
        <p className={styles.empty}>У вас ще немає курсів.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className={styles.grid}>
          {data.items.map((c) => (
            <li key={c.id}>
              <TeacherCourseCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
