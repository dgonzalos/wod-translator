import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { registerHealthRoute } from './routes/health.js';

function readPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined) return 3000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid PORT env var: ${JSON.stringify(raw)} is not a number`);
  }
  return parsed;
}

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(helmet);
  // TODO(Phase 5): restrict origin and configure the trusted proxy before
  // enabling real AI calls — CORS alone is not abuse protection (spec §10).
  app.register(cors, { origin: true });
  registerHealthRoute(app);
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildApp();
  app.listen({ port: readPort(), host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
