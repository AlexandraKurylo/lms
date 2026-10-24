import { useState } from 'react';
import { useUpdateStream } from '../../features/teacher/queries';
import type { OwnStream } from '../../shared/api/types';
import { formatDate } from '../../shared/lib/format';
import { StreamForm } from '../StreamForm';
import styles from './TeacherStreamCard.module.css';

export function TeacherStreamCard({ stream }: { stream: OwnStream }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateStream(stream.courseId, stream.id);

  if (editing) {
    return (
      <div className={`glassPanel ${styles.card}`}>
        <StreamForm
          initial={{
            title: stream.title,
            startsOn: stream.startsOn,
            endsOn: stream.endsOn,
            capacity: stream.capacity,
          }}
          submitLabel="Зберегти"
          pending={update.isPending}
          error={update.error}
          onSubmit={(values) => update.mutate(values, { onSuccess: () => setEditing(false) })}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`glassPanel ${styles.card} ${styles.view}`}>
      <div className={styles.main}>
        <strong>{stream.title}</strong>
        <span className={styles.muted}>
          {formatDate(stream.startsOn)} — {formatDate(stream.endsOn)}
        </span>
      </div>
      <div className={styles.side}>
        <span className="badge">
          Місць: {stream.seatsTaken} з {stream.capacity}
        </span>
        <button type="button" className="btnGhost btnSm" onClick={() => setEditing(true)}>
          Змінити
        </button>
      </div>
    </div>
  );
}
