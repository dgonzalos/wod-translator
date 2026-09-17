import type { Issue, Load, Movement, Wod } from '@wod-translator/shared';
import { Card, StatusMessage } from '../ui';
import type { AppState } from '../../hooks/useWodTranslator';
import { WodMetaFields } from './WodMetaFields';
import { MovementList } from './MovementList';
import { ExplanationsList } from './ExplanationsList';
import { IssuesList } from './IssuesList';
import styles from './RevisionPanel.module.css';

type MetaFieldPatch = Partial<Pick<Wod, 'format' | 'durationSeconds' | 'rounds' | 'timeCapSeconds'>>;

const STATE_LABELS: Record<AppState, string> = {
  inicial: 'Pega o elige un WOD para empezar.',
  interpretando: 'Interpretando…',
  revision_necesaria: 'Revisión necesaria: hay dudas o campos inválidos pendientes.',
  listo: 'Listo. La ficha está revisada.',
  error: 'No se pudo interpretar el WOD.',
};

const STATE_TONES: Record<AppState, 'info' | 'warning' | 'error' | 'success'> = {
  inicial: 'info',
  interpretando: 'info',
  revision_necesaria: 'warning',
  listo: 'success',
  error: 'error',
};

export interface RevisionPanelProps {
  card: Wod | null;
  isStale: boolean;
  appState: AppState;
  errorMessage: string | null;
  fieldErrors: Record<string, string>;
  resolvedIssueKeys: Set<string>;
  onMetaFieldChange: (patch: MetaFieldPatch) => void;
  onMovementFieldChange: (movementId: string, patch: Partial<Pick<Movement, 'name' | 'quantity' | 'unit'>>) => void;
  onMovementLoadsChange: (movementId: string, loads: Load[] | null) => void;
  onToggleIssueResolved: (issue: Issue, index: number) => void;
}

export function RevisionPanel({
  card,
  isStale,
  appState,
  errorMessage,
  fieldErrors,
  resolvedIssueKeys,
  onMetaFieldChange,
  onMovementFieldChange,
  onMovementLoadsChange,
  onToggleIssueResolved,
}: RevisionPanelProps) {
  return (
    <Card as="section" className={styles.panel} aria-label="Revisión">
      <h2 className={styles.heading}>Revisión</h2>
      <StatusMessage tone={STATE_TONES[appState]}>
        {appState === 'error' && errorMessage ? errorMessage : STATE_LABELS[appState]}
      </StatusMessage>

      {isStale && (
        <StatusMessage tone="warning">
          El texto original cambió. Vuelve a pulsar “Interpretar” para actualizar la ficha.
        </StatusMessage>
      )}

      {!card && appState !== 'interpretando' && (
        <p className={styles.empty}>Todavía no hay ninguna ficha interpretada.</p>
      )}

      {card && (
        <div className={styles.cardBody} aria-disabled={isStale} data-disabled={isStale}>
          <WodMetaFields card={card} disabled={isStale} fieldErrors={fieldErrors} onMetaFieldChange={onMetaFieldChange} />
          {fieldErrors.movements && <StatusMessage tone="error">{fieldErrors.movements}</StatusMessage>}
          <MovementList
            movements={card.movements}
            disabled={isStale}
            fieldErrors={fieldErrors}
            onFieldChange={onMovementFieldChange}
            onLoadsChange={onMovementLoadsChange}
          />
          <ExplanationsList explanations={card.explanations} />
          <IssuesList
            issues={card.issues}
            resolvedIssueKeys={resolvedIssueKeys}
            onToggleIssueResolved={onToggleIssueResolved}
          />
        </div>
      )}
    </Card>
  );
}
