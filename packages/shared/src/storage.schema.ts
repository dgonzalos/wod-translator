import { z } from 'zod';
import { AdaptationProposalSchema } from './adaptation.schema.js';
import { WodSchema } from './wod.schema.js';

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export const SavedWodEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  originalText: z.string().min(1).max(2000),
  reviewedCard: WodSchema,
  acceptedProposals: z.array(AdaptationProposalSchema).max(10),
  savedAt: z.string().datetime(),
});
export type SavedWodEnvelope = z.infer<typeof SavedWodEnvelopeSchema>;
