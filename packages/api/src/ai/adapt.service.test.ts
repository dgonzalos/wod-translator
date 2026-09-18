import type Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION, type Wod } from '@wod-translator/shared';
import type { CreateMessage } from './anthropic-client.js';
import { AdaptationService } from './adapt.service.js';
import { REPORT_ADAPTATION_PROPOSALS_TOOL } from './adapt-tools.js';

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

function service(createMessage: CreateMessage) {
  return new AdaptationService(createMessage, 'test-model', 25000);
}

describe('AdaptationService', () => {
  it('returns proposals when the model calls the report tool', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, { proposals: [validProposal] })]);

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.proposals).toEqual([validProposal]);
  });

  it('drops a proposal that uses equipment outside the catalog', async () => {
    const invalidProposal = { ...validProposal, requiredEquipment: ['Máquina inventada'] };
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, { proposals: [validProposal, invalidProposal] })]);

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.proposals).toEqual([validProposal]);
  });

  it('returns PROVIDER_ERROR when the response has no tool_use block', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([{ type: 'text', text: 'no tool call' } as unknown as Anthropic.ContentBlock]);

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('returns PROVIDER_ERROR when the tool input fails schema validation', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_ADAPTATION_PROPOSALS_TOOL, { proposals: [{ movementId: 'movement-1' }] })]);

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('returns TIMEOUT when the SDK throws a connection timeout error', async () => {
    const createMessage: CreateMessage = async () => {
      throw new APIConnectionTimeoutError();
    };

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('TIMEOUT');
  });

  it('returns PROVIDER_ERROR when the SDK throws any other error', async () => {
    const createMessage: CreateMessage = async () => {
      throw new Error('network down');
    };

    const outcome = await service(createMessage).adapt(card, equipment, 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });
});
