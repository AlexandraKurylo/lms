import styles from './TeacherCard.module.css';

export function TeacherCard({ name, bio }: { name: string; bio: string | null }) {
  return (
    <div className={`glassPanel ${styles.card}`}>
      <span className={styles.label}>Викладач</span>
      <strong>{name}</strong>
      {bio && <p className={styles.bio}>{bio}</p>}
    </div>
  );
}
