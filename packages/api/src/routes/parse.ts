import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ParseRequestSchema } from '@wod-translator/shared';
import type { InterpretationService } from '../ai/interpret.service.js';
import type { QuotaManager } from '../rate-limit/quota.js';
import { quotaRejectionMessage } from '../rate-limit/quota.js';
import { ERROR_STATUS } from './error-status.js';

export function registerParseRoute(app: FastifyInstance, service: InterpretationService, quota: QuotaManager) {
  app.post('/api/parse', async (request, reply) => {
    const parsedRequest = ParseRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      const requestId = randomUUID();
      return reply.status(ERROR_STATUS.INVALID_INPUT).send({
        code: 'INVALID_INPUT',
        message: 'El texto del WOD es obligatorio y no puede superar los 2000 caracteres.',
        requestId,
      });
    }

    const reservation = quota.reserve(request.ip);
    if (!reservation.ok) {
      const requestId = randomUUID();
      return reply.status(ERROR_STATUS.RATE_LIMITED).send({
        code: 'RATE_LIMITED',
        message: quotaRejectionMessage(reservation.reason),
        requestId,
      });
    }

    const requestId = randomUUID();
    let usage;
    try {
      const outcome = await service.interpret(parsedRequest.data.text, requestId, request.log);
      usage = outcome.usage;
      if (outcome.ok) {
        return reply.status(200).send({ requestId, card: outcome.card });
      }
      return reply.status(ERROR_STATUS[outcome.error.code]).send(outcome.error);
    } finally {
      reservation.release(usage);
    }
  });
}
