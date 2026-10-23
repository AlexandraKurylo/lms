import { Link, useParams } from 'react-router-dom';
import { useIntroLesson } from '../features/catalog/queries';
import { ErrorMessage, Loading } from '../shared/ui/StateMessage';
import { NotFoundPage } from './NotFoundPage';
import styles from './IntroLessonPage.module.css';

export function IntroLessonPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: lesson, error, isPending } = useIntroLesson(id);

  if (!valid) return <NotFoundPage />;
  if (isPending) return <Loading />;
  if (error) return <ErrorMessage error={error} notFoundText="Вступного уроку немає" />;

  return (
    <div className={styles.page}>
      <Link to={`/courses/${id}`} className={styles.back}>
        ← До курсу
      </Link>
      <article className={`glassPanel ${styles.article}`}>
        <h1 className={`fontDisplay ${styles.title}`}>{lesson.title}</h1>
        <div className={styles.content}>{lesson.content}</div>
        {lesson.materials.length > 0 && (
          <section className={styles.materials}>
            <h2 className={`fontDisplay ${styles.h2}`}>Матеріали</h2>
            <ul className={styles.list}>
              {lesson.materials.map((m) => (
                <li key={m.id}>
                  <a href={m.url} target="_blank" rel="noreferrer" className={styles.link}>
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
