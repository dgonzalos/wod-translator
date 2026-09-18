# WOD Translator

> **🚧 Work in progress.** This is a portfolio project being built in phases.

Paste a free-text CrossFit workout (WOD), in Spanish or English, and get back a structured, editable card: format, duration/rounds, and an ordered list of movements with quantities and load alternatives — interpreted by an LLM, validated against a strict schema, and always reviewable/correctable against the original text.

It's a small companion piece to the [`ticketing-system`](../ticketing-system) portfolio project: that one demonstrates persistence, auth, and transactions; this one demonstrates AI integration, data validation, and frontend UX, in a deliberately closed scope (see [`WOD_Translator_MVP_Portfolio.md`](./WOD_Translator_MVP_Portfolio.md), the source of truth for scope and design decisions).

## Status

Built in phases, in this order (see `CLAUDE.md` for the full build order rationale):

- [x] **Phase 1 — Skeleton & contracts.** pnpm workspace, Zod data contracts (`packages/shared`), three precomputed example WODs that work with zero AI calls.
- [x] **Phase 2 — Full UI on mocked data.** All review/edit screens, the interpret/edit/stale-invalidation state machine, wired to a mock interpreter.
- [x] **Phase 3 — Real interpretation backend.** `POST /api/parse` calls Anthropic for real, validates the response against the same schema the UI trusts, and maps every failure mode (unsupported format, timeout, provider error) to a typed error the frontend already understands.
- [ ] **Phase 4 — Adaptation, copy, local save.** `POST /api/adapt` (equipment substitution proposals), the accept/reject UI, copy-to-clipboard, and localStorage persistence of the last WOD. *Not started.*
- [ ] **Phase 5 — Limits, tests, deploy.** Per-IP/global rate limiting, trusted-proxy config, the 10-case manual model evaluation, and an actual deployment. *Not started.*

Until Phase 5 lands, there is no rate limiting on `/api/parse` — don't point a public deployment at it with a real API key.

## What it does (today)

- Paste a WOD, or load one of three built-in examples (no AI call, always available).
- The backend sends your text to Claude, asks it to extract only what's explicitly present (never inventing quantities, units, or loads), and to flag anything ambiguous or unsupported instead of guessing.
- Only a single AMRAP or For Time block is supported; anything else (EMOM, multiple blocks, rep ladders, %1RM) is reported as unsupported and your original text is preserved untouched for editing.
- The resulting card is fully editable, and editing the original text invalidates the card until you re-interpret it.

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
| `RATE_LIMIT_PER_IP_PER_HOUR` | not enforced yet | Reserved for Phase 5. |

The API key never reaches the frontend bundle — it's read only in `packages/api`.

## Testing

```bash
pnpm -r typecheck
pnpm -r test
```

All automated tests run against a fake/injected AI client — no API key or network access needed, and no real usage is billed by CI. Real-model behavior (prompt quality, edge cases) hasn't been evaluated yet; that's part of Phase 5.

## Known limitations (current)

- No adaptation, copy, or local save yet — the flow stops at the reviewed card.
- No rate limiting or spend controls — do not deploy this publicly with a real key configured.
- No deployment, screenshots, or demo exist yet.
- Real-model accuracy is unverified; only schema-shape and error-path behavior are covered by automated tests so far.
