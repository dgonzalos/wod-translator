import { describe, expect, it } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import { formatWodSummary } from './formatWodSummary';

const amrapCard: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 720,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    {
      id: 'm1',
      name: 'Thrusters',
      quantity: 10,
      unit: 'reps',
      loads: [
        { value: 40, unit: 'kg' },
        { value: 30, unit: 'kg' },
      ],
      originalTextSnippet: '10 thrusters 40/30 kg',
    },
    { id: 'm2', name: 'Run', quantity: 200, unit: 'm', loads: null, originalTextSnippet: '200 m run' },
  ],
  explanations: [],
  issues: [],
};

const forTimeCard: Wod = {
  ...amrapCard,
  format: 'for_time',
  durationSeconds: null,
  rounds: 5,
  timeCapSeconds: 1200,
};

describe('formatWodSummary', () => {
  it('formats an AMRAP header with duration and each movement with loads', () => {
    const text = formatWodSummary(amrapCard, []);
    expect(text).toContain('AMRAP 12 min');
    expect(text).toContain('- 10 reps Thrusters — 40kg/30kg');
    expect(text).toContain('- 200 m Run');
  });

  it('formats a For Time header with rounds and time cap', () => {
    const text = formatWodSummary(forTimeCard, []);
    expect(text).toContain('For Time, 5 rondas, tope 20 min');
  });

  it('omits the substitutions section when there are no accepted proposals', () => {
    const text = formatWodSummary(amrapCard, []);
    expect(text).not.toContain('Sustituciones aceptadas');
  });

  it('lists accepted proposals with the original movement name and reason', () => {
    const text = formatWodSummary(amrapCard, [
      { movementId: 'm1', substitute: 'Front squat con mancuernas', requiredEquipment: [], reason: 'Sin barra', caveats: null },
    ]);
    expect(text).toContain('Sustituciones aceptadas:');
    expect(text).toContain('- Thrusters → Front squat con mancuernas (motivo: Sin barra)');
  });
});
