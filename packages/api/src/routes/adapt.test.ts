import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { AdaptationProposalSchema, CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import { buildApp } from '../index.js';
import type { CreateMessage } from '../ai/anthropic-client.js';
import { REPORT_ADAPTATION_PROPOSALS_TOOL } from '../ai/adapt-tools.js';
import { REPORT_INTERPRETATION_TOOL } from '../ai/interpret-tools.js';
import { QuotaManager } from '../rate-limit/quota.js';

function fakeMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return { content } as unknown as Anthropic.Message;
}

function toolUseBlock(name: string, input: unknown): Anthropic.ContentBlock {
  return { type: 'tool_use', id: 'toolu_1', name, input } as unknown as Anthropic.ContentBlock;
}

const card: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 720,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    {
      id: 'movement-1',
      name: 'Thrusters',
      quantity: 10,
      unit: 'reps',
      loads: [{ value: 40, unit: 'kg' }],
      originalTextSnippet: '10 thrusters 40 kg',
    },
  ],
  explanations: [],
  issues: [],
};

const equipment = { equipment: ['Mancuernas'], availableLoadsKg: null };

const validProposal = {
  movementId: 'movement-1',
  substitute: 'Front squat con mancuernas',
  requiredEquipment: ['Mancuernas'],
  reason: 'No hay barra olímpica disponible.',
  caveats: null,
};

describe('POST /api/adapt', () => {
  it('returns 400 INVALID_INPUT for a malformed card', async () => {
    const app = buildApp({ createMessage: async () => fakeMessage([]) });
    const response = await app.inject({
      method: 'POST',
      url: '/api/adapt',
      payload: { card: { format: 'amrap' }, equipment },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('INVALID_INPUT');
  });

  it('returns 200 with schema-valid proposals on success', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, { proposals: [validProposal] })]);
    const app = buildApp({ createMessage });

    const response = await app.inject({ method: 'POST', url: '/api/adapt', payload: { card, equipment } });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.requestId).toBe('string');
    expect(body.proposals).toHaveLength(1);
    expect(AdaptationProposalSchema.safeParse(body.proposals[0]).success).toBe(true);
  });

  it('returns 504 TIMEOUT when the provider call times out', async () => {
    const { APIConnectionTimeoutError } = await import('@anthropic-ai/sdk');
    const createMessage: CreateMessage = async () => {
      throw new APIConnectionTimeoutError();
    };
    const app = buildApp({ createMessage });

    const response = await app.inject({ method: 'POST', url: '/api/adapt', payload: { card, equipment } });

    expect(response.statusCode).toBe(504);
    expect(response.json().code).toBe('TIMEOUT');
  });

  it('returns 502 PROVIDER_ERROR when the provider call fails', async () => {
    const createMessage: CreateMessage = async () => {
      throw new Error('network down');
    };
    const app = buildApp({ createMessage });

    const response = await app.inject({ method: 'POST', url: '/api/adapt', payload: { card, equipment } });

    expect(response.statusCode).toBe(502);
    expect(response.json().code).toBe('PROVIDER_ERROR');
  });

  it('shares its rate-limit quota with /api/parse for the same IP', async () => {
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
    const createMessage: CreateMessage = async (params) => {
      const toolName = params.tools?.[0]?.name;
      if (toolName === REPORT_INTERPRETATION_TOOL) {
        return fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);
      }
      return fakeMessage([toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, { proposals: [validProposal] })]);
    };
    const quota = new QuotaManager({ perIpPerHour: 2, globalMaxConcurrency: 5, globalRequestsPerMinute: 1000, globalTokenBudget: null });
    const app = buildApp({ createMessage, quota });

    const parseResponse = await app.inject({
      method: 'POST',
      url: '/api/parse',
      payload: { text: 'AMRAP 12min: 15 burpees' },
      remoteAddress: '9.9.9.5',
    });
    expect(parseResponse.statusCode).toBe(200);

    const adaptResponse = await app.inject({
      method: 'POST',
      url: '/api/adapt',
      payload: { card, equipment },
      remoteAddress: '9.9.9.5',
    });
    expect(adaptResponse.statusCode).toBe(200);

    // Third AI-calling request from the same IP within the hour — quota of 2 is now exhausted.
    const thirdResponse = await app.inject({
      method: 'POST',
      url: '/api/adapt',
      payload: { card, equipment },
      remoteAddress: '9.9.9.5',
    });
    expect(thirdResponse.statusCode).toBe(429);
    expect(thirdResponse.json().code).toBe('RATE_LIMITED');
  });
});
