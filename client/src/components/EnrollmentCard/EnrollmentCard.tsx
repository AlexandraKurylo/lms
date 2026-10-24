import { Link } from 'react-router-dom';
import { useCancelEnrollment } from '../../features/enrollments/queries';
import { ApiError } from '../../shared/api/client';
import type { MyEnrollment } from '../../shared/api/types';
import { ENROLLMENT_STATUS_LABEL, formatDate } from '../../shared/lib/format';
import styles from './EnrollmentCard.module.css';

export function EnrollmentCard({ enrollment }: { enrollment: MyEnrollment }) {
  const cancel = useCancelEnrollment();
  const { course, stream } = enrollment;

  return (
    <div className={`glassPanel ${styles.card}`}>
      <div className={styles.main}>
        <Link to={`/courses/${course.id}`} className={`fontDisplay ${styles.title}`}>
          {course.title}
        </Link>
        <span className={styles.muted}>
          {stream.title}: {formatDate(stream.startsOn)} — {formatDate(stream.endsOn)}
        </span>
      </div>
      <div className={styles.side}>
        <span className="badge">{ENROLLMENT_STATUS_LABEL[enrollment.status]}</span>
        {enrollment.status === 'active' && (
          <button
            type="button"
            className="btnGhost btnSm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(enrollment.id)}
          >
            {cancel.isPending ? 'Скасовуємо…' : 'Скасувати запис'}
          </button>
        )}
      </div>
      {cancel.error && (
        <p className={styles.error} role="alert">
          {cancel.error instanceof ApiError ? cancel.error.message : 'Не вдалося скасувати запис'}
        </p>
      )}
    </div>
  );
}
