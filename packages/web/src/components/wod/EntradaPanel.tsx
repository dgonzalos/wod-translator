import clsx from 'clsx';
import type { ExampleWod } from '@wod-translator/shared';
import { Button, Card, StatusMessage, Tag, TextArea } from '../ui';
import styles from './EntradaPanel.module.css';

const MAX_TEXT_LENGTH = 2000;

export interface EntradaPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onSelectExample: (example: ExampleWod) => void;
  examples: ExampleWod[];
  isSubmitting: boolean;
  inputError: string | null;
  activeExampleId: string | null;
}

export function EntradaPanel({
  text,
  onTextChange,
  onSubmit,
  onSelectExample,
  examples,
  isSubmitting,
  inputError,
  activeExampleId,
}: EntradaPanelProps) {
  const isOverLimit = text.length > MAX_TEXT_LENGTH;

  return (
    <Card as="section" className={styles.panel} aria-label="Entrada">
      <h2 className={styles.heading}>Entrada</h2>
      <TextArea
        label="Pega tu WOD (español o inglés)"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        disabled={isSubmitting}
        footer={
          <span className={clsx(isOverLimit && styles.overLimit)}>
            {text.length}/{MAX_TEXT_LENGTH}
          </span>
        }
      />
      {inputError && <StatusMessage tone="error">{inputError}</StatusMessage>}

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Ejemplos:</span>
        {examples.map((example) => (
          <Button
            key={example.id}
            variant="secondary"
            size="sm"
            onClick={() => onSelectExample(example)}
            disabled={isSubmitting}
            aria-pressed={activeExampleId === example.id}
          >
            {example.label} <Tag tone="accent">Demo</Tag>
          </Button>
        ))}
      </div>

      <Button onClick={onSubmit} isLoading={isSubmitting} fullWidth>
        Interpretar
      </Button>
    </Card>
  );
}
