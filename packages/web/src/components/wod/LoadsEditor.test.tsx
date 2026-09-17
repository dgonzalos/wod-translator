import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Load } from '@wod-translator/shared';
import { LoadsEditor } from './LoadsEditor';

describe('LoadsEditor', () => {
  it('toggling to "Sin carga" nulls the loads array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loads: Load[] = [{ value: 40, unit: 'kg' }];
    render(<LoadsEditor loads={loads} fieldErrors={{}} pathPrefix="movements.0.loads" onChange={onChange} />);

    await user.click(screen.getByLabelText('Sin carga'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('toggling to "Con carga" seeds a single default alternative', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LoadsEditor loads={null} fieldErrors={{}} pathPrefix="movements.0.loads" onChange={onChange} />);

    await user.click(screen.getByLabelText('Con carga'));

    expect(onChange).toHaveBeenCalledWith([{ value: 1, unit: 'kg' }]);
  });

  it('disables "Eliminar" at the 1-alternative floor', () => {
    const loads: Load[] = [{ value: 40, unit: 'kg' }];
    render(<LoadsEditor loads={loads} fieldErrors={{}} pathPrefix="movements.0.loads" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  it('disables "Añadir alternativa" at the 6-alternative ceiling', () => {
    const loads: Load[] = Array.from({ length: 6 }, (_, i) => ({ value: 10 + i, unit: 'kg' as const }));
    render(<LoadsEditor loads={loads} fieldErrors={{}} pathPrefix="movements.0.loads" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Añadir alternativa' })).toBeDisabled();
  });

  it('shows an inline error for an invalid load value', () => {
    const loads: Load[] = [{ value: 40, unit: 'kg' }];
    render(
      <LoadsEditor
        loads={loads}
        fieldErrors={{ 'movements.0.loads.0.value': 'El valor es demasiado pequeño (mínimo 0).' }}
        pathPrefix="movements.0.loads"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('El valor es demasiado pequeño (mínimo 0).')).toBeInTheDocument();
  });
});
