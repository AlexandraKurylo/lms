import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './LessonContent.module.css';

export function LessonContent({ children }: { children: string }) {
  return (
    <div className={styles.content}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
