import { useSetCourseStatus } from '../../features/teacher/queries';
import type { CourseStatus } from '../../shared/api/types';
import { generalError } from '../../shared/lib/formErrors';
import { FormError } from '../FormError';
import styles from './PublishControl.module.css';

export function PublishControl({ courseId, status }: { courseId: number; status: CourseStatus }) {
  const setStatus = useSetCourseStatus(courseId);
  const next: CourseStatus = status === 'published' ? 'draft' : 'published';

  return (
    <div className={styles.box}>
      <button
        type="button"
        className={status === 'published' ? 'btnGhost' : 'btnSteel'}
        disabled={setStatus.isPending}
        onClick={() => setStatus.mutate(next)}
      >
        {status === 'published' ? 'Зняти з публікації' : 'Опублікувати'}
      </button>
      <FormError message={generalError(setStatus.error)} />
    </div>
  );
}
