import type { ReactNode } from 'react';
import type { StreamInfo } from '../../shared/api/types';
import { formatDate, PHASE_LABEL, seatsText } from '../../shared/lib/format';
import styles from './StreamCard.module.css';

export function StreamCard({ stream, children }: { stream: StreamInfo; children?: ReactNode }) {
  const full = stream.seatsLeft === 0;
  return (
    <div className={`glassPanel ${styles.card}`}>
      <div className={styles.main}>
        <strong>{stream.title}</strong>
        <span className={styles.muted}>
          {formatDate(stream.startsOn)} — {formatDate(stream.endsOn)}
        </span>
      </div>
      <div className={styles.side}>
        <span className="badge">{PHASE_LABEL[stream.phase]}</span>
        <span className={full ? styles.full : styles.seats}>{seatsText(stream.seatsLeft)}</span>
        <span className={styles.muted}>
          {stream.seatsTaken} з {stream.capacity}
        </span>
      </div>
      {children}
    </div>
  );
}
