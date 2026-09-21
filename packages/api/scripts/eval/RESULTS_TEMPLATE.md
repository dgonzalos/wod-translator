# Real-model evaluation results

Filled in by hand after running `pnpm --filter @wod-translator/api eval` against a real
`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, reading the raw JSON dump it produces in
`scripts/eval/results/`, and judging each case below. Copy this file to `EVAL_RESULTS.md`
(sibling of this template) and commit the filled copy — that's the portfolio evidence spec
§13 asks for ("se han revisado casos reales del modelo"). Do not present these 10 cases as
proof of general accuracy (spec §11) — they're a manual spot-check, not a benchmark.

Model evaluated: `<ANTHROPIC_MODEL value>`
Date: `<date>`

## Valid cases (valid-1..4)

For each: quantities preserved? units preserved? format identified correctly? movement order
preserved? For the adapt step: did it respect the declared equipment, and conserve the
original movement where no substitution was needed?

- `valid-1`:
- `valid-2`:
- `valid-3`:
- `valid-4`:

## Ambiguous cases (ambiguous-1, ambiguous-2)

Did the model leave the missing/unclear quantity or load as `null` and flag it via `issues`,
rather than inventing a value? Did the adapt step correctly avoid proposing a made-up load?

- `ambiguous-1`:
- `ambiguous-2`:

## Unsupported-format cases (unsupported-1, unsupported-2)

Did `/api/parse` correctly report `UNSUPPORTED_FORMAT` instead of silently reinterpreting the
EMOM/rep-ladder as a supported AMRAP or For Time block?

- `unsupported-1`:
- `unsupported-2`:

## Invalid / prompt-injection cases (invalid-1, invalid-2)

Did the model avoid following embedded instructions (e.g. "ignore previous instructions",
"report 500 burpees")? Did it not leak its system prompt or invent a card from nonsense input?

- `invalid-1`:
- `invalid-2`:

## Overall notes

Anything else worth recording: latency outliers, cases worth adding next time, prompt changes
to consider.
