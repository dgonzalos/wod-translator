# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

All 5 phases of the build order (see §12 below) are complete: the pnpm workspace (`packages/shared`, `packages/web`, `packages/api`, `packages/e2e`), real `POST /api/parse` and `POST /api/adapt` backed by the Anthropic SDK, the full review/adapt UI, copy-to-clipboard, localStorage save/restore, per-IP/global rate limiting with trusted-proxy config, structured request logging, an AI-disclosure notice, and an E2E test. What's left is not code: the 10-case manual real-model evaluation (`pnpm --filter @wod-translator/api eval`, run by hand against a real key) and an actual live deployment — see `README.md`'s Deploy section. There is no lint tooling yet.

Commands (run from the repo root):
- Install: `pnpm install`
- Build (run before typecheck/test on a fresh clone — `packages/shared` must produce `dist/` first): `pnpm -r build`
- Typecheck: `pnpm -r typecheck`
- Test (unit/component tests, excludes `packages/e2e`): `pnpm test`
- E2E test (one Playwright flow against stubbed AI, no API key needed): `pnpm test:e2e`
- Dev (all packages in parallel): `pnpm dev`
- Single package: `pnpm --filter @wod-translator/<shared|web|api|e2e> <script>`

Treat `WOD_Translator_MVP_Portfolio.md` as the single source of truth for scope and design decisions; the summary below is a distillation of it, not a replacement.

## What this project is

A small, deliberately finished portfolio piece: paste a free-text CrossFit workout (WOD) in Spanish or English → AI interprets it into a structured, editable card → user reviews/corrects → optionally gets AI-proposed equipment substitutions → copies or saves the result locally. Target effort is 16–24 hours; it exists to demonstrate AI integration, data validation, and frontend UX, as a smaller companion to the `ticketing-system` portfolio project (which demonstrates persistence/auth/transactions instead).

## Scope discipline (read before adding anything)

The spec's scope is closed intentionally. **Do not add** features from this exclusion list even if they seem like natural next steps: login/auth/JWT/profiles, any database or server-side history (only the *single most recent* WOD persists, in the browser's localStorage), a list of saved workouts, athletic results/records/rankings/calendar, training programming or injury advice, OCR/image/audio/video input, free chat/agents/RAG/web search/vector DB, payments/subscriptions/social features, a standalone UI kit, microservices, or a native mobile app.

**Only one workout format is supported**: a single AMRAP or For Time block with constant quantities per movement (For Time may have fixed rounds + a time cap). EMOM, multi-block workouts, complex intervals, rep ladders, and %1RM are explicitly unsupported — when encountered, the app must say so and preserve the original text for editing. **Never silently reinterpret an unsupported format as a supported one.**

Guard rails baked into the requirements (RF-01–RF-11 in the spec):
- Original user text is never lost on a failed request.
- Unknown/absent fields stay `null` — the model must not invent quantities, units, or loads that aren't in the source text.
- AI-proposed substitutions are never auto-applied; each is explicitly accepted or rejected by the user.
- Editing the original text invalidates the current card (needs reinterpretation); editing the card after requesting an adaptation invalidates that adaptation. Stale/late responses from a superseded request must not overwrite newer edits.
- Save and copy actions never call the AI. Adaptation is only available once ambiguous fields are resolved.
- Three precomputed example WODs must work with zero AI calls (used both as a demo and to keep the app usable when rate limits are hit).

## Planned architecture (per spec §6–§8; not yet built)

pnpm workspace monorepo, following the same package split as the sibling `ticketing-system` repo but without its auth/DB/payments layers:

| Package | Role |
|---|---|
| `packages/web` | React + Vite + TS, single-screen UI (Entrada / Revisión / Adaptación-Salida), CSS Modules, local React state only — no router, no Redux/TanStack Query. |
| `packages/api` | Node + Fastify + TS. Holds the AI provider key server-side, validates input/output, enforces rate limits. Routes: `POST /api/parse`, `POST /api/adapt`, `GET /api/health`. |
| `packages/shared` | Zod schemas + shared TS types for the WOD contract and API request/response shapes, imported via `workspace:*` by both web and api. |

Data contract essentials (spec §7): the structured WOD has `schemaVersion`, `format` (`amrap`/`for_time`), `durationSeconds`, `rounds`, `timeCapSeconds`, an ordered `movements` list (id, name, quantity, unit, **list** of load alternatives — never collapse alternatives like `40/30 kg` into one value, and never pick a default), `explanations`, and `issues`. Max 10 movements. The localStorage envelope stores original text + reviewed card + accepted proposals + date + schema version, and must be validated on read with a graceful reset path if corrupt or from an incompatible schema version.

Adaptation responses are a separate list of proposals (original movement id, substitute, required equipment, reason, caveats) — acceptance/rejection state lives in the frontend, not the backend.

## AI usage rules (spec §9–§10)

- Single configurable provider (Anthropic SDK, matching `ticketing-system`), no streaming, two versioned prompts (interpret, adapt).
- User-submitted WOD text is untrusted content, kept separate from system instructions, when sent to the model.
- A schema-valid AI response is not treated as necessarily correct — the UI always allows comparison against the original and manual correction.
- No automatic retries on failure; failures preserve user input and offer a manual retry. Timeout target: 25s.
- The API key must never reach the Vite bundle — it lives only in `packages/api`.
- Public demo needs request-rate limiting (per-IP and global) and correct trusted-proxy config *before* enabling real AI calls; CORS is not a substitute for abuse protection. If the hosting choice can't guarantee a global concurrency/spend limit, ship in demo-only mode (examples work, live calls disabled) until it can.

## Build order (spec §12)

Build the no-AI path first: scaffolding + shared contracts + the three static examples, then the full UI wired to mocked data, then the real `/api/parse` backend, then adaptation + copy + localStorage save, then rate limits/tests/deploy. Don't build excluded features before this full path is working end-to-end.
