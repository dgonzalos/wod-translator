import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(__dirname, '..');

// No database or other external state to provision for this app (unlike the
// sibling ticketing-system repo's e2e runner) — this is currently a thin
// wrapper around `playwright test`, kept as its own script (rather than
// inlining "playwright test" directly into package.json) to match that
// repo's convention and leave one obvious place to add e2e-specific setup
// later, if this suite grows more scenarios.
const extraArgs = process.argv.slice(2).join(' ');

try {
  execSync(`playwright test ${extraArgs}`.trim(), { stdio: 'inherit', cwd: e2eDir });
} catch (error) {
  const status = (error as { status?: number }).status;
  process.exit(typeof status === 'number' ? status : 1);
}
