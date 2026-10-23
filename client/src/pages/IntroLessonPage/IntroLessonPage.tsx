import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { MaterialList } from '../../components/MaterialList';
import { useIntroLesson } from '../../features/catalog/queries';
import { NotFoundPage } from '../NotFoundPage';
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
      <BackLink to={`/courses/${id}`}>До курсу</BackLink>
      <article className={`glassPanel ${styles.article}`}>
        <h1 className={`fontDisplay ${styles.title}`}>{lesson.title}</h1>
        <div className={styles.content}>{lesson.content}</div>
        <MaterialList materials={lesson.materials} />
      </article>
    </div>
  );
}
