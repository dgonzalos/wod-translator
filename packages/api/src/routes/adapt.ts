import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AdaptRequestSchema } from '@wod-translator/shared';
import type { AdaptationService } from '../ai/adapt.service.js';
import { ERROR_STATUS } from './error-status.js';

export function registerAdaptRoute(app: FastifyInstance, service: AdaptationService) {
  app.post('/api/adapt', async (request, reply) => {
    // Also re-validates the full WodSchema (including its superRefine
    // invariants) — the reviewed card is never trusted just because it came
    // from a POST body (spec §8: don't assume it really came from review).
    const parsedRequest = AdaptRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      const requestId = randomUUID();
      return reply.status(ERROR_STATUS.INVALID_INPUT).send({
        code: 'INVALID_INPUT',
        message: 'La ficha o el material indicado no son válidos.',
        requestId,
      });
    }

    const requestId = randomUUID();
    const outcome = await service.adapt(parsedRequest.data.card, parsedRequest.data.equipment, requestId);
    if (outcome.ok) {
      return reply.status(200).send({ requestId, proposals: outcome.proposals });
    }
    return reply.status(ERROR_STATUS[outcome.error.code]).send(outcome.error);
  });
}
