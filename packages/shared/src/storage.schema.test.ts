import { describe, expect, it } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION } from './wod.schema.js';
import { SavedWodEnvelopeSchema } from './storage.schema.js';

const validEnvelope = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  originalText: "AMRAP 15': 10 thrusters 40/30 kg, 12 TTB, 200 m run.",
  reviewedCard: {
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
        loads: [{ value: 40, unit: 'kg' }],
        originalTextSnippet: '10 thrusters 40 kg',
      },
    ],
    explanations: [],
    issues: [],
  },
  acceptedProposals: [],
  savedAt: new Date().toISOString(),
};

describe('SavedWodEnvelopeSchema', () => {
  it('accepts a valid envelope', () => {
    expect(SavedWodEnvelopeSchema.safeParse(validEnvelope).success).toBe(true);
  });

  it('rejects a non-ISO date', () => {
    expect(
      SavedWodEnvelopeSchema.safeParse({ ...validEnvelope, savedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('rejects a corrupt reviewed card', () => {
    expect(
      SavedWodEnvelopeSchema.safeParse({
        ...validEnvelope,
        reviewedCard: { ...validEnvelope.reviewedCard, movements: [] },
      }).success,
    ).toBe(false);
  });
});
