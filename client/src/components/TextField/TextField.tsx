import type { InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, name, ...input }: TextFieldProps) {
  const fieldId = id ?? name;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        className={error ? 'field fieldInvalid' : 'field'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...input}
      />
      {error && (
        <p id={`${fieldId}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
