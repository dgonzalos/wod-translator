import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuotaManager, type QuotaConfig } from './quota.js';

function manager(overrides: Partial<QuotaConfig> = {}) {
  return new QuotaManager({
    perIpPerHour: 5,
    globalMaxConcurrency: 3,
    globalRequestsPerMinute: 1000,
    globalTokenBudget: null,
    ...overrides,
  });
}

describe('QuotaManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects the 6th reservation from the same IP within an hour', () => {
    const quota = manager({ perIpPerHour: 5 });
    for (let i = 0; i < 5; i++) {
      const reservation = quota.reserve('1.1.1.1');
      expect(reservation.ok).toBe(true);
      if (reservation.ok) reservation.release();
    }
    const sixth = quota.reserve('1.1.1.1');
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.reason).toBe('ip_hourly_limit');
  });

  it('rejects a second in-flight reservation from the same IP before the first releases', () => {
    const quota = manager();
    const first = quota.reserve('1.1.1.1');
    expect(first.ok).toBe(true);

    const second = quota.reserve('1.1.1.1');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('ip_in_flight');

    if (first.ok) first.release();
    const third = quota.reserve('1.1.1.1');
    expect(third.ok).toBe(true);
  });

  it('enforces a global concurrency cap across different IPs', () => {
    const quota = manager({ perIpPerHour: 10, globalMaxConcurrency: 2 });
    const a = quota.reserve('1.1.1.1');
    const b = quota.reserve('2.2.2.2');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const c = quota.reserve('3.3.3.3');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toBe('global_concurrency');

    if (a.ok) a.release();
    const d = quota.reserve('3.3.3.3');
    expect(d.ok).toBe(true);
  });

  it('rejects new reservations once the global token budget is spent', () => {
    const quota = manager({ perIpPerHour: 10, globalTokenBudget: 100 });
    const first = quota.reserve('1.1.1.1');
    expect(first.ok).toBe(true);
    if (first.ok) first.release({ inputTokens: 60, outputTokens: 60 });

    const second = quota.reserve('1.1.1.1');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('global_budget');
  });

  it('does not count tokens toward the budget when release is called with no usage', () => {
    const quota = manager({ perIpPerHour: 10, globalTokenBudget: 100 });
    const first = quota.reserve('1.1.1.1');
    if (first.ok) first.release();

    const second = quota.reserve('1.1.1.1');
    expect(second.ok).toBe(true);
  });

  it('recovers global budget headroom once the rolling hour window passes, without a restart', () => {
    vi.useFakeTimers();
    const quota = manager({ perIpPerHour: 10, globalTokenBudget: 100 });

    const first = quota.reserve('1.1.1.1');
    if (first.ok) first.release({ inputTokens: 100, outputTokens: 0 });

    const second = quota.reserve('1.1.1.1');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('global_budget');

    vi.advanceTimersByTime(61 * 60 * 1000); // just past the 1-hour spend window

    const third = quota.reserve('1.1.1.1');
    expect(third.ok).toBe(true);
  });

  it('caps AI-calling requests per minute across all IPs combined, regardless of how many distinct IPs are used', () => {
    // Proves that rotating through many source IPs cannot bypass throughput
    // limits: each IP below is well under its own per-IP hourly cap and
    // global concurrency is generous, yet only 3 of the 4 succeed.
    const quota = manager({ perIpPerHour: 100, globalMaxConcurrency: 100, globalRequestsPerMinute: 3 });
    const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
    const results = ips.map((ip) => {
      const reservation = quota.reserve(ip);
      if (reservation.ok) reservation.release();
      return reservation;
    });

    expect(results.filter((r) => r.ok)).toHaveLength(3);
    const rejected = results.find((r) => !r.ok);
    expect(rejected).toBeDefined();
    if (rejected && !rejected.ok) expect(rejected.reason).toBe('global_request_rate');
  });

  it('bounds tracked-IP memory by evicting the oldest entry once maxTrackedIps is reached', () => {
    // With only 2 slots, a 3rd distinct IP evicts the 1st (insertion-order
    // oldest). Reserving for the evicted IP again then succeeds immediately
    // instead of being blocked by its (forgotten) prior reservation — the
    // trade-off documented on QuotaConfig.maxTrackedIps.
    const quota = manager({ perIpPerHour: 1, globalRequestsPerMinute: 1000, maxTrackedIps: 2 });

    const a1 = quota.reserve('1.1.1.1');
    if (a1.ok) a1.release();
    const b1 = quota.reserve('2.2.2.2');
    if (b1.ok) b1.release();

    const a2 = quota.reserve('1.1.1.1');
    expect(a2.ok).toBe(false);
    if (!a2.ok) expect(a2.reason).toBe('ip_hourly_limit');

    const c1 = quota.reserve('3.3.3.3'); // new IP at capacity — evicts 1.1.1.1
    if (c1.ok) c1.release();

    const a3 = quota.reserve('1.1.1.1');
    expect(a3.ok).toBe(true);
  });
});
