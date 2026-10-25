import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import {
  useCancelEnrollment,
  useEnroll,
  useMyEnrollments,
} from '../../features/enrollments/queries';
import { ApiError } from '../../shared/api/client';
import type { StreamInfo } from '../../shared/api/types';
import { hasStarted } from '../../shared/lib/format';
import styles from './EnrollButton.module.css';

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : error ? 'Не вдалося виконати дію' : '';
}

export function EnrollButton({ stream, courseId }: { stream: StreamInfo; courseId: number }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const mine = useMyEnrollments(isStudent);
  const enroll = useEnroll(courseId);
  const cancel = useCancelEnrollment(courseId);

  if (!user) {
    return (
      <Link to="/login" state={{ from: `/courses/${courseId}` }} className="btnGhost">
        Увійдіть, щоб записатися
      </Link>
    );
  }
  if (!isStudent) return null;

  const own = mine.data?.items.find((e) => e.courseId === courseId && e.status !== 'cancelled');
  const message = errorText(enroll.error ?? cancel.error);

  if (own && own.streamId === stream.id) {
    return (
      <div className={styles.box}>
        <span className="badge">Ви записані</span>
        {hasStarted(stream.startsOn) && (
          <Link to={`/learn/${courseId}`} className="btnSteel btnSm">
            Перейти до навчання
          </Link>
        )}
        {own.status === 'active' && (
          <button
            type="button"
            className="btnGhost btnSm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(own.id)}
          >
            {cancel.isPending ? 'Скасовуємо…' : 'Скасувати запис'}
          </button>
        )}
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
      </div>
    );
  }

  if (own) return <p className={styles.note}>Ви вже записані на інший потік цього курсу</p>;
  if (stream.phase === 'finished') return null;

  const full = stream.seatsLeft === 0;
  return (
    <div className={styles.box}>
      <button
        type="button"
        className="btnSteel"
        disabled={full || enroll.isPending || mine.isPending}
        onClick={() => enroll.mutate(stream.id)}
      >
        {enroll.isPending ? 'Записуємо…' : full ? 'Місць немає' : 'Записатися'}
      </button>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
