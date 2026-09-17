import { describe, expect, it } from 'vitest';
import { AdaptationProposalSchema, EquipmentSelectionSchema } from './adaptation.schema.js';

const validProposal = {
  movementId: 'thrusters',
  substitute: 'Goblet squat + press',
  requiredEquipment: ['dumbbell'],
  reason: 'No barbell available.',
  caveats: null,
};

describe('AdaptationProposalSchema', () => {
  it('accepts a valid proposal', () => {
    expect(AdaptationProposalSchema.safeParse(validProposal).success).toBe(true);
  });

  it('accepts caveats as a string', () => {
    expect(
      AdaptationProposalSchema.safeParse({ ...validProposal, caveats: 'Lighter stimulus.' })
        .success,
    ).toBe(true);
  });

  it('rejects a missing reason', () => {
    const { reason, ...rest } = validProposal;
    expect(AdaptationProposalSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects more than 10 required equipment entries', () => {
    const requiredEquipment = Array.from({ length: 11 }, (_, i) => `item-${i}`);
    expect(
      AdaptationProposalSchema.safeParse({ ...validProposal, requiredEquipment }).success,
    ).toBe(false);
  });
});

describe('EquipmentSelectionSchema', () => {
  it('accepts an empty selection with no known loads', () => {
    expect(
      EquipmentSelectionSchema.safeParse({ equipment: [], availableLoadsKg: null }).success,
    ).toBe(true);
  });

  it('rejects a negative load', () => {
    expect(
      EquipmentSelectionSchema.safeParse({ equipment: [], availableLoadsKg: [-10] }).success,
    ).toBe(false);
  });
});
