import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXAMPLE_WODS } from '@wod-translator/shared';
import { EntradaPanel } from './EntradaPanel';

function renderPanel(overrides: Partial<Parameters<typeof EntradaPanel>[0]> = {}) {
  const onSubmit = vi.fn();
  const onSelectExample = vi.fn();
  const onTextChange = vi.fn();
  render(
    <EntradaPanel
      text=""
      onTextChange={onTextChange}
      onSubmit={onSubmit}
      onSelectExample={onSelectExample}
      examples={EXAMPLE_WODS}
      isSubmitting={false}
      inputError={null}
      activeExampleId={null}
      {...overrides}
    />,
  );
  return { onSubmit, onSelectExample, onTextChange };
}

describe('EntradaPanel', () => {
  it('shows the input error and does not block clicking Interpretar (validation happens in the hook)', () => {
    renderPanel({ inputError: 'El texto no puede estar vacío.' });
    expect(screen.getByText('El texto no puede estar vacío.')).toBeInTheDocument();
  });

  it('clicking an example calls onSelectExample, not onSubmit', async () => {
    const user = userEvent.setup();
    const { onSelectExample, onSubmit } = renderPanel();

    await user.click(screen.getByText(EXAMPLE_WODS[0].label));

    expect(onSelectExample).toHaveBeenCalledWith(EXAMPLE_WODS[0]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables Interpretar and the examples while submitting', () => {
    renderPanel({ isSubmitting: true });
    expect(screen.getByRole('button', { name: /Interpretar/ })).toBeDisabled();
    expect(screen.getByText(EXAMPLE_WODS[0].label).closest('button')).toBeDisabled();
  });

  it('clicking Interpretar calls onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPanel({ text: 'AMRAP 10min: 10 burpees' });

    await user.click(screen.getByRole('button', { name: 'Interpretar' }));

    expect(onSubmit).toHaveBeenCalled();
  });
});
