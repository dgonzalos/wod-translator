import type { Explanation } from '@wod-translator/shared';
import { Tag } from '../ui';
import styles from './ExplanationsList.module.css';

export interface ExplanationsListProps {
  explanations: Explanation[];
}

export function ExplanationsList({ explanations }: ExplanationsListProps) {
  if (explanations.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Abreviaturas">
      <h3 className={styles.heading}>Abreviaturas</h3>
      <ul className={styles.list}>
        {explanations.map((explanation) => (
          <li key={explanation.abbreviation} className={styles.item}>
            <Tag tone="neutral">{explanation.abbreviation}</Tag>
            <span>{explanation.definition}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
