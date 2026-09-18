import type { ApiErrorCode } from '@wod-translator/shared';

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNSUPPORTED_FORMAT: 422,
  RATE_LIMITED: 429,
  PROVIDER_ERROR: 502,
  TIMEOUT: 504,
};
