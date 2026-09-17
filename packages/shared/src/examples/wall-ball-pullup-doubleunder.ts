import { CURRENT_WOD_SCHEMA_VERSION } from '../wod.schema.js';
import type { ExampleWod } from './example-wod.schema.js';

export const wallBallPullupDoubleunder: ExampleWod = {
  id: 'wall-ball-pullup-doubleunder',
  label: 'For Time con rondas y time cap',
  rawText: 'For Time, 5 rounds, cap 20 min: 15 wall balls 9/6 kg, 10 pull-ups, 20 double-unders.',
  card: {
    schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
    format: 'for_time',
    durationSeconds: null,
    rounds: 5,
    timeCapSeconds: 1200,
    movements: [
      {
        id: 'wall-ball',
        name: 'Wall balls',
        quantity: 15,
        unit: 'reps',
        loads: [
          { value: 9, unit: 'kg' },
          { value: 6, unit: 'kg' },
        ],
        originalTextSnippet: '15 wall balls 9/6 kg',
      },
      {
        id: 'pull-up',
        name: 'Pull-ups',
        quantity: 10,
        unit: 'reps',
        loads: null,
        originalTextSnippet: '10 pull-ups',
      },
      {
        id: 'double-under',
        name: 'Double-unders',
        quantity: 20,
        unit: 'reps',
        loads: null,
        originalTextSnippet: '20 double-unders',
      },
    ],
    explanations: [],
    issues: [],
  },
};
