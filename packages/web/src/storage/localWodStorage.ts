import { CURRENT_STORAGE_SCHEMA_VERSION, SavedWodEnvelopeSchema, type SavedWodEnvelope } from '@wod-translator/shared';

const STORAGE_KEY = 'wod-translator:last-wod';

export type LoadResult = { status: 'empty' } | { status: 'ok'; envelope: SavedWodEnvelope } | { status: 'invalid' };

// Never throws — a corrupt entry, an incompatible schema version, or
// localStorage being unavailable (private mode, disabled, quota-locked) all
// degrade to a result the caller can react to, per spec §7's "validar la
// estructura; si está corrupto o usa una versión no compatible, ofrecer
// reiniciarlo" and "gestionar errores de cuota o acceso sin bloquear el
// resto de la aplicación".
export function loadSavedWod(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (raw === null) return { status: 'empty' };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { status: 'invalid' };
  }

  const parsed = SavedWodEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.schemaVersion !== CURRENT_STORAGE_SCHEMA_VERSION) {
    return { status: 'invalid' };
  }
  return { status: 'ok', envelope: parsed.data };
}

export function saveWod(envelope: SavedWodEnvelope): { ok: true } | { ok: false; message: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, message: 'No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).' };
  }
}

export function clearSavedWod(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from here — same tolerance as saveWod/loadSavedWod.
  }
}
