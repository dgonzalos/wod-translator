import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_WOD_SCHEMA_VERSION, type AdaptationProposal, type SavedWodEnvelope, type Wod } from '@wod-translator/shared';
import { AdaptacionPanel, type AdaptacionPanelProps } from './AdaptacionPanel';

const card: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 600,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    { id: 'm1', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
  ],
  explanations: [],
  issues: [],
};

const proposal: AdaptationProposal = {
  movementId: 'm1',
  substitute: 'Step-ups',
  requiredEquipment: ['Cajón (box)'],
  reason: 'No hay espacio para burpees.',
  caveats: null,
};

function baseProps(overrides: Partial<AdaptacionPanelProps> = {}): AdaptacionPanelProps {
  return {
    card,
    appState: 'listo',
    equipment: [],
    onEquipmentChange: vi.fn(),
    availableLoadsKg: null,
    onAvailableLoadsKgChange: vi.fn(),
    proposals: [],
    acceptedProposalKeys: new Set(),
    onToggleProposalAccepted: vi.fn(),
    adaptPhase: 'idle',
    adaptErrorMessage: null,
    onAdapt: vi.fn(),
    acceptedProposals: [],
    onSave: vi.fn(() => ({ ok: true as const })),
    restoreBanner: null,
    onRestore: vi.fn(),
    storageNotice: null,
    onClearSaved: vi.fn(),
    ...overrides,
  };
}

describe('AdaptacionPanel', () => {
  it('disables Adaptar and shows a hint when appState is not listo', () => {
    render(<AdaptacionPanel {...baseProps({ appState: 'revision_necesaria' })} />);
    expect(screen.getByRole('button', { name: 'Adaptar' })).toBeDisabled();
    expect(screen.getByText(/La adaptación estará disponible/)).toBeInTheDocument();
  });

  it('renders a proposal and reports acceptance toggling', async () => {
    const user = userEvent.setup();
    const onToggleProposalAccepted = vi.fn();
    render(<AdaptacionPanel {...baseProps({ proposals: [proposal], onToggleProposalAccepted })} />);

    expect(screen.getByText('Step-ups')).toBeInTheDocument();
    expect(screen.getByText('No hay espacio para burpees.')).toBeInTheDocument();

    const proposalItem = screen.getByText('Step-ups').closest('li')!;
    await user.click(within(proposalItem).getByRole('checkbox'));
    expect(onToggleProposalAccepted).toHaveBeenCalledWith(proposal);
  });

  it('shows a fallback textarea when the clipboard write fails', async () => {
    // userEvent.setup() installs its own always-succeeding clipboard stub
    // (attachClipboardStubToView) that overrides anything defined before
    // it, so the write failure has to be injected by spying on that stub
    // afterwards rather than by pre-defining navigator.clipboard.
    const user = userEvent.setup();
    render(<AdaptacionPanel {...baseProps()} />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));

    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(await screen.findByLabelText('Texto para copiar manualmente')).toBeInTheDocument();
    expect(screen.getByText(/No se pudo copiar automáticamente/)).toBeInTheDocument();
  });

  it('shows a success message when the clipboard write succeeds', async () => {
    const user = userEvent.setup();
    render(<AdaptacionPanel {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(await screen.findByText('Copiado al portapapeles.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto para copiar manualmente')).not.toBeInTheDocument();
  });

  it('renders the restore banner and wires Cargar/Descartar', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onClearSaved = vi.fn();
    const envelope: SavedWodEnvelope = {
      schemaVersion: 1,
      originalText: 'AMRAP 10min: 10 burpees',
      reviewedCard: card,
      acceptedProposals: [],
      savedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    };
    render(<AdaptacionPanel {...baseProps({ restoreBanner: envelope, onRestore, onClearSaved })} />);

    expect(screen.getByText(/Se encontró un WOD guardado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cargar' }));
    expect(onRestore).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onClearSaved).toHaveBeenCalled();
  });

  it('shows the save result message returned by onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => ({ ok: false as const, message: 'No se pudo guardar.' }));
    render(<AdaptacionPanel {...baseProps({ onSave })} />);

    await user.click(screen.getByRole('button', { name: 'Guardar en este navegador' }));

    expect(await screen.findByText('No se pudo guardar.')).toBeInTheDocument();
  });
});
