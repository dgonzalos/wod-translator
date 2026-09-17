import type { FastifyInstance } from 'fastify';
import { HealthResponseSchema } from '@wod-translator/shared';

export function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async () => HealthResponseSchema.parse({ status: 'ok' }));
}
