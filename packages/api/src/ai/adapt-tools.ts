import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AdaptationProposalSchema } from '@wod-translator/shared';
import { toToolInputSchema } from './zod-tool-schema.js';

export const REPORT_ADAPTATION_PROPOSALS_TOOL = 'report_adaptation_proposals';

// No "unsupported" escape hatch here — the card's format was already
// validated at parse time, so the model only ever has one thing to report.
export const AdaptationProposalsInputSchema = z.object({
  proposals: z.array(AdaptationProposalSchema).max(10),
});
export type AdaptationProposalsInput = z.infer<typeof AdaptationProposalsInputSchema>;

export function buildAdaptTools(): Anthropic.Tool[] {
  return [
    {
      name: REPORT_ADAPTATION_PROPOSALS_TOOL,
      description:
        'Report equipment-substitution proposals for the movements in the given WOD card that require equipment the user does not have. Only propose substitutes for movements that actually need it.',
      input_schema: toToolInputSchema(AdaptationProposalsInputSchema),
    },
  ];
}
