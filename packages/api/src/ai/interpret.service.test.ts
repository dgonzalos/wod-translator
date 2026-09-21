import type Anthropic from '@anthropic-ai/sdk';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT_WOD_SCHEMA_VERSION } from '@wod-translator/shared';
import { InterpretationService, type CreateMessage } from './interpret.service.js';
import { REPORT_INTERPRETATION_TOOL, REPORT_UNSUPPORTED_FORMAT_TOOL } from './interpret-tools.js';

// Only `content` (and, for usage/logging tests, `usage`) is read by
// InterpretationService — the rest of a real Anthropic.Message's required
// fields are irrelevant to this unit's logic.
function fakeMessage(content: Anthropic.ContentBlock[], usage?: Anthropic.Usage): Anthropic.Message {
  return { content, usage } as unknown as Anthropic.Message;
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

function service(createMessage: CreateMessage) {
  return new InterpretationService(createMessage, 'test-model', 25000);
}

describe('InterpretationService', () => {
  it('returns a schema-valid card when the model calls the interpretation tool', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)]);

    const outcome = await service(createMessage).interpret('AMRAP 12min: 15 burpees', 'req-1');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.card.schemaVersion).toBe(CURRENT_WOD_SCHEMA_VERSION);
      expect(outcome.card.movements).toHaveLength(1);
    }
  });

  it('returns UNSUPPORTED_FORMAT when the model calls the unsupported-format tool', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_UNSUPPORTED_FORMAT_TOOL, { reason: 'EMOM structure' })]);

    const outcome = await service(createMessage).interpret('EMOM 20min: 5 pull-ups', 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('returns PROVIDER_ERROR when the response has no tool_use block', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([{ type: 'text', text: 'not a tool call' } as unknown as Anthropic.ContentBlock]);

    const outcome = await service(createMessage).interpret('AMRAP 12min: 15 burpees', 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('returns PROVIDER_ERROR when the tool input fails schema validation', async () => {
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, { format: 'amrap', movements: [] })]);

    const outcome = await service(createMessage).interpret('AMRAP 12min: 15 burpees', 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('returns TIMEOUT when the SDK throws a connection timeout error', async () => {
    const createMessage: CreateMessage = async () => {
      throw new APIConnectionTimeoutError();
    };

    const outcome = await service(createMessage).interpret('AMRAP 12min: 15 burpees', 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('TIMEOUT');
  });

  it('returns PROVIDER_ERROR when the SDK throws any other error', async () => {
    const createMessage: CreateMessage = async () => {
      throw new Error('network down');
    };

    const outcome = await service(createMessage).interpret('AMRAP 12min: 15 burpees', 'req-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('PROVIDER_ERROR');
  });

  it('reports token usage and logs a result without leaking the WOD text', async () => {
    const usage = { input_tokens: 123, output_tokens: 45 } as unknown as Anthropic.Usage;
    const createMessage: CreateMessage = async () =>
      fakeMessage([toolUseBlock(REPORT_INTERPRETATION_TOOL, validInterpretationInput)], usage);
    const logger = { info: vi.fn() };

    const secretText = 'AMRAP 12min: 15 burpees, this text must never be logged';
    const outcome = await service(createMessage).interpret(secretText, 'req-1', logger);

    expect(outcome.ok).toBe(true);
    expect(outcome.usage).toEqual({ inputTokens: 123, outputTokens: 45 });
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [loggedObject] = logger.info.mock.calls[0]!;
    expect((loggedObject as { result: string }).result).toBe('success');
    expect(JSON.stringify(loggedObject)).not.toContain(secretText);
  });
});
