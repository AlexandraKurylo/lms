import styles from './FeatureCard.module.css';

interface FeatureCardProps {
  title: string;
  text: string;
}

export function FeatureCard({ title, text }: FeatureCardProps) {
  return (
    <article className={`glassPanel ${styles.card}`}>
      <h3 className={`fontDisplay ${styles.title}`}>{title}</h3>
      <p className={styles.text}>{text}</p>
    </article>
  );
}
