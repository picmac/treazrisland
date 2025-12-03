import type { InputHTMLAttributes, ReactNode } from 'react';

import styles from './FormField.module.css';

type FormFieldProps = {
  label: string;
  description?: string;
  hint?: string;
  error?: string | null;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  inputSlot?: ReactNode;
};

export function FormField({
  label,
  description,
  hint,
  error,
  inputProps,
  inputSlot,
}: FormFieldProps) {
  const fieldId = inputProps?.id ?? inputProps?.name ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = [
    description ? `${fieldId}-description` : null,
    hint ? `${fieldId}-hint` : null,
    error ? `${fieldId}-error` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={styles.field} htmlFor={fieldId}>
      <div className={styles.labelRow}>
        <span>{label}</span>
        {error ? <span className={styles.error}>{error}</span> : null}
      </div>
      {description ? (
        <p id={`${fieldId}-description`} className={styles.description}>
          {description}
        </p>
      ) : null}
      {inputSlot ?? (
        <input
          {...inputProps}
          id={fieldId}
          className={styles.input}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          aria-label={inputProps?.['aria-label'] ?? label}
        />
      )}
      {hint ? (
        <p id={`${fieldId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </label>
  );
}
