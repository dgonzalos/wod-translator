import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { WodSchema } from '@wod-translator/shared';
import { buildApp } from '../index.js';
import type { CreateMessage } from '../ai/interpret.service.js';
import { REPORT_INTERPRETATION_TOOL, REPORT_UNSUPPORTED_FORMAT_TOOL } from '../ai/interpret-tools.js';
import { QuotaManager } from '../rate-limit/quota.js';

function fakeMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return { content } as unknown as Anthropic.Message;
}

function toolUseBlock(name: string, input: unknown): Anthropic.ContentBlock {
  return { type: 'tool_use', id: 'toolu_1', name, input } as unknown as Anthropic.ContentBlock;
}

const validInterpretationInput = {
  format: 'amrap' as const,
  durationSeconds: 720,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    {
      id: 'movement-1',
      name: 'Burpees',
      quantity: 15,
      unit: 'reps' as const,
      loads: null,
      originalTextSnippet: '15 burpees',
    },
  ],
  explanations: [],
  issues: [],
};

describe('POST /api/parse', () => {
  it('returns 400 INVALID_INPUT for an empty body', async () => {
    const app = buildApp({ createMessage: async () => fakeMessage([]) });
    const response = await app.inject({ method: 'POST', url: '/api/parse', payload: { text: '' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('INVALID_INPUT');
  });

  it('returns 200 with a schema-valid card on a successful interpretation', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
    const app = buildApp({ createMessage });

    const response = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload: { text: 'AMRAP 12min: 15 burpees' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(WodSchema.safeParse(body.card).success).toBe(true);
    expect(typeof body.requestId).toBe('string');
  });

  it('returns 422 UNSUPPORTED_FORMAT when the model reports an unsupported format', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_UNSUPPORTED_FORMAT_TOOL, { reason: 'EMOM structure' })]);
    const app = buildApp({ createMessage });

    const response = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload: { text: 'EMOM 20min: 5 pull-ups' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('UNSUPPORTED_FORMAT');
  });

  it('returns 504 TIMEOUT when the provider call times out', async () => {
    const { APIConnectionTimeoutError } = await import('@anthropic-ai/sdk');
    const createMessage: CreateMessage = async () => {
      throw new APIConnectionTimeoutError();
    };
    const app = buildApp({ createMessage });

    const response = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload: { text: 'AMRAP 12min: 15 burpees' },
    });

    expect(response.statusCode).toBe(504);
    expect(response.json().code).toBe('TIMEOUT');
  });

  it('returns 502 PROVIDER_ERROR when the provider call fails', async () => {
    const createMessage: CreateMessage = async () => {
      throw new Error('network down');
    };
    const app = buildApp({ createMessage });

    const response = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload: { text: 'AMRAP 12min: 15 burpees' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().code).toBe('PROVIDER_ERROR');
  });

  it('returns 429 RATE_LIMITED once the per-IP hourly quota is exhausted', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
    const quota = new QuotaManager({ perIpPerHour: 2, globalMaxConcurrency: 5, globalRequestsPerMinute: 1000, globalTokenBudget: null });
    const app = buildApp({ createMessage, quota });

    const payload = { text: 'AMRAP 12min: 15 burpees' };
    const injectFromIp = (remoteAddress: string) =>
      app.inject({ method: 'POST', url: '/api/parse', payload, remoteAddress });

    expect((await injectFromIp('9.9.9.1')).statusCode).toBe(200);
    expect((await injectFromIp('9.9.9.1')).statusCode).toBe(200);
    const third = await injectFromIp('9.9.9.1');
    expect(third.statusCode).toBe(429);
    expect(third.json().code).toBe('RATE_LIMITED');

    // A different IP is unaffected — proves the limit is per-IP, not global.
    expect((await injectFromIp('9.9.9.2')).statusCode).toBe(200);
  });

  it('rejects a concurrent request from the same IP while one is still in flight', async () => {
    let resolveFirst!: () => void;
    const firstCallStarted = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const createMessage: CreateMessage = async () => {
      resolveFirst();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
    };
    const quota = new QuotaManager({ perIpPerHour: 5, globalMaxConcurrency: 5, globalRequestsPerMinute: 1000, globalTokenBudget: null });
    const app = buildApp({ createMessage, quota });
    const payload = { text: 'AMRAP 12min: 15 burpees' };

    const firstRequest = app.inject({ method: 'POST', url: '/api/parse', payload, remoteAddress: '9.9.9.3' });
    await firstCallStarted;
    const secondResponse = await app.inject({ method: 'POST', url: '/api/parse', payload, remoteAddress: '9.9.9.3' });
    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.json().code).toBe('RATE_LIMITED');

    expect((await firstRequest).statusCode).toBe(200);
  });

  it('does not let a spoofed X-Forwarded-For header change the quota bucket when trustProxy is off', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
    const quota = new QuotaManager({ perIpPerHour: 1, globalMaxConcurrency: 5, globalRequestsPerMinute: 1000, globalTokenBudget: null });
    const app = buildApp({ createMessage, quota });
    const payload = { text: 'AMRAP 12min: 15 burpees' };

    const first = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload,
      remoteAddress: '9.9.9.4',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(first.statusCode).toBe(200);

    // Same real remoteAddress, different forged header — still counts against the same bucket.
    const second = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload,
      remoteAddress: '9.9.9.4',
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });
    expect(second.statusCode).toBe(429);
  });

  it('reads the real client IP from X-Forwarded-For when TRUST_PROXY_HOPS trusts exactly one hop', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
    const quota = new QuotaManager({ perIpPerHour: 1, globalMaxConcurrency: 5, globalRequestsPerMinute: 1000, globalTokenBudget: null });
    const app = buildApp({ createMessage, quota, trustProxyHops: 1 });
    const payload = { text: 'AMRAP 12min: 15 burpees' };

    // Two different "real" clients arriving through the same simulated
    // trusted proxy (same remoteAddress) must land in two different quota
    // buckets — proving request.ip is read from the trusted header, not the
    // proxy's own socket address.
    const clientA = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload,
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(clientA.statusCode).toBe(200);

    const clientB = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload,
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });
    expect(clientB.statusCode).toBe(200);

    // With only 1 hop trusted, a deeper (further-from-server) header entry
    // beyond that hop must NOT be read as the client — only the entry
    // nearest the trusted proxy counts. A second request whose nearest
    // entry is '1.2.3.4' again (regardless of what precedes it) must land
    // in client A's now-exhausted bucket, not create a 3rd distinct one.
    const spoofedDeeperHop = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload,
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': '9.9.9.9, 1.2.3.4' },
    });
    expect(spoofedDeeperHop.statusCode).toBe(429);
  });
});
