import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ParseRequestSchema } from '@wod-translator/shared';
import type { InterpretationService } from '../ai/interpret.service.js';
import { ERROR_STATUS } from './error-status.js';

export function registerParseRoute(app: FastifyInstance, service: InterpretationService) {
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

    const requestId = randomUUID();
    const outcome = await service.interpret(parsedRequest.data.text, requestId);
    if (outcome.ok) {
      return reply.status(200).send({ requestId, card: outcome.card });
    }
    return reply.status(ERROR_STATUS[outcome.error.code]).send(outcome.error);
  });
}
