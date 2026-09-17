import clsx from 'clsx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  label: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span className={clsx(styles.spinner, styles[size], className)} role="img" aria-label={label}>
      <span className={styles.visuallyHidden}>{label}</span>
    </span>
  );
}
