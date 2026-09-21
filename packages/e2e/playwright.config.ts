import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @wod-translator/api dev',
      url: 'http://localhost:3000/api/health',
      // AI_STUB_MODE swaps the real Anthropic client for canned responses
      // (see packages/api/src/ai/stub-client.ts) — no ANTHROPIC_API_KEY
      // needed, and no real provider call is ever made by this suite.
      env: { AI_STUB_MODE: 'true' },
      // Always start fresh, never reuse an already-running dev server —
      // reusing one would silently run against a real provider instead of
      // the stub.
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @wod-translator/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
