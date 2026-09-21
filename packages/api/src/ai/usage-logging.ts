import type Anthropic from '@anthropic-ai/sdk';
import type { FastifyBaseLogger } from 'fastify';

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export type InfoLogger = Pick<FastifyBaseLogger, 'info'>;

export const noopLogger: InfoLogger = { info: () => {} };

export function usageOf(response: Anthropic.Message): AiUsage | undefined {
  if (!response.usage) return undefined;
  return { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}
