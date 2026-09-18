import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXAMPLE_WODS } from '@wod-translator/shared';
import { App } from './App';
import { parseWod } from './api/parseWod';

vi.mock('./api/parseWod', () => ({
  parseWod: vi.fn(),
}));

const mockedMockParse = vi.mocked(parseWod);

describe('App', () => {
  beforeEach(() => {
    mockedMockParse.mockReset();
  });

  it('loads an example with zero mock invocations', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText(EXAMPLE_WODS[0].label));

    expect(mockedMockParse).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(EXAMPLE_WODS[0].card.movements[0].name)).toBeInTheDocument();
  });

  it('reaches revision_necesaria for generic interpreted text with an issue', async () => {
    const user = userEvent.setup();
    mockedMockParse.mockResolvedValue({
      ok: true,
      requestId: 'req-1',
      card: {
        schemaVersion: 1,
        format: 'amrap',
        durationSeconds: 600,
        rounds: null,
        timeCapSeconds: null,
        movements: [
          { id: 'm1', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
        ],
        explanations: [],
        issues: [{ field: 'movements[0].quantity', message: 'Revisa esta cantidad.' }],
      },
    });
    render(<App />);

    await user.type(screen.getByLabelText('Pega tu WOD (español o inglés)'), 'AMRAP 10min: 10 burpees');
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));

    expect(await screen.findByText('Revisa esta cantidad.')).toBeInTheDocument();
    expect(screen.getByText(/Revisión necesaria/)).toBeInTheDocument();
  });

  it('shows the unsupported-format error state for EMOM text', async () => {
    const user = userEvent.setup();
    mockedMockParse.mockResolvedValue({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: 'Este formato no está soportado.', requestId: 'req-1' },
    });
    render(<App />);

    await user.type(screen.getByLabelText('Pega tu WOD (español o inglés)'), 'EMOM 20min: 5 pull-ups');
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));

    expect(await screen.findByText('Este formato no está soportado.')).toBeInTheDocument();
  });

  it('shows the stale banner and disables card fields after editing the text', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText(EXAMPLE_WODS[0].label));
    await user.type(screen.getByLabelText('Pega tu WOD (español o inglés)'), ' extra');

    expect(
      await screen.findByText('El texto original cambió. Vuelve a pulsar “Interpretar” para actualizar la ficha.'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue(EXAMPLE_WODS[0].card.movements[0].name)).toBeDisabled();
  });

  it('preserves the textarea content after a failed interpret', async () => {
    const user = userEvent.setup();
    mockedMockParse.mockResolvedValue({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'El proveedor falló.', requestId: 'req-1' },
    });
    render(<App />);

    const textarea = screen.getByLabelText('Pega tu WOD (español o inglés)');
    await user.type(textarea, 'AMRAP 10min: 10 burpees');
    await user.click(screen.getByRole('button', { name: 'Interpretar' }));

    await screen.findByText('El proveedor falló.');
    expect(textarea).toHaveValue('AMRAP 10min: 10 burpees');
  });
});
