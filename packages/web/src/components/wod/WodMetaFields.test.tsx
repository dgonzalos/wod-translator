import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import { WodMetaFields } from './WodMetaFields';

const amrapCard: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 900,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    { id: 'm1', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
  ],
  explanations: [],
  issues: [],
};

describe('WodMetaFields', () => {
  it('shows duration for amrap and hides rounds/time cap', () => {
    render(<WodMetaFields card={amrapCard} fieldErrors={{}} onMetaFieldChange={vi.fn()} />);
    expect(screen.getByLabelText('Duración (segundos)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rondas')).not.toBeInTheDocument();
  });

  it('shows rounds/time cap for for_time and hides duration', () => {
    const forTimeCard: Wod = { ...amrapCard, format: 'for_time', durationSeconds: null, rounds: 5, timeCapSeconds: 1200 };
    render(<WodMetaFields card={forTimeCard} fieldErrors={{}} onMetaFieldChange={vi.fn()} />);
    expect(screen.getByLabelText('Rondas')).toBeInTheDocument();
    expect(screen.getByLabelText('Time cap (segundos)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Duración (segundos)')).not.toBeInTheDocument();
  });

  it('changing the format calls onMetaFieldChange with the new format', async () => {
    const user = userEvent.setup();
    const onMetaFieldChange = vi.fn();
    render(<WodMetaFields card={amrapCard} fieldErrors={{}} onMetaFieldChange={onMetaFieldChange} />);

    await user.selectOptions(screen.getByLabelText('Formato'), 'for_time');

    expect(onMetaFieldChange).toHaveBeenCalledWith({ format: 'for_time' });
  });
});
