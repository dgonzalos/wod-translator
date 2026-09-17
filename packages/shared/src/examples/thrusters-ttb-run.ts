import { CURRENT_WOD_SCHEMA_VERSION } from '../wod.schema.js';
import type { ExampleWod } from './example-wod.schema.js';

export const thrustersTtbRun: ExampleWod = {
  id: 'thrusters-ttb-run',
  label: 'AMRAP con thrusters, TTB y carrera',
  rawText: "AMRAP 15': 10 thrusters 40/30 kg, 12 TTB, 200 m run.",
  card: {
    schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
    format: 'amrap',
    durationSeconds: 900,
    rounds: null,
    timeCapSeconds: null,
    movements: [
      {
        id: 'thrusters',
        name: 'Thrusters',
        quantity: 10,
        unit: 'reps',
        loads: [
          { value: 40, unit: 'kg' },
          { value: 30, unit: 'kg' },
        ],
        originalTextSnippet: '10 thrusters 40/30 kg',
      },
      {
        id: 'ttb',
        name: 'Toes to bar',
        quantity: 12,
        unit: 'reps',
        loads: null,
        originalTextSnippet: '12 TTB',
      },
      {
        id: 'run',
        name: 'Run',
        quantity: 200,
        unit: 'm',
        loads: null,
        originalTextSnippet: '200 m run',
      },
    ],
    explanations: [
      {
        abbreviation: 'TTB',
        definition: 'Toes to bar: llevar los pies a la barra desde una posición colgada.',
      },
    ],
    issues: [],
  },
};
