import type { TextareaHTMLAttributes } from 'react';
import styles from './TextAreaField.module.css';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function TextAreaField({ label, error, id, name, ...input }: TextAreaFieldProps) {
  const fieldId = id ?? name;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={fieldId}
        name={name}
        className={error ? 'field fieldInvalid' : 'field'}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
