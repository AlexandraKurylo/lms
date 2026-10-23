import type { Material } from '../../shared/api/types';
import styles from './MaterialList.module.css';

export function MaterialList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return null;
  return (
    <section>
      <h2 className={`fontDisplay ${styles.title}`}>Матеріали</h2>
      <ul className={styles.list}>
        {materials.map((m) => (
          <li key={m.id}>
            <a href={m.url} target="_blank" rel="noreferrer" className={styles.link}>
              {m.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
