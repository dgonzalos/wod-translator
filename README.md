# WOD Translator

> **🚧 Work in progress.** This is a portfolio project being built in phases.

Paste a free-text CrossFit workout (WOD), in Spanish or English, and get back a structured, editable card: format, duration/rounds, and an ordered list of movements with quantities and load alternatives — interpreted by an LLM, validated against a strict schema, and always reviewable/correctable against the original text.

It's a small companion piece to the [`ticketing-system`](../ticketing-system) portfolio project: that one demonstrates persistence, auth, and transactions; this one demonstrates AI integration, data validation, and frontend UX, in a deliberately closed scope (see [`WOD_Translator_MVP_Portfolio.md`](./WOD_Translator_MVP_Portfolio.md), the source of truth for scope and design decisions).

## Status

Built in phases, in this order (see `CLAUDE.md` for the full build order rationale):

- [x] **Phase 1 — Skeleton & contracts.** pnpm workspace, Zod data contracts (`packages/shared`), three precomputed example WODs that work with zero AI calls.
- [x] **Phase 2 — Full UI on mocked data.** All review/edit screens, the interpret/edit/stale-invalidation state machine, wired to a mock interpreter.
- [x] **Phase 3 — Real interpretation backend.** `POST /api/parse` calls Anthropic for real, validates the response against the same schema the UI trusts, and maps every failure mode (unsupported format, timeout, provider error) to a typed error the frontend already understands.
- [x] **Phase 4 — Adaptation, copy, local save.** `POST /api/adapt` proposes equipment substitutions from a small fixed catalog (never auto-applied — each is accepted/rejected in the UI), plus copy-to-clipboard (with a manual-selection fallback) and localStorage save/restore of the last WOD, with corrupt/incompatible saves reset automatically.
- [x] **Phase 5 — Limits, tests, deploy.** Per-IP/global rate limiting with trusted-proxy config, structured request logging, an AI-disclosure notice in the UI, an E2E test, and deploy-readiness (no live deployment — see [Deploy](#deploy)).

`/api/parse` and `/api/adapt` now enforce a shared per-IP hourly quota, a one-in-flight-per-IP limit, a global concurrency cap, and a global token-spend budget, all in-memory (see [Known limitations](#known-limitations-current)).

## What it does (today)

- Paste a WOD, or load one of three built-in examples (no AI call, always available).
- The backend sends your text to Claude, asks it to extract only what's explicitly present (never inventing quantities, units, or loads), and to flag anything ambiguous or unsupported instead of guessing.
- Only a single AMRAP or For Time block is supported; anything else (EMOM, multiple blocks, rep ladders, %1RM) is reported as unsupported and your original text is preserved untouched for editing.
- The resulting card is fully editable, and editing the original text invalidates the card until you re-interpret it.
- Once the card is fully reviewed, declare your available equipment and ask for substitution proposals; each one is shown with its reason and caveats and only takes effect if you explicitly accept it. Editing the card afterwards discards the proposals, since they no longer apply.
- Copy a plain-text summary of the reviewed (and optionally adapted) WOD, or save the single most recent one in this browser to pick up again after a reload.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, CSS Modules, local component state (no router, no global store) |
| Backend | Node.js + Fastify + TypeScript |
| Contracts | Zod schemas shared between frontend and backend (`packages/shared`) |
| AI | Anthropic SDK, single provider, no streaming, forced tool-use for structured output |
| Tests | Vitest (+ React Testing Library for component tests) |

## Architecture

A pnpm workspace with three packages:

| Package | Role |
|---|---|
| `packages/shared` | Zod schemas and TS types for the WOD contract and API request/response shapes. |
| `packages/api` | Fastify server. Holds the Anthropic API key, calls the model, validates its output before trusting it. |
| `packages/web` | The UI: paste → review/edit → (soon) adapt → (soon) copy/save. |

The backend never trusts a schema-shaped AI response as necessarily accurate — the UI always allows comparison against the original text and manual correction. See `CLAUDE.md` for the full set of invariants (never-invent-a-value, stale-request handling, etc.) enforced throughout.

## Getting started

Requires Node (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm --filter @wod-translator/shared build   # shared must produce dist/ first
pnpm dev                                     # runs web + api in parallel
```

The web dev server runs on `:5173` and proxies `/api/*` to the Fastify server on `:3000`.

### Environment variables

Copy `.env.example` and fill in `packages/api`'s variables:

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | Defaults to `3000`. |
| `ANTHROPIC_API_KEY` | for real AI calls | Without it, `/api/parse` still runs but every real interpretation request fails with a `PROVIDER_ERROR` — the three built-in examples work regardless. |
| `ANTHROPIC_MODEL` | for real AI calls | No default is hardcoded; pick a model after evaluating it against real WOD text. |
| `REQUEST_TIMEOUT_MS` | no | Defaults to `25000`. |
| `RATE_LIMIT_PER_IP_PER_HOUR` | no | Defaults to `5`. Shared between `/api/parse` and `/api/adapt` (one hourly quota per IP, not 5 each). |
| `GLOBAL_MAX_CONCURRENCY` | no | Defaults to `3`. Caps AI-calling requests in flight across all clients. |
| `GLOBAL_REQUESTS_PER_MINUTE` | no | Defaults to `20`. Caps AI-calling requests per rolling minute across all clients — independent of source IP, so no amount of IP rotation can push total throughput past this. |
| `GLOBAL_TOKEN_BUDGET` | no | Defaults to `300000`. Input+output tokens allowed per **rolling hour** across all clients (not a lifetime total — a burst throttles for the rest of that hour, then recovers on its own); leave empty for unlimited (not recommended in production). |
| `TRUST_PROXY_HOPS` | no | Defaults to `0` (no proxy trusted). Set to the number of proxy hops in front of this server in a real deployment, or per-IP rate limiting either merges every client into one bucket or becomes spoofable via a forged `X-Forwarded-For` header. |
| `SERVE_WEB_DIST` | no | Defaults to unset. Set to `true` to have this server also serve `packages/web/dist` (see [Deploy](#deploy)); leave unset for local dev, where Vite's own dev server handles the frontend. |
| `AI_STUB_MODE` | no | Defaults to unset. Set to `true` to replace the real Anthropic client with canned responses. Only used by `packages/e2e`'s test suite — **never set this in a real deployment.** |

The API key never reaches the frontend bundle — it's read only in `packages/api`.

## Testing

```bash
pnpm -r typecheck
pnpm -r test          # unit/component tests, excludes packages/e2e
pnpm test:e2e          # one Playwright flow: example → edit → adapt → save → reload → copy, AI stubbed
```

All automated tests (including the E2E suite) run against a fake/injected or stubbed AI client — no API key or network access needed, and no real usage is billed by CI.

Real-model behavior is evaluated separately and manually, since judging interpretation quality needs a human and shouldn't run on CI's or a contributor's API budget automatically:

```bash
pnpm --filter @wod-translator/api dev     # in one terminal, with a real ANTHROPIC_API_KEY/ANTHROPIC_MODEL
pnpm --filter @wod-translator/api eval    # in another — POSTs 10 fixed cases, dumps raw results to a JSON file
```

Then review the dump by hand against `packages/api/scripts/eval/RESULTS_TEMPLATE.md` and record findings in a committed `packages/api/scripts/eval/EVAL_RESULTS.md` (not included in this repo until someone runs it — that step is left to whoever deploys with a real key).

## Deploy

The spec's own guidance (§10) is to serve the frontend and API under the same origin via
`/api`, on any Node-compatible host that runs a persistent process (a purely static host can't
run Fastify):

```bash
pnpm install --frozen-lockfile
pnpm build                                          # builds every package, including packages/web/dist
SERVE_WEB_DIST=true pnpm --filter @wod-translator/api start
```

Run from the repo root — `SERVE_WEB_DIST=true` makes the API process also serve
`packages/web/dist`, relying on the monorepo being deployed as a unit (both packages built
together, not deployed as separate services). Set the environment variables above for
production, in particular `TRUST_PROXY_HOPS` (matched to the real platform's proxy hop count)
and `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`.

### Railway (current deployment)

One Railway service runs the whole monorepo as the single monolith process above — no Vercel,
no split frontend/backend hosting, no database. `railway.json` at the repo root pins the build
tooling and start command:

1. Create a Railway project, "Deploy from GitHub repo", pointing at this repo.
2. Root Directory: repo root (`/`), **not** `packages/api` — the build needs the whole
   workspace to produce both `packages/shared/dist` and `packages/web/dist`.
3. Builder: Nixpacks (auto-detected; reads `.nvmrc` and the root `packageManager` field via
   corepack, so no Dockerfile is needed). Build command, start command, and health-check path
   all come from `railway.json`.
4. Set these environment variables in the Railway dashboard (see `.env.example` for the full
   annotated list):

   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | real key |
   | `ANTHROPIC_MODEL` | real model id |
   | `SERVE_WEB_DIST` | `true` |
   | `TRUST_PROXY_HOPS` | start at `1`, verify against Railway's actual proxy hop count post-deploy |
   | `RATE_LIMIT_PER_IP_PER_HOUR`, `REQUEST_TIMEOUT_MS`, `GLOBAL_MAX_CONCURRENCY`, `GLOBAL_REQUESTS_PER_MINUTE`, `GLOBAL_TOKEN_BUDGET` | optional — safe defaults already in code |

   Do **not** set `PORT` (Railway injects its own) or `AI_STUB_MODE` (would silently serve fake
   translations to real users).
5. Confirm the health-check path is `/api/health` — a one-time deploy-gating check, not
   continuous polling. There's no database here, so ticketing-system's "don't wake Neon"
   caution doesn't apply, but check Railway's current idle/sleep policy for whichever plan is
   chosen before ever pointing a continuous uptime monitor at it.

CI (`.github/workflows/ci.yml`) runs build/typecheck/unit tests plus the Playwright e2e suite
(stubbed AI, no secrets required) on every push/PR to `main`.

**Pre-launch checklist:**

- [ ] Run the manual 10-case real-model eval (`pnpm --filter @wod-translator/api eval` against
  a real key) and record results in `packages/api/scripts/eval/EVAL_RESULTS.md` per
  `RESULTS_TEMPLATE.md`.
- [ ] Set a hard spend cap in the Anthropic console (defense in depth beyond
  `GLOBAL_TOKEN_BUDGET`).
- [ ] Verify `TRUST_PROXY_HOPS` against Railway's actual proxy hop count post-deploy, not just
  assumed.
- [ ] Confirm `AI_STUB_MODE` is absent from the Railway service's environment variables.
- [ ] Keep the Railway service at exactly 1 replica — the in-memory rate-limit/budget counters
  don't coordinate across instances (see below).

The in-memory rate-limit/budget counters are single-instance only: they reset on restart and
don't coordinate across multiple instances, so they are not a durable spend limit on their
own (spec §10). Also set a hard spend cap in the Anthropic console as defense in depth. A
multi-instance deployment would need a shared store (e.g. Redis) for the counters — explicitly
out of scope here.

`GLOBAL_TOKEN_BUDGET` and `GLOBAL_REQUESTS_PER_MINUTE` are deliberately IP-independent — they
cap total throughput/spend across every client combined, specifically so that rotating through
many source IPs can't bypass `RATE_LIMIT_PER_IP_PER_HOUR` to exhaust the AI feature for
everyone. The token budget is also a **rolling** hour, not a lifetime total, so an exhausted
budget throttles for the rest of that hour and recovers on its own rather than needing a
manual restart. These controls still can't distinguish one real visitor from an attacker
running many IPs — they only bound the blast radius (a fixed request/token ceiling per window)
and remove the "requires an operator to notice and restart" failure mode; they don't prevent a
sufficiently determined multi-IP attacker from keeping the demo throttled for legitimate users
while their own budget lasts.

## Known limitations (current)

- Rate limiting, the global budget/throughput caps, and the trusted-proxy config are all
  in-memory and single-instance — see [Deploy](#deploy) for what that does and doesn't protect
  against.
- No live deployment, screenshots, or demo exist yet — see [Deploy](#deploy) for readiness.
- Real-model accuracy is spot-checked manually (`pnpm --filter @wod-translator/api eval`), not
  covered by automated tests, and not a benchmark of general accuracy (spec §11).
- The equipment-substitution catalog is a small fixed list (see `packages/shared/src/equipment-catalog.ts`), not a general equipment vocabulary.
