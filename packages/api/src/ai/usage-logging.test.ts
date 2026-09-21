import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { usageOf } from './usage-logging.js';

function fakeMessage(usage?: Anthropic.Usage): Anthropic.Message {
  return { usage } as unknown as Anthropic.Message;
}

describe('usageOf', () => {
  it('maps input_tokens/output_tokens to camelCase', () => {
    const usage = { input_tokens: 12, output_tokens: 34 } as unknown as Anthropic.Usage;
    expect(usageOf(fakeMessage(usage))).toEqual({ inputTokens: 12, outputTokens: 34 });
  });

  it('returns undefined when the response has no usage field', () => {
    expect(usageOf(fakeMessage(undefined))).toBeUndefined();
  });
});
