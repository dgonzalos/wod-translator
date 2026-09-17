import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Issue } from '@wod-translator/shared';
import { IssuesList } from './IssuesList';

const issues: Issue[] = [
  { field: 'movements[0].loads', message: 'Carga sin unidad especificada.' },
  { field: 'movements[1].quantity', message: 'Cantidad dudosa.' },
];

describe('IssuesList', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(
      <IssuesList issues={[]} resolvedIssueKeys={new Set()} onToggleIssueResolved={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('toggling the last unresolved issue fires onToggleIssueResolved with that issue', async () => {
    const user = userEvent.setup();
    const onToggleIssueResolved = vi.fn();
    render(
      <IssuesList
        issues={issues}
        resolvedIssueKeys={new Set(['0::movements[0].loads::Carga sin unidad especificada.'])}
        onToggleIssueResolved={onToggleIssueResolved}
      />,
    );

    await user.click(screen.getByText('Cantidad dudosa.'));

    expect(onToggleIssueResolved).toHaveBeenCalledWith(issues[1], 1);
  });

  it('gives duplicate field+message issues distinct keys instead of colliding', () => {
    const duplicateIssues: Issue[] = [
      { field: 'movements', message: 'Revisa los movimientos.' },
      { field: 'movements', message: 'Revisa los movimientos.' },
    ];
    render(
      <IssuesList issues={duplicateIssues} resolvedIssueKeys={new Set()} onToggleIssueResolved={vi.fn()} />,
    );

    expect(screen.getAllByText('Revisa los movimientos.')).toHaveLength(2);
  });
});
