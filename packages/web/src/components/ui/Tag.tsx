import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

export interface TagProps {
  tone?: TagTone;
  className?: string;
  children?: ReactNode;
}

export function Tag({ tone = 'neutral', className, children }: TagProps) {
  return <span className={clsx(styles.tag, styles[tone], className)}>{children}</span>;
}
