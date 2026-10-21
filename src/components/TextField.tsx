import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  helper?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export default function TextField({
  label,
  description,
  error,
  helper,
  leading,
  trailing,
  required,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? helper;
  const messageId = message ? `${inputId}-message` : undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      {description && <p className={styles.description}>{description}</p>}
      <div className={styles.inputGroup}>
        <div className={[styles.box, error ? styles.boxError : ''].filter(Boolean).join(' ')}>
          {leading}
          <input
            id={inputId}
            className={styles.input}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={messageId}
            {...inputProps}
          />
          {trailing}
        </div>
        {message && (
          <p id={messageId} className={error ? styles.error : styles.helper}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
