# Canonical Service Assembler Rollout

## Current State

- The assembler is implemented as a shadow-only module in `lib/canonicalServiceAssembler.js`.
- Production customer-facing behavior does not depend on it.
- The feature flag is `ENABLE_CANONICAL_SERVICE_ASSEMBLER`.
- Default behavior is disabled unless `ENABLE_CANONICAL_SERVICE_ASSEMBLER=true`.

## Rollback

Rollback is immediate:

1. Leave `ENABLE_CANONICAL_SERVICE_ASSEMBLER` unset, or set it to `false`.
2. Do not wire `buildCanonicalShadowEstimate(...)` into active API, TD2, validation, PDF, or rendering paths.
3. Re-run `node scripts/canonical-service-assembler-shadow.js` if shadow evidence is still needed.

Because this task does not connect the assembler to production routes, rollback has no data migration, cache purge, or deployment dependency.

## Production Enablement Gates

Do not enable customer-facing behavior until all gates in `reports/canonical-service-assembler-release-gates.json` pass:

- Zero PDF-ready duplicate semantic items.
- Zero PDF-ready amount-to-service-kind mismatches.
- Zero PDF-ready title/description action conflicts.
- Zero fabricated scope facts in PDF-ready estimates.
- Zero unresolved structural errors that remain PDF-ready.
- `obs_0907`, `obs_0839`, and `obs_0909` remain fixed.
- No regression from the best local price benchmark.
- No valid prices dropped.
- Deterministic and idempotent construction.
- Validated semantic hash equals renderer-input semantic hash.
- All uncertain relationships remain blocked or require explicit Tree Dude resolution.
- A real held-out set with authoritative service-kind and relationship labels passes the same gates.

## Rejected Enablement Paths

- Do not ship wording-only rewrites.
- Do not copy raw evidence spans directly into customer wording.
- Do not use benchmark expected fields as builder input.
- Do not treat price-only correctness as PDF-ready semantic correctness.
- Do not enable production behavior while held-out status is `BLOCKED - INSUFFICIENT GROUND TRUTH`.

## Verification Commands

```powershell
node --check lib\canonicalServiceAssembler.js
node --check scripts\canonical-service-assembler-evaluation.js
node --check scripts\canonical-service-assembler-shadow.js
node scripts\canonical-service-assembler-evaluation.js
node scripts\canonical-service-assembler-shadow.js
node --test tests\canonicalServiceAssembler.test.js tests\finalEstimateInvariants.test.js
```
