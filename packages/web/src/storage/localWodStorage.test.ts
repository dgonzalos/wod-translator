import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_STORAGE_SCHEMA_VERSION, CURRENT_WOD_SCHEMA_VERSION, type SavedWodEnvelope, type Wod } from '@wod-translator/shared';
import { clearSavedWod, loadSavedWod, saveWod } from './localWodStorage';

const card: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 600,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    { id: 'm1', name: 'Burpees', quantity: 10, unit: 'reps', loads: null, originalTextSnippet: '10 burpees' },
  ],
  explanations: [],
  issues: [],
};

const envelope: SavedWodEnvelope = {
  schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  originalText: 'AMRAP 10min: 10 burpees',
  reviewedCard: card,
  acceptedProposals: [],
  savedAt: new Date().toISOString(),
};

describe('localWodStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports empty when nothing is saved', () => {
    expect(loadSavedWod()).toEqual({ status: 'empty' });
  });

  it('round-trips a valid envelope', () => {
    expect(saveWod(envelope)).toEqual({ ok: true });
    expect(loadSavedWod()).toEqual({ status: 'ok', envelope });
  });

  it('treats corrupt JSON as invalid', () => {
    localStorage.setItem('wod-translator:last-wod', '{not json');
    expect(loadSavedWod()).toEqual({ status: 'invalid' });
  });

  it('treats a mismatched schemaVersion as invalid', () => {
    localStorage.setItem('wod-translator:last-wod', JSON.stringify({ ...envelope, schemaVersion: 999 }));
    expect(loadSavedWod()).toEqual({ status: 'invalid' });
  });

  it('clearSavedWod removes the entry', () => {
    saveWod(envelope);
    clearSavedWod();
    expect(loadSavedWod()).toEqual({ status: 'empty' });
  });

  it('saveWod reports a failure instead of throwing when storage rejects the write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const result = saveWod(envelope);
    expect(result.ok).toBe(false);
    setItemSpy.mockRestore();
  });
});
