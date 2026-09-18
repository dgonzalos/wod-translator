import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * Zod's built-in toJSONSchema can't encode `.superRefine` cross-field
 * invariants — callers that validate against a `.superRefine`-wrapped schema
 * (e.g. WodSchema) must re-validate with the real schema after the model
 * call; a violation the model doesn't see here is a wasted-retry risk, not a
 * safety gap (same caveat ticketing-system's admin-tools.ts notes for the
 * third-party zod-to-json-schema package).
 */
export function toToolInputSchema(schema: z.ZodTypeAny): Anthropic.Tool['input_schema'] {
  const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema as Anthropic.Tool['input_schema'];
}
