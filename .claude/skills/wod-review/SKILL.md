---
name: wod-review
description: Deep, wod-translator-domain-specific code review — the parse/adapt AI contract, Zod validation boundaries, rate limiting, localStorage handling, scope discipline, Fastify/React/TypeScript conventions, tests, and architecture. More targeted than the built-in /code-review skill because it knows this codebase's specific invariants (the never-invent-a-value rule, the AI-trust boundaries, the closed feature scope). Use when reviewing a diff, branch, or PR in wod-translator, especially anything touching packages/api's AI integration, packages/shared's schemas, or localStorage in packages/web.
---

# wod-review

A code review pass tailored to `wod-translator`'s actual architecture and
known failure modes, not a generic checklist. Read the repo's `CLAUDE.md`
first if you haven't already this session — it documents the closed scope,
the package split, the data contract, and the AI usage rules this review
leans on heavily.

Review the diff (or the files/branch/PR you're pointed at) against the
categories below. For each finding, cite the concrete failure scenario
(exact input/state that breaks), not a general category of concern. Skip a
category entirely if nothing in the diff touches it — don't pad the report.

## Correctness

- Zod schemas that don't actually match what the handler or component
  assumes downstream (e.g. treating `movements[i].loads` as always present
  when the schema allows `null`).
- **The never-invent-a-value rule**: this is the project's core domain
  invariant (spec §3/§7). Any code — parsing logic, a prompt, a UI default,
  a fallback — that fills in a quantity, unit, or load that wasn't present
  in the original text, or that collapses load alternatives (`40/30 kg`)
  into a single chosen value, is a near-automatic finding regardless of how
  reasonable the guess looks.
- Error paths that return a misleading status/error code or swallow an
  error silently instead of surfacing one of the fixed `ApiErrorCodeSchema`
  codes.

## Scope discipline

CLAUDE.md's exclusion list is deliberate, not an oversight — flag any diff
that reintroduces something from it, even as a "small" addition: login/
auth/JWT/profiles, a database or server-side workout history, a list of
saved workouts (only the single most recent persists, in `localStorage`),
athletic results/records/rankings/calendar, training programming or injury
advice, OCR/image/audio/video input, free chat/agents/RAG/web search/vector
DB, payments/subscriptions/social features, a standalone UI kit,
microservices, or a native app. These often look like natural next steps —
that's exactly why they need to be caught in review, not why they're fine.

## Format-support invariant

Only a single AMRAP-or-For-Time block with constant quantities is
supported. Flag any change that silently reinterprets an unsupported format
(EMOM, multi-block, complex intervals, rep ladders, %1RM) as `amrap` or
`for_time` instead of surfacing it as unsupported (`422 UNSUPPORTED_FORMAT`)
and preserving the original text for editing.

## AI contract / trust boundaries

- `/api/parse` and `/api/adapt` responses must be validated against the
  matching `packages/shared` schema before anything downstream uses them —
  a schema-valid response is not necessarily accurate (spec §9 says this
  outright); the UI must still let the user compare against the original
  and correct it, never treat a successful parse as final.
- `/api/adapt` must independently re-validate the client-submitted
  "reviewed card" through `WodSchema` — don't let a diff trust that it
  really came from the review screen.
- No automatic retries on AI-call failure (spec §9) — a diff that adds
  retry logic around the Anthropic call is a design regression, not a
  robustness improvement, unless the spec's stance on this has explicitly
  changed.
- User text and system instructions must stay separated when building the
  request to the model — security-relevant (delegate to `security-reviewer`
  below), but also a correctness concern if a diff makes it harder to tell
  which text is which.

## Rate limiting / demo protection

- Quota must be checked and reserved *before* calling the provider, for
  both parse and adapt, not just one of them.
- The three precomputed example WODs (`packages/shared/src/examples`) must
  keep working with **zero** AI calls, including when the rate limit is
  exhausted — flag any change that routes an example through a real API
  call.
- In-memory rate-limit counters are a known-soft limit (don't coordinate
  across instances, reset on restart) — a diff that starts treating them as
  a durable/authoritative spend control without the accompanying
  provider-side or platform-side hard limit is a finding.

## State / invalidation rules

- Editing the original WOD text must invalidate the current card and
  require reinterpretation.
- Editing the card after requesting an adaptation must invalidate that
  adaptation's proposals.
- A stale/late response from a superseded request must never overwrite
  newer user edits — flag any async flow (parse or adapt) that applies a
  response to state without checking it's still the response to the
  *current* request (e.g. via a request id or generation counter), since
  nothing here currently prevents a slow first request from resolving after
  a faster second one and clobbering it.

## localStorage

- The saved envelope must be validated on read through
  `SavedWodEnvelopeSchema`, with a graceful reset path if it's corrupt or
  from an incompatible `schemaVersion` — flag any direct, unguarded
  `localStorage.getItem`/`JSON.parse` without going through the schema.
  Remember `schemaVersion` mismatch is a soft "offer to reset" case, not
  meant to be indistinguishable from a hard parse failure.
- Quota-exceeded or access-denied errors from `localStorage` (private
  browsing, disabled storage) must not block the rest of the app — flag any
  unguarded `localStorage.setItem` call with no try/catch.

## Fastify / React / TypeScript conventions

- `packages/shared` is the sole source of Zod schemas and inferred types —
  flag hand-rolled duplicate types or ad hoc validation in `web` or `api`
  instead of importing from `@wod-translator/shared`.
- ESM + `NodeNext` module resolution throughout — relative imports inside
  `packages/shared`/`packages/api` need explicit `.js` extensions on `.ts`
  source files; a missing extension will fail at runtime after `tsc` even
  though it type-checks in some editors.
- CSS Modules only in `packages/web` — flag significant inline `style={}`
  usage that should be a `.module.css` class instead.
- No `react-router-dom`, no state-management library (Redux/TanStack
  Query) — this is a deliberate single-screen, local-state app; a diff that
  reaches for either is scope creep, not a missing dependency.

## Tests

- New behavior without a corresponding colocated test (`*.test.ts(x)` next
  to the source file, matching this repo's existing pattern).
- A test that mocks away the actual validation boundary (e.g. stubbing out
  `WodSchema.parse` itself, or bypassing schema validation when testing a
  route/component) — flag as a coverage gap even if the mocked test passes,
  since the real risk in this codebase lives at exactly that boundary.
- `packages/shared/src/examples/examples.test.ts`'s pattern (validate every
  example against the schema) should be the model for any new fixture data
  — flag fixture data added without an equivalent schema-validation test.

## Performance

- Genuinely wasted round trips (sequential `await`s that could be
  `Promise.all`'d) — not micro-optimizations with no measurable path
  relevance in a project this size.
- More than one AI call per user-initiated parse or adapt action — the spec
  is explicit about single-request, non-streaming operations; a diff that
  triggers a second call to "double check" or "retry" a result is a
  regression against that rule, not a quality improvement.

## Architecture

- Don't push for layering this project doesn't need. CLAUDE.md explicitly
  warns against speculative abstraction and premature design-for-the-future
  — a "shared helper" with only one real call site, or a repository/service
  layer introduced ahead of an actual second implementation, is itself a
  finding here, the mirror image of the usual advice.
- The one boundary that does matter: `packages/api` must be the only place
  that holds the AI provider key and constructs the AI request — flag any
  code path that could let `packages/web` call the provider directly.

## Delegate security-sensitive changes

For any diff touching the AI provider integration, prompt construction for
`/api/parse` or `/api/adapt`, rate limiting, error-response construction, or
`localStorage` read/write — **invoke the `security-reviewer` subagent**
(adversarial, exploit-path-focused) rather than trying to cover that ground
here. This skill's categories above catch correctness/architecture/scope
issues; that agent is the one that thinks like an attacker.

## External documentation with Context7

Context7 is available as the preferred source of current library and
framework documentation.

Use Context7 whenever the correctness of a finding depends on the current
behavior, API, configuration, or recommended usage of a dependency.

Examples include:

- React
- Fastify
- Zod
- Vitest
- Vite
- Anthropic SDK / Claude API (e.g. structured-output/schema behavior,
  timeout handling, usage/pricing field shapes)

### When to use Context7

Use Context7 when:

- verifying whether an API is being used correctly
- checking library-specific behavior
- checking whether an API is deprecated
- validating configuration
- checking security-sensitive framework behavior
- validating recommended framework patterns
- determining whether behavior changed between library versions
- a potential finding depends on assumptions about a third-party library

Before querying Context7:

1. Inspect the relevant `package.json`.
2. Determine the actual dependency and version used by the project.
3. Query documentation relevant to that library/version when possible.
4. Compare the implementation against the documentation.

### Finding verification

If a potential finding depends on third-party library behavior, do not
report it as confirmed until the relevant behavior has been verified with
Context7 when documentation is available.

For example, do not claim:

"Fastify does not validate this input."

or:

"Zod's `.datetime()` accepts non-ISO strings."

or:

"The Anthropic SDK retries automatically on timeout."

without verifying the relevant framework behavior when that behavior is
material to the finding.

### Avoid unnecessary Context7 usage

Do NOT query Context7 for:

- project-specific business rules
- code that can be understood directly from the repository
- obvious TypeScript logic errors
- application-specific state transitions
- domain invariants documented in `CLAUDE.md`
- issues fully demonstrated by the implementation itself

Context7 should increase confidence, not replace reasoning about the
codebase.
