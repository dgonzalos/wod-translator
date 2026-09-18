import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { WodSchema } from '@wod-translator/shared';
import { buildApp } from '../index.js';
import type { CreateMessage } from '../ai/interpret.service.js';
import { REPORT_INTERPRETATION_TOOL, REPORT_UNSUPPORTED_FORMAT_TOOL } from '../ai/interpret-tools.js';

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
});
