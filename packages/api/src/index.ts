import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';
import { registerHealthRoute } from './routes/health.js';
import { registerParseRoute } from './routes/parse.js';
import { InterpretationService, type CreateMessage } from './ai/interpret.service.js';

function readPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined) return 3000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid PORT env var: ${JSON.stringify(raw)} is not a number`);
  }
  return parsed;
}

function readTimeoutMs(): number {
  const raw = process.env.REQUEST_TIMEOUT_MS;
  if (raw === undefined) return 25000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid REQUEST_TIMEOUT_MS env var: ${JSON.stringify(raw)} is not a number`);
  }
  return parsed;
}

/**
 * Constructed lazily, on first call, rather than at buildApp() time — so a
 * missing ANTHROPIC_API_KEY doesn't crash the whole server at boot (e.g. in
 * dev or CI with no .env configured). InterpretationService catches the
 * throw and reports it as PROVIDER_ERROR instead.
 */
function createDefaultMessageFn(): CreateMessage {
  let client: Anthropic | undefined;
  return async (params, options) => {
    if (!client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      client = new Anthropic({ apiKey });
    }
    return client.messages.create(params, options);
  };
}

export interface BuildAppDeps {
  createMessage?: CreateMessage;
}

export function buildApp(deps: BuildAppDeps = {}) {
  const app = Fastify({ logger: true });
  app.register(helmet);
  // TODO(Phase 5): restrict origin and configure the trusted proxy before
  // enabling real AI calls — CORS alone is not abuse protection (spec §10).
  app.register(cors, { origin: true });
  registerHealthRoute(app);

  const createMessage = deps.createMessage ?? createDefaultMessageFn();
  // Read lazily-tolerant, like the API key above: an empty/missing model
  // isn't validated at boot, it just makes the eventual Anthropic call fail
  // (a BadRequestError), which InterpretationService already maps to
  // PROVIDER_ERROR — so a misconfigured server degrades per-request instead
  // of refusing to start (keeps `pnpm dev`/tests usable with no .env).
  const model = process.env.ANTHROPIC_MODEL ?? '';
  const interpretationService = new InterpretationService(createMessage, model, readTimeoutMs());
  registerParseRoute(app, interpretationService);

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildApp();
  app.listen({ port: readPort(), host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
