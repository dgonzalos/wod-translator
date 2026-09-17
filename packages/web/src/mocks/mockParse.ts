import { CURRENT_WOD_SCHEMA_VERSION, type ApiError, type Wod } from '@wod-translator/shared';

// MOCK — placeholder for the next phase's real POST /api/parse call.
// Keep this exact ParseOutcome shape (mirrors ParseResponseSchema/ApiErrorSchema
// from @wod-translator/shared) so swapping the body for a real fetch is a
// drop-in change at its one call site in useWodTranslator.
export type ParseOutcome = { ok: true; requestId: string; card: Wod } | { ok: false; error: ApiError };

const SIMULATED_LATENCY_MS = 600;

const GENERIC_MOCK_CARD: Wod = {
  schemaVersion: CURRENT_WOD_SCHEMA_VERSION,
  format: 'amrap',
  durationSeconds: 720,
  rounds: null,
  timeCapSeconds: null,
  movements: [
    {
      id: 'movement-1',
      name: 'Kettlebell swings',
      quantity: 20,
      unit: 'reps',
      loads: [
        { value: 24, unit: 'kg' },
        { value: 16, unit: 'kg' },
      ],
      originalTextSnippet: '20 KB swings 24/16 kg',
    },
    {
      id: 'movement-2',
      name: 'Burpees',
      quantity: 15,
      unit: 'reps',
      loads: null,
      originalTextSnippet: '15 burpees',
    },
  ],
  explanations: [{ abbreviation: 'KB', definition: 'Kettlebell: pesa rusa con asa.' }],
  issues: [
    {
      field: 'movements',
      message: 'Resultado simulado: revisa los movimientos detectados antes de continuar.',
    },
  ],
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    });
  });
}

export async function mockParse(text: string, signal?: AbortSignal): Promise<ParseOutcome> {
  await delay(SIMULATED_LATENCY_MS, signal);
  const requestId = `mock-${crypto.randomUUID()}`;
  const lower = text.toLowerCase();

  if (lower.includes('emom')) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_FORMAT',
        message: 'Este formato (EMOM) no está soportado todavía. Conserva el texto para editarlo.',
        requestId,
      },
    };
  }
  if (lower.includes('timeout')) {
    return {
      ok: false,
      error: { code: 'TIMEOUT', message: 'La interpretación tardó demasiado. Inténtalo de nuevo.', requestId },
    };
  }
  if (lower.includes('provider')) {
    return {
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'El proveedor de IA no respondió correctamente.', requestId },
    };
  }

  return { ok: true, requestId, card: structuredClone(GENERIC_MOCK_CARD) };
}
