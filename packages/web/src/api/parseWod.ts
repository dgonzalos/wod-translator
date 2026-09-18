import { ParseResponseSchema, type ApiError, type Wod } from '@wod-translator/shared';
import { postJson } from './postJson';

// Real POST /api/parse client — same ParseOutcome shape mockParse used, so
// callers (useWodTranslator) didn't need to change beyond the import.
export type ParseOutcome = { ok: true; requestId: string; card: Wod } | { ok: false; error: ApiError };

export async function parseWod(text: string, signal?: AbortSignal): Promise<ParseOutcome> {
  const outcome = await postJson('/api/parse', { text }, ParseResponseSchema, signal);
  if (!outcome.ok) return outcome;
  return { ok: true, requestId: outcome.data.requestId, card: outcome.data.card };
}
