import { describe, expect, it } from 'vitest';
import { MovementSchema, WodSchema } from './wod.schema.js';

const validMovement = {
  id: 'thrusters',
  name: 'Thrusters',
  quantity: 10,
  unit: 'reps',
  loads: [{ value: 40, unit: 'kg' }],
  originalTextSnippet: '10 thrusters 40 kg',
};

const validWod = {
  schemaVersion: 1,
  format: 'amrap',
  durationSeconds: 900,
  rounds: null,
  timeCapSeconds: null,
  movements: [validMovement],
  explanations: [],
  issues: [],
};

describe('MovementSchema', () => {
  it('accepts a movement with load alternatives', () => {
    expect(MovementSchema.safeParse(validMovement).success).toBe(true);
  });

  it('accepts a movement with no load', () => {
    expect(
      MovementSchema.safeParse({ ...validMovement, loads: null }).success,
    ).toBe(true);
  });

  it('rejects a negative quantity', () => {
    expect(
      MovementSchema.safeParse({ ...validMovement, quantity: -5 }).success,
    ).toBe(false);
  });

  it('rejects a fractional quantity', () => {
    expect(
      MovementSchema.safeParse({ ...validMovement, quantity: 12.5 }).success,
    ).toBe(false);
  });

  it('rejects an unknown unit', () => {
    expect(
      MovementSchema.safeParse({ ...validMovement, unit: 'furlongs' }).success,
    ).toBe(false);
  });

  it('rejects an empty loads array instead of null', () => {
    expect(
      MovementSchema.safeParse({ ...validMovement, loads: [] }).success,
    ).toBe(false);
  });
});

describe('WodSchema', () => {
  it('accepts a minimal valid AMRAP card', () => {
    expect(WodSchema.safeParse(validWod).success).toBe(true);
  });

  it('rejects an unknown format', () => {
    expect(WodSchema.safeParse({ ...validWod, format: 'emom' }).success).toBe(
      false,
    );
  });

  it('rejects more than 10 movements', () => {
    const movements = Array.from({ length: 11 }, (_, i) => ({
      ...validMovement,
      id: `movement-${i}`,
    }));
    expect(
      WodSchema.safeParse({ ...validWod, movements }).success,
    ).toBe(false);
  });

  it('rejects an empty movements list', () => {
    expect(
      WodSchema.safeParse({ ...validWod, movements: [] }).success,
    ).toBe(false);
  });

  it('rejects an amrap card with rounds set', () => {
    expect(
      WodSchema.safeParse({ ...validWod, rounds: 5 }).success,
    ).toBe(false);
  });

  it('rejects an amrap card with timeCapSeconds set', () => {
    expect(
      WodSchema.safeParse({ ...validWod, timeCapSeconds: 1200 }).success,
    ).toBe(false);
  });

  it('rejects a for_time card with durationSeconds set', () => {
    expect(
      WodSchema.safeParse({
        ...validWod,
        format: 'for_time',
        durationSeconds: 900,
        rounds: 5,
      }).success,
    ).toBe(false);
  });

  it('accepts a valid for_time card', () => {
    expect(
      WodSchema.safeParse({
        ...validWod,
        format: 'for_time',
        durationSeconds: null,
        rounds: 5,
        timeCapSeconds: 1200,
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate movement ids', () => {
    expect(
      WodSchema.safeParse({
        ...validWod,
        movements: [validMovement, { ...validMovement }],
      }).success,
    ).toBe(false);
  });
});
