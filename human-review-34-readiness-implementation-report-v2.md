# Human Review 34 Readiness Implementation Report v2

Status: local shadow hardening complete for review. Project status remains `REVISE`; this is not approved for production enablement.

## What Changed Since v1

- `lib/validateRoutePayload.js`
  - Replaced client-supplied sidecar/validation evidence copying with server-recomputed route evidence from raw notes.
  - Adds `normalization.route_validation_evidence` with a raw-input hash, sidecar hash, price-candidate count, and `trusted` status.
  - Adds `validation.final_option_render_binding` for the exact option structure validated before rendering.
  - Blocks stale structural approval hashes with `STALE_STRUCTURAL_APPROVAL`.
- `app/api/pdf/route.js`
  - Now delegates validation to `validateAlphaJsonRoutePayload`, matching `/api/validate`.
  - Rejects structural blockers before rendering.
  - Stores the approved final-option structural hash and render binding only after server validation.
- `lib/finalOptionStructureValidator.js`
  - Renames the missing cumulative expanded choice case to `MISSING_EXPANDED_CHOICE`.
  - Keeps `EXPANDED_PRICE_MISMATCH` available for true wrong-amount cases.
- `lib/canonicalServiceAssembler.js`
  - Adds `MISSING_EXPANDED_CHOICE` to the structural error-code contract.
- `scripts/run-final-option-structure-regression-triage.js`
  - New local replay triage generator for the 382 saved replay rows.
  - Emits one privacy-safe JSONL row per observation and a Markdown summary.
- `tests/finalOptionRouteHardening.test.js`
  - Adds route trust-boundary, valid structure, invalid structure, stale hash, and PDF-route delegation coverage.

## Human Review Cohort Status

- Authoritative reviewed cohort: 34 observations.
- Authoritative position 1 is now `obs_0724`.
- `obs_0730` is preserved separately as one extra regression observation.
- `obs_0724` human-confirmed structure:
  - Option A: Take down the dead ash tree by the shed - `$2,500`
  - Option B: Take down the dead ash tree by the shed and grind the stump - `$3,250`
  - `$750` stump grinding is dependent add-on evidence, not a standalone customer option.

## Current Shadow Replay Counts

From local saved replay analysis:

| Scope | Count |
|---|---:|
| Total replay rows | 382 |
| Active PDF-ready rows | 261 |
| Newly blocked under shadow enforcement | 186 |
| Potential regressions requiring held-out semantic review | 152 |
| Authoritative reviewed structural blocks | 34 |
| Extra regression observations | 1 |

Potential-regression triage:

| Bucket | Count |
|---|---:|
| dependent_addon_structure | 149 |
| scope_quality | 3 |

## Trust Boundary Result

The route no longer trusts these client-submitted fields:

- `normalization.sidecar_price_reconciliation`
- `validation.price_reconciliation_warnings`
- `validation.price_reconciliation_blocking_errors`
- `validation.price_reconciliation_follow_ups`

Instead, the route recomputes price evidence from raw notes and then validates the submitted AlphaJSON against that server-side evidence.

## Production Safety State

- `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT` remains default-off.
- `ENABLE_CANONICAL_SERVICE_ASSEMBLER` remains default-off.
- The canonical builder remains shadow-only.
- No production integration, deployment, hosted API call, or default-branch merge was added.
- PDF generation is bound to the server-validated AlphaJSON object, not the submitted client object.

## Required Local Outputs

- `reports/final-option-structure-regression-triage.jsonl`
- `reports/final-option-structure-regression-triage.md`
- `human-review-34-readiness-implementation-report-v2.md`
- `human-review-34-live-api-validation-plan-v2.md`

## Validation Commands and Results

Syntax checks:

```bash
node --check lib/canonicalServiceAssembler.js
node --check lib/finalOptionStructureValidator.js
node --check lib/validateRoutePayload.js
node --check app/api/pdf/route.js
node --check scripts/run-final-option-structure-shadow-report.js
node --check scripts/run-final-option-structure-regression-triage.js
```

Result: all passed.

Manifest verification:

```bash
node scripts/generate-human-review-readiness-manifest.js --verify-existing
```

Result: passed. Authoritative position 1 is `obs_0724`; extra regression is `obs_0730`.

Shadow replay report:

```bash
node scripts/run-final-option-structure-shadow-report.js
```

Result: 382 total rows, 34 authoritative rows, 1 extra regression row, 152 potential regressions.

Regression triage:

```bash
node scripts/run-final-option-structure-regression-triage.js
```

Result: wrote the required JSONL and Markdown triage reports; all 152 potential regressions remain marked for held-out semantic review.

Focused tests:

```bash
node --test tests/finalOptionRouteHardening.test.js tests/finalOptionStructureValidator.test.js tests/humanReviewManifest.test.js tests/ui-source.test.js
node --test tests/unit.test.js
```

Result: 32 focused tests passed; 18 unit tests passed.

Full suite:

```bash
node --test tests/*.test.js
```

Result: 411 tests passed, 0 failed.

No hosted API calls, production calls, deploys, or merges were made during this pass.

## Remaining Gates

- The 152 potential regressions need authoritative held-out semantic review.
- Staging validation can be run only after explicit approval.
- Production enforcement must remain disabled until held-out review is complete.
- Default branch merge remains blocked while project status is `REVISE`.

## Decision

`READY_FOR_STAGING_VALIDATION`

This means ready for a controlled staging/canary validation pass only. It does not mean ready for production enablement.
