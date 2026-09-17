import type { Issue } from '@wod-translator/shared';
import { Tag } from '../ui';
import { issueKey } from '../../utils/fieldPath';
import styles from './IssuesList.module.css';

export interface IssuesListProps {
  issues: Issue[];
  resolvedIssueKeys: Set<string>;
  onToggleIssueResolved: (issue: Issue, index: number) => void;
}

export function IssuesList({ issues, resolvedIssueKeys, onToggleIssueResolved }: IssuesListProps) {
  if (issues.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Dudas pendientes">
      <h3 className={styles.heading}>
        Dudas pendientes <Tag tone="warning">{issues.length}</Tag>
      </h3>
      <ul className={styles.list}>
        {issues.map((issue, index) => {
          const key = issueKey(issue, index);
          const resolved = resolvedIssueKeys.has(key);
          return (
            <li key={key} className={styles.item}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={resolved}
                  onChange={() => onToggleIssueResolved(issue, index)}
                />
                <span className={resolved ? styles.resolvedText : undefined}>{issue.message}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
