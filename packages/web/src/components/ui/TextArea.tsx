import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './TextArea.module.css';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  footer?: ReactNode;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, footer, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const hintId = hint ? `${textareaId}-hint` : undefined;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={textareaId}>
          {label}
        </label>
      )}
      {hint && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={clsx(styles.textarea, error && styles.textareaError, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        {...props}
      />
      {footer && <div className={styles.footer}>{footer}</div>}
      {error && (
        <span className={styles.errorText} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
});
