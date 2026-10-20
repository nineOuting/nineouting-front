import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode;
  tone?: 'default' | 'muted';
  className?: string;
}

export default function Checkbox({ children, tone = 'default', className, ...inputProps }: CheckboxProps) {
  return (
    <label className={[styles.checkbox, styles[tone], className].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.input} {...inputProps} />
      <span className={styles.box} aria-hidden="true" />
      {children}
    </label>
  );
}
