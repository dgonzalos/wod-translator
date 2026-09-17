import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema, ParseRequestSchema } from './api.schema.js';

describe('ApiErrorSchema', () => {
  it('accepts a known error code', () => {
    expect(
      ApiErrorSchema.safeParse({
        code: 'RATE_LIMITED',
        message: 'Too many requests.',
        requestId: 'req-1',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown error code', () => {
    expect(
      ApiErrorSchema.safeParse({
        code: 'SOMETHING_ELSE',
        message: 'Too many requests.',
        requestId: 'req-1',
      }).success,
    ).toBe(false);
  });
});

describe('ParseRequestSchema', () => {
  it('rejects empty text', () => {
    expect(ParseRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('rejects text over 2000 characters', () => {
    expect(ParseRequestSchema.safeParse({ text: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('accepts non-empty text within the limit', () => {
    expect(ParseRequestSchema.safeParse({ text: 'AMRAP 10min: 5 pull-ups' }).success).toBe(true);
  });
});

describe('HealthResponseSchema', () => {
  it('accepts only status "ok"', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
    expect(HealthResponseSchema.safeParse({ status: 'down' }).success).toBe(false);
  });
});
