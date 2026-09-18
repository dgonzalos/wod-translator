import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { WodObjectSchema } from '@wod-translator/shared';

export const REPORT_INTERPRETATION_TOOL = 'report_wod_interpretation';
export const REPORT_UNSUPPORTED_FORMAT_TOOL = 'report_unsupported_format';

// The model never sets schemaVersion — the route stamps CURRENT_WOD_SCHEMA_VERSION
// on the input after the call, so it isn't part of what we ask the model for.
// WodObjectSchema (pre-superRefine) is used here because .omit() isn't
// available on WodSchema's ZodEffects wrapper.
export const WodInterpretationInputSchema = WodObjectSchema.omit({ schemaVersion: true });
export type WodInterpretationInput = z.infer<typeof WodInterpretationInputSchema>;

export const UnsupportedFormatInputSchema = z.object({
  reason: z.string().min(1).max(300),
});
export type UnsupportedFormatInput = z.infer<typeof UnsupportedFormatInputSchema>;

function toToolInputSchema(schema: z.ZodTypeAny): Anthropic.Tool['input_schema'] {
  const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema as Anthropic.Tool['input_schema'];
}

/**
 * Zod's built-in toJSONSchema can't encode WodSchema's `.superRefine`
 * cross-field invariants (format-specific nulls, unique movement ids) — the
 * model won't see them as constraints. The route re-validates with the real
 * WodSchema after the call, so a violation here is a wasted-retry risk, not
 * a safety gap (same caveat as ticketing-system's admin-tools.ts, which hits
 * the equivalent limitation with the third-party zod-to-json-schema package).
 */
export function buildInterpretTools(): Anthropic.Tool[] {
  return [
    {
      name: REPORT_INTERPRETATION_TOOL,
      description:
        'Report the structured interpretation of a supported single-block AMRAP or For Time workout. Only call this for supported formats.',
      input_schema: toToolInputSchema(WodInterpretationInputSchema),
    },
    {
      name: REPORT_UNSUPPORTED_FORMAT_TOOL,
      description:
        'Report that the workout text is not a single AMRAP or For Time block (e.g. EMOM, multiple blocks, complex intervals, rep ladders, %1RM) and cannot be interpreted in this version.',
      input_schema: toToolInputSchema(UnsupportedFormatInputSchema),
    },
  ];
}
