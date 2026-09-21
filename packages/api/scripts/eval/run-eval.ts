import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVAL_FIXTURES } from './fixtures.js';

// Manual, opt-in evaluation script — never runs as part of `pnpm test`/CI.
// Requires a running `packages/api` dev server (with a real
// ANTHROPIC_API_KEY/ANTHROPIC_MODEL configured) at API_BASE_URL. Results are
// dumped to a timestamped JSON file for a human to review by hand against
// RESULTS_TEMPLATE.md — this script makes no judgement about output quality.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.resolve(__dirname, 'results');
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

interface CaseResult {
  id: string;
  category: string;
  parse: { status: number; latencyMs: number; body: unknown };
  adapt?: { status: number; latencyMs: number; body: unknown };
}

async function postJson(url: string, payload: unknown): Promise<{ status: number; latencyMs: number; body: unknown }> {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, latencyMs: Date.now() - startedAt, body };
}

async function main() {
  console.log(`Running ${EVAL_FIXTURES.length} eval cases against ${apiBaseUrl} ...`);
  const results: CaseResult[] = [];

  for (const fixture of EVAL_FIXTURES) {
    const parse = await postJson(`${apiBaseUrl}/api/parse`, { text: fixture.text });
    const result: CaseResult = { id: fixture.id, category: fixture.category, parse };

    if (fixture.andThenAdapt && parse.status === 200 && parse.body && typeof parse.body === 'object' && 'card' in parse.body) {
      const card = (parse.body as { card: unknown }).card;
      result.adapt = await postJson(`${apiBaseUrl}/api/adapt`, { card, equipment: fixture.andThenAdapt });
    }

    results.push(result);
    const adaptSummary = result.adapt ? `, adapt=${result.adapt.status}` : '';
    console.log(`  ${fixture.id.padEnd(14)} [${fixture.category.padEnd(11)}] parse=${parse.status}${adaptSummary} (${parse.latencyMs}ms)`);
  }

  mkdirSync(resultsDir, { recursive: true });
  const outFile = path.join(resultsDir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nWrote raw results to ${outFile}`);
  console.log('Review them by hand against RESULTS_TEMPLATE.md and record findings in EVAL_RESULTS.md.');
}

main().catch((error) => {
  console.error('eval run failed:', error);
  process.exit(1);
});
