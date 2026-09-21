import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Anthropic from '@anthropic-ai/sdk';
import { registerHealthRoute } from './routes/health.js';
import { registerParseRoute } from './routes/parse.js';
import { registerAdaptRoute } from './routes/adapt.js';
import { InterpretationService } from './ai/interpret.service.js';
import { AdaptationService } from './ai/adapt.service.js';
import { createStubMessageFn } from './ai/stub-client.js';
import type { CreateMessage } from './ai/anthropic-client.js';
import { QuotaManager, type QuotaConfig } from './rate-limit/quota.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

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

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name} env var: ${JSON.stringify(raw)} is not a number`);
  }
  return parsed;
}

/** Fastify's hop-count form of `trustProxy`: only that many `X-Forwarded-For`
 * entries (from the right) are trusted, so a client can't spoof `request.ip`
 * by adding extra forged hops. `0` (the default) trusts none — correct for
 * local dev; a real deployment behind a proxy must set this to match the
 * platform's actual hop count (spec §10). */
function readTrustProxyHops(): number {
  return readIntEnv('TRUST_PROXY_HOPS', 0);
}

function readQuotaConfig(): QuotaConfig {
  return {
    perIpPerHour: readIntEnv('RATE_LIMIT_PER_IP_PER_HOUR', 5),
    globalMaxConcurrency: readIntEnv('GLOBAL_MAX_CONCURRENCY', 3),
    // An IP-independent ceiling, so no amount of source-address diversity
    // can push total AI-calling throughput past this regardless of the
    // per-IP limit above.
    globalRequestsPerMinute: readIntEnv('GLOBAL_REQUESTS_PER_MINUTE', 20),
    // Rolling per-hour budget, not a lifetime total — see QuotaManager.
    globalTokenBudget: process.env.GLOBAL_TOKEN_BUDGET === '' ? null : readIntEnv('GLOBAL_TOKEN_BUDGET', 300000),
  };
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

/**
 * AI_STUB_MODE replaces the real Anthropic client with canned responses
 * (see ./ai/stub-client.ts). Only meant for the E2E suite (packages/e2e) —
 * never set this in a real deployment, it makes every interpret/adapt call
 * return fake data instead of calling the provider.
 */
function resolveDefaultCreateMessage(): CreateMessage {
  return process.env.AI_STUB_MODE === 'true' ? createStubMessageFn() : createDefaultMessageFn();
}

export interface BuildAppDeps {
  createMessage?: CreateMessage;
  quota?: QuotaManager;
  /** Overrides the TRUST_PROXY_HOPS env var — lets tests exercise the hop-counting trustProxy function directly instead of mutating process.env. */
  trustProxyHops?: number;
}

export function buildApp(deps: BuildAppDeps = {}) {
  const trustProxyHops = deps.trustProxyHops ?? readTrustProxyHops();
  // Fastify's `trustProxy` has no built-in "hop count" form — express this as
  // a TrustProxyFunction that trusts exactly the nearest `trustProxyHops`
  // forwarded-for entries as proxies (hop 0 = closest to this server), so
  // `request.ip` resolves to the first untrusted (i.e. real client) address.
  const trustProxy: boolean | ((address: string, hop: number) => boolean) =
    trustProxyHops > 0 ? (_address, hop) => hop < trustProxyHops : false;
  const app = Fastify({ logger: true, trustProxy });
  app.register(helmet);
  // CORS stays permissive (origin: true) intentionally: it restricts which
  // browsers can call this API, not which clients — it is not an abuse
  // control (spec §10). Abuse protection is QuotaManager + trustProxy above.
  app.register(cors, { origin: true });

  // Same-origin deploy readiness (spec §10): serving the built web app from
  // this same Fastify process avoids a separate CORS-facing origin in
  // production. Off by default so `pnpm dev` (Vite's own dev server) is
  // unaffected. Assumes the monorepo was built as a unit (`pnpm build` at
  // the repo root) before this process starts — see README's Deploy section.
  if (process.env.SERVE_WEB_DIST === 'true') {
    const webDistRoot = path.resolve(currentDir, '../../web/dist');
    app.register(fastifyStatic, { root: webDistRoot });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) {
        return reply.status(404).send({ code: 'INVALID_INPUT', message: 'Not found', requestId: randomUUID() });
      }
      return reply.sendFile('index.html');
    });
  }

  registerHealthRoute(app);

  const createMessage = deps.createMessage ?? resolveDefaultCreateMessage();
  // Read lazily-tolerant, like the API key above: an empty/missing model
  // isn't validated at boot, it just makes the eventual Anthropic call fail
  // (a BadRequestError), which InterpretationService already maps to
  // PROVIDER_ERROR — so a misconfigured server degrades per-request instead
  // of refusing to start (keeps `pnpm dev`/tests usable with no .env).
  const model = process.env.ANTHROPIC_MODEL ?? '';
  const timeoutMs = readTimeoutMs();
  const quota = deps.quota ?? new QuotaManager(readQuotaConfig());
  const interpretationService = new InterpretationService(createMessage, model, timeoutMs);
  registerParseRoute(app, interpretationService, quota);
  const adaptationService = new AdaptationService(createMessage, model, timeoutMs);
  registerAdaptRoute(app, adaptationService, quota);

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildApp();
  app.listen({ port: readPort(), host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
