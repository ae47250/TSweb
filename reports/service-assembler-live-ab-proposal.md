# Proposed Live A/B: Service-Assembler Accuracy

Status: proposal only. Do not run without separate approval.

## Objective

Compare `codex/canonical-service-assembler-shadow` at `d5d5071` with
`codex/service-assembler-accuracy` on the same locked 60-note fixture:

`tests/fixtures/tree-dude-service-classification-60.json`

## Locked execution

- 60 notes per version.
- 120 OpenAI calls total.
- Use the identical model, reasoning effort, prompt, temperature, and other request settings for both versions.
- Record the actual model and settings at run time; do not infer them from an older report.
- Randomize or alternate version order by case to reduce time-order bias.
- Do not deploy, push, merge, or change environment settings.

## Cache contract

Cache every response before deterministic normalization. Each record should include:

- case ID and fixture hash;
- version label and exact commit;
- model and request settings;
- request ID and token usage;
- raw model response;
- schema parse warnings;
- normalized AlphaJSON;
- final validation and source-final coverage;
- deterministic output hash.

If a cached response is missing or malformed, report the case as incomplete. Do not silently retry only one side.

## Comparison metrics

- exact Option A and Option B prices;
- exact option count and ordering;
- primary and per-option service kinds;
- action-fact recall, including cleanup, chipping, backfill, stump work, and haul-away;
- option relationship and Option B price role;
- customer contact and service-address equivalence;
- species, quantity, and target preservation;
- source-final omission/change codes;
- unsafe-ready and correct-but-blocked cases;
- per-case behavioral differences with both cached outputs.

Readiness must be reported separately from factual accuracy.

## Acceptance review

The candidate should be recommended only if:

- primary service-kind matches remain at least 55/60;
- no exact-price, option-composition, contact, address, or tree-fact metric regresses;
- no new omitted action, species, quantity, target, or fabricated-fact cases appear;
- no new unsafe-ready case appears;
- every difference is traceable to cached evidence.

Source-final findings remain warning-only. Any PDF-blocking proposal requires a separate, code-specific evidence review and separate approval.
