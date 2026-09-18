import { ApiErrorSchema, ParseResponseSchema, type ApiError, type Wod } from '@wod-translator/shared';

// Real POST /api/parse client — same ParseOutcome shape mockParse used, so
// callers (useWodTranslator) didn't need to change beyond the import.
export type ParseOutcome = { ok: true; requestId: string; card: Wod } | { ok: false; error: ApiError };

function genericProviderError(): ApiError {
  return {
    code: 'PROVIDER_ERROR',
    message: 'No se pudo contactar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    requestId: 'client-error',
  };
}

export async function parseWod(text: string, signal?: AbortSignal): Promise<ParseOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (error) {
    // An abort must keep throwing — useWodTranslator treats that as "a newer
    // action superseded this request", not a real failure. Anything else
    // (offline, DNS, connection refused) becomes a reportable PROVIDER_ERROR.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { ok: false, error: genericProviderError() };
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(json);
    return { ok: false, error: parsedError.success ? parsedError.data : genericProviderError() };
  }

  const parsedResponse = ParseResponseSchema.safeParse(json);
  if (!parsedResponse.success) {
    return { ok: false, error: genericProviderError() };
  }
  return { ok: true, requestId: parsedResponse.data.requestId, card: parsedResponse.data.card };
}
