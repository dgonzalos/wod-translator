import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@wod-translator/shared';
import { buildApp } from '../index.js';

describe('GET /api/health', () => {
  it('returns a schema-valid ok status without calling any AI provider', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
  });
});

describe('unregistered AI routes', () => {
  it('POST /api/adapt is not registered this phase', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'POST', url: '/api/adapt' });
    expect(response.statusCode).toBe(404);
  });
});
