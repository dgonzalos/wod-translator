import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Movement } from '@wod-translator/shared';
import { MovementEditor } from './MovementEditor';

const movement: Movement = {
  id: 'movement-1',
  name: 'Thrusters',
  quantity: 10,
  unit: 'reps',
  loads: [{ value: 40, unit: 'kg' }],
  originalTextSnippet: '10 thrusters 40 kg',
};

describe('MovementEditor', () => {
  it('shows an inline error scoped to the quantity field only', () => {
    render(
      <MovementEditor
        movement={movement}
        index={0}
        fieldErrors={{ 'movements.0.quantity': 'El valor es demasiado pequeño (mínimo 1).' }}
        onFieldChange={vi.fn()}
        onLoadsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('El valor es demasiado pequeño (mínimo 1).')).toBeInTheDocument();
    // Name field's own error region should not surface an unrelated message.
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('renders the original text snippet as read-only context', () => {
    render(<MovementEditor movement={movement} index={0} fieldErrors={{}} onFieldChange={vi.fn()} onLoadsChange={vi.fn()} />);
    expect(screen.getByText(/10 thrusters 40 kg/)).toBeInTheDocument();
  });
});
