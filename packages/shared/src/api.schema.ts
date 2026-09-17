import { z } from 'zod';
import { AdaptationProposalSchema, EquipmentSelectionSchema } from './adaptation.schema.js';
import { WodSchema } from './wod.schema.js';

// 400 INVALID_INPUT, 422 UNSUPPORTED_FORMAT, 429 RATE_LIMITED, 502 PROVIDER_ERROR, 504 TIMEOUT
export const API_ERROR_CODES = [
  'INVALID_INPUT',
  'UNSUPPORTED_FORMAT',
  'RATE_LIMITED',
  'PROVIDER_ERROR',
  'TIMEOUT',
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string().min(1).max(500),
  requestId: z.string().min(1).max(100),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ParseRequestSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

export const ParseResponseSchema = z.object({
  requestId: z.string().min(1).max(100),
  card: WodSchema,
});
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

// The card is re-validated independently server-side — never trusted to
// actually be the reviewed card from the review screen.
export const AdaptRequestSchema = z.object({
  card: WodSchema,
  equipment: EquipmentSelectionSchema,
});
export type AdaptRequest = z.infer<typeof AdaptRequestSchema>;

export const AdaptResponseSchema = z.object({
  requestId: z.string().min(1).max(100),
  proposals: z.array(AdaptationProposalSchema).max(10),
});
export type AdaptResponse = z.infer<typeof AdaptResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
