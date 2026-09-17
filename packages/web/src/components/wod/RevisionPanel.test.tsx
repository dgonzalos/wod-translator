import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import { RevisionPanel } from './RevisionPanel';

const card: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 600,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    { id: 'm1', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
    { id: 'm1', name: 'Burpees again', quantity: 5, unit: 'reps', loads: null, originalTextSnippet: '5 more' },
  ],
  explanations: [],
  issues: [],
};

function renderPanel(fieldErrors: Record<string, string>) {
  render(
    <RevisionPanel
      card={card}
      isStale={false}
      appState="revision_necesaria"
      errorMessage={null}
      fieldErrors={fieldErrors}
      resolvedIssueKeys={new Set()}
      onMetaFieldChange={vi.fn()}
      onMovementFieldChange={vi.fn()}
      onMovementLoadsChange={vi.fn()}
      onToggleIssueResolved={vi.fn()}
    />,
  );
}

describe('RevisionPanel', () => {
  it('surfaces an array-level card error (e.g. duplicate movement ids) instead of leaving it unexplained', () => {
    renderPanel({ movements: 'movement ids must be unique; duplicated: m1' });
    expect(screen.getByText('movement ids must be unique; duplicated: m1')).toBeInTheDocument();
  });

  it('renders nothing extra when there is no array-level error', () => {
    renderPanel({});
    expect(screen.queryByText(/duplicated/)).not.toBeInTheDocument();
  });
});
