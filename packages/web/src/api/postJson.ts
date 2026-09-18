import { ApiErrorSchema, type ApiError } from '@wod-translator/shared';
import type { ZodType } from 'zod';

export type JsonOutcome<T> = { ok: true; data: T } | { ok: false; error: ApiError };

function genericProviderError(): ApiError {
  return {
    code: 'PROVIDER_ERROR',
    message: 'No se pudo contactar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    requestId: 'client-error',
  };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  responseSchema: ZodType<T>,
  signal?: AbortSignal,
): Promise<JsonOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An abort must keep throwing — callers (useWodTranslator) treat that as
    // "a newer action superseded this request", not a real failure. Anything
    // else (offline, DNS, connection refused) becomes a PROVIDER_ERROR.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { ok: false, error: genericProviderError() };
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(json);
    return { ok: false, error: parsedError.success ? parsedError.data : genericProviderError() };
  }

  const parsedResponse = responseSchema.safeParse(json);
  if (!parsedResponse.success) {
    return { ok: false, error: genericProviderError() };
  }
  return { ok: true, data: parsedResponse.data };
}
