import { CURRENT_WOD_SCHEMA_VERSION } from '../wod.schema.js';
import type { ExampleWod } from './example-wod.schema.js';

export const ohsPullupBoxjump: ExampleWod = {
  id: 'ohs-pullup-boxjump',
  label: 'AMRAP con abreviatura y carga ambigua',
  rawText: "AMRAP 14': 12 OHS 40/30, 9 pull-ups, 15 box jump.",
  card: {
    schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
    format: 'amrap',
    durationSeconds: 840,
    rounds: null,
    timeCapSeconds: null,
    movements: [
      {
        id: 'ohs',
        name: 'Overhead squat',
        quantity: 12,
        unit: 'reps',
        // Load numbers are present (40/30) but their unit is not specified
        // in the source text — never guess kg vs lb, leave it null and
        // flag it as an issue instead.
        loads: null,
        originalTextSnippet: '12 OHS 40/30',
      },
      {
        id: 'pull-up',
        name: 'Pull-ups',
        quantity: 9,
        unit: 'reps',
        loads: null,
        originalTextSnippet: '9 pull-ups',
      },
      {
        id: 'box-jump',
        name: 'Box jump',
        quantity: 15,
        unit: 'reps',
        loads: null,
        originalTextSnippet: '15 box jump',
      },
    ],
    explanations: [
      {
        abbreviation: 'OHS',
        definition: 'Overhead squat: sentadilla con la barra sostenida por encima de la cabeza.',
      },
    ],
    issues: [
      {
        field: 'movements[0].loads',
        message: 'Se detectaron valores de carga (40/30) sin unidad especificada; indica si son kg o lb.',
      },
    ],
  },
};
