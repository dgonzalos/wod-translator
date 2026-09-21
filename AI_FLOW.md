# AI flow architecture

How a WOD interpretation or an equipment adaptation actually gets from the browser to Anthropic
and back. This complements `README.md` (what the app does) and `WOD_Translator_MVP_Portfolio.md`
(the spec) — it's a deeper look at the one part of the stack that talks to an external model.

The flow spans all three packages, with one rule enforced throughout: the frontend never talks
to Anthropic directly, and the backend never trusts what comes back — from either side — without
re-validating it.

## 1. Frontend → API (`packages/web`)

- `EntradaPanel` → `useWodTranslator().interpret()` → `parseWod()` → `POST /api/parse` with `{ text }`.
- `AdaptacionPanel` → `useWodTranslator().adapt()` → `adaptWod()` → `POST /api/adapt` with `{ card, equipment }`.

Both requests are Zod-validated client-side against the same schemas the backend uses
(`packages/shared`). Each call has its own abort-controller/sequence-number pair in
`useWodTranslator.ts`, so a stale response from a superseded request can't overwrite a newer
edit — editing the text again, or editing the card, aborts the in-flight request before firing
a new one.

Neither `/api/parse` nor `/api/adapt` is called without the user explicitly asking for it:
loading one of the three precomputed examples never touches the network (`loadExample()` sets
the card directly from static data), and copy/save are local-only actions.

## 2. Route layer (`packages/api/src/routes/{parse,adapt}.ts`)

Each route follows the same four steps, in this order:

1. **Validate the request shape.** `ParseRequestSchema` / `AdaptRequestSchema` (`packages/shared`)
   via `.safeParse(request.body)`. A failure returns `400 INVALID_INPUT` immediately — before
   anything else runs, so a malformed request never consumes quota.
2. **Reserve quota.** `QuotaManager.reserve(request.ip)` (`packages/api/src/rate-limit/quota.ts`)
   checks, in order: rolling global token budget → global requests-per-minute → global
   concurrency → per-IP in-flight → per-IP hourly limit. Any failure returns `429 RATE_LIMITED`
   with a reason-specific message, **before the AI provider is ever called.** The quota pool is
   shared between `/api/parse` and `/api/adapt` — one hourly counter per IP covers both, not
   five each. The global requests-per-minute cap and the token budget are both IP-independent
   and both roll over time (the budget is a per-hour window, not a lifetime total) — specifically
   so that rotating through many source IPs can't bypass the per-IP limit to exhaust the AI
   feature for everyone, and so an exhausted budget recovers on its own instead of needing a
   manual restart.
3. **Call the service**, passing `request.log` through so the resulting log line correlates with
   Fastify's own per-request log via the shared `reqId`.
4. **Release the reservation** in a `finally` block, regardless of outcome — freeing the
   in-flight slot, and feeding the response's token usage into the global budget counter only
   if the provider was actually reached.

Every error path — invalid input, unsupported format, rate limited, provider error, timeout —
resolves to one of five typed codes (`packages/shared/src/api.schema.ts`'s `ApiErrorCode`),
mapped to an HTTP status by `error-status.ts`:

| Code | Status |
|---|---|
| `INVALID_INPUT` | 400 |
| `UNSUPPORTED_FORMAT` | 422 |
| `RATE_LIMITED` | 429 |
| `PROVIDER_ERROR` | 502 |
| `TIMEOUT` | 504 |

## 3. Service layer (`packages/api/src/ai/{interpret,adapt}.service.ts`)

- Builds a **system prompt** (fixed instructions) and a **separate user message** containing the
  WOD text or the reviewed card as explicitly-labeled untrusted data (e.g. wrapped in
  `<wod_card>...</wod_card>` tags). The untrusted content never merges into the system prompt —
  this is the boundary that keeps a prompt-injection attempt in the WOD text from being read as
  an instruction.
- Calls `createMessage()` — an injected function, not a direct SDK call (see §4) — with
  `tool_choice: { type: 'any' }`, forcing the model to answer via one of a small fixed set of
  tools instead of free text:
  - **Interpret**: `report_wod_interpretation` (a supported card) or `report_unsupported_format`
    (EMOM, multi-block, rep ladders, %1RM, etc. — the model reports this instead of guessing).
  - **Adapt**: `report_adaptation_proposals` only — the card's format was already validated at
    parse time, so there's nothing else for the model to report here.
- Tool input schemas are generated from the same Zod schemas used everywhere else
  (`toToolInputSchema()`), and **the tool call's input is re-validated against that same Zod
  schema on the way back.** A schema-shaped response is not trusted just because the model
  called the expected tool — `WodInterpretationInputSchema.safeParse(toolUse.input)` and
  `AdaptationProposalsInputSchema.safeParse(toolUse.input)` gate every response.
  `schemaVersion` is stamped server-side after validation, never accepted from the model.
- `AdaptationService` additionally drops any proposal whose `requiredEquipment` isn't a verbatim
  match against the fixed equipment catalog (`EQUIPMENT_CATALOG`) — an unverifiable or invented
  equipment name is silently excluded rather than trusted.
- Every branch (success, unsupported format, validation failure, timeout, provider error) is
  funneled through a `finish()` closure before returning, which:
  - Logs one structured line: `{ operation, requestId, latencyMs, result, usage }` — `result` is
    either `'success'` or the `ApiErrorCode`. **The WOD text, the card, and the declared
    equipment are never logged** — only counts and codes.
  - Attaches `usage` (`{ inputTokens, outputTokens }`, read from the Anthropic response's
    `.usage` field) to the outcome, which the route then feeds into the quota's global token
    budget.

## 4. The `CreateMessage` indirection (`packages/api/src/ai/anthropic-client.ts`)

A single function type sits between the services and the actual SDK call:

```ts
type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: Anthropic.RequestOptions,
) => Promise<Anthropic.Message>;
```

`buildApp()` (`packages/api/src/index.ts`) picks the concrete implementation:

- **Real deployment**: a lazily-constructed `Anthropic` client — constructed on first use, not
  at boot, so a missing `ANTHROPIC_API_KEY` degrades a request to `PROVIDER_ERROR` instead of
  crashing the whole server.
- **`AI_STUB_MODE=true`**: `createStubMessageFn()` (`packages/api/src/ai/stub-client.ts`) returns
  canned tool-use responses. Used only by the `packages/e2e` Playwright suite, so it can exercise
  the full adapt/save/reload/copy flow deterministically with no API key and no real spend.
  **Never set this in a real deployment.**
- **Unit tests**: any fake `CreateMessage` function, injected directly via
  `buildApp({ createMessage })` — this is how `parse.test.ts`, `adapt.test.ts`, and the service
  tests simulate success, timeouts, and provider errors without hitting the network.

## 5. Shared contract (`packages/shared`)

Zod schemas — `WodSchema`, `AdaptationProposalSchema`, and `api.schema.ts`'s request/response/
error shapes — are the single source of truth every layer imports: the frontend's client-side
validation, the route's request validation, and the tool-input schema generation the services
send to Anthropic all derive from the same definitions. There is no separate "AI-facing" schema
that could drift from what the UI expects.

## End-to-end summary

```
EntradaPanel/AdaptacionPanel
        |  (Zod-validated client-side)
        v
POST /api/parse or /api/adapt
        |
        v
  Zod .safeParse(body)  --fail-->  400 INVALID_INPUT
        |
        v
  QuotaManager.reserve(ip)  --fail-->  429 RATE_LIMITED
        |
        v
  Interpretation/AdaptationService
        |  system prompt (fixed) + user message (untrusted WOD text/card)
        v
  createMessage()  ->  real Anthropic client | AI_STUB_MODE stub | test fake
        |
        v
  tool_choice: 'any' forces a fixed tool call
        |
        v
  Zod re-validates the tool's input  --fail-->  502 PROVIDER_ERROR
        |
        v
  log {operation, requestId, latencyMs, result, usage}  (never the text/card)
        |
        v
  QuotaManager.release(usage)  (feeds the global token budget)
        |
        v
  200 { card }  or  { proposals }
```

## Why it's built this way

- **Never invent, never trust blindly.** Forced tool-use plus server-side Zod re-validation
  means the model's structural compliance is checked, not assumed — matching the spec's
  "unknown/absent fields stay `null`, never invented" rule (CLAUDE.md, RF-02).
- **Untrusted content stays untrusted.** The WOD text and reviewed card are always in the user
  message, explicitly labeled as data, never folded into the system prompt — the standard
  defense against a WOD description trying to act as an instruction.
- **Quota is reserved, not just counted.** Checking and reserving before the provider call (not
  after) means a burst of concurrent requests can't all slip through before any of them are
  recorded — spec §10's "check and reserve quota before calling the provider."
- **Nothing sensitive is logged**, so operational visibility (latency, error rates, token spend)
  doesn't come at the cost of storing what users typed.
- **The AI boundary is swappable in one place** (`CreateMessage`), which is what makes both unit
  tests and the E2E suite possible without ever needing a real API key.
