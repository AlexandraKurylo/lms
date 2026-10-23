import type { FormEventHandler, ReactNode } from 'react';
import styles from './AuthForm.module.css';

interface AuthFormProps {
  error?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}

export function AuthForm({ error, onSubmit, children }: AuthFormProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {children}
    </form>
  );
}
