import { Link } from 'react-router-dom';
import { EnrollmentCard } from '../../components/EnrollmentCard';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { useMyEnrollments } from '../../features/enrollments/queries';
import styles from './MyEnrollmentsPage.module.css';

export function MyEnrollmentsPage() {
  const { data, error, isPending } = useMyEnrollments();

  return (
    <div className={styles.page}>
      <h1 className={`fontDisplay ${styles.title}`}>Мої записи</h1>

      {isPending && <Loading />}
      {error && <ErrorMessage error={error} />}
      {data && data.items.length === 0 && (
        <div className={styles.empty}>
          <p>Ви ще не записані на жоден потік.</p>
          <Link to="/courses" className="btnSteel">
            Обрати курс
          </Link>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className={styles.list}>
          {data.items.map((e) => (
            <li key={e.id}>
              <EnrollmentCard enrollment={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
