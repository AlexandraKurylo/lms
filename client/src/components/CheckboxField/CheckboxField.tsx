import type { ChangeEventHandler } from 'react';
import styles from './CheckboxField.module.css';

interface CheckboxFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export function CheckboxField({ label, name, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className={styles.box}>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
