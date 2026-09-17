import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './StatusMessage.module.css';

export type StatusTone = 'info' | 'warning' | 'error' | 'success';

export interface StatusMessageProps {
  tone?: StatusTone;
  className?: string;
  children?: ReactNode;
}

export function StatusMessage({ tone = 'info', className, children }: StatusMessageProps) {
  const isError = tone === 'error';
  return (
    <div
      className={clsx(styles.status, styles[tone], className)}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
