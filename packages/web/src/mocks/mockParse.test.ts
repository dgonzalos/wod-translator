import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WodSchema } from '@wod-translator/shared';
import { mockParse } from './mockParse';

describe('mockParse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns UNSUPPORTED_FORMAT for text mentioning EMOM', async () => {
    const promise = mockParse('EMOM 20min: 5 pull-ups');
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('returns TIMEOUT for text mentioning timeout', async () => {
    const promise = mockParse('please timeout this request');
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('TIMEOUT');
  });

  it('returns PROVIDER_ERROR for text mentioning provider', async () => {
    const promise = mockParse('trigger a provider failure');
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await promise;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('returns a schema-valid generic card for arbitrary text', async () => {
    const promise = mockParse('AMRAP 12min: 20 kettlebell swings, 15 burpees');
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await promise;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(WodSchema.safeParse(outcome.card).success).toBe(true);
      expect(outcome.card.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects when aborted before the simulated delay completes', async () => {
    const controller = new AbortController();
    const promise = mockParse('AMRAP 12min: 20 kettlebell swings', controller.signal);
    const assertion = expect(promise).rejects.toThrow();
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
