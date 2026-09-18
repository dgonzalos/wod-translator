import { AdaptResponseSchema, type AdaptationProposal, type ApiError, type EquipmentSelection, type Wod } from '@wod-translator/shared';
import { postJson } from './postJson';

export type AdaptOutcome =
  | { ok: true; requestId: string; proposals: AdaptationProposal[] }
  | { ok: false; error: ApiError };

export async function adaptWod(card: Wod, equipment: EquipmentSelection, signal?: AbortSignal): Promise<AdaptOutcome> {
  const outcome = await postJson('/api/adapt', { card, equipment }, AdaptResponseSchema, signal);
  if (!outcome.ok) return outcome;
  return { ok: true, requestId: outcome.data.requestId, proposals: outcome.data.proposals };
}
