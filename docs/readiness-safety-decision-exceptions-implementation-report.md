# Readiness Safety + Decision Exceptions Implementation Report

Status: local shadow instrumentation and review-by-exception UX complete for client review. Project status remains `REVISE`; this is **not** approved for production PDF blocking.

## Bottom line

This pass ships three things that make the estimate app more inspectable and measurable:

1. **Decision envelopes** so runner-up candidates (phone, tree scope, prices) are kept and explained instead of silently discarded.
2. **Review-by-exception UI** so reviewers only see material conflicts (phone duplicates, tree-scope corrections, price alternatives) plus an optional readiness override checkbox.
3. **Shadow readiness safety** plus a **ratchet gate** on the 60-case offline cohort so regressions cannot hide in JSON reports.

It does **not** safely block bad PDFs in production. `readinessSafetyPdfBlockingEnabled` remains hardcoded `false` in `lib/validateJson.js`. Enabling it today fails ~88/603 unit-test fixtures because the invariants were tuned only against the narrow 60-case eval cohort.

## Map to the 7-28 advisory (`docs/7-28-2026-improvements.md`)

| # | Advisory item | Status this pass |
|---|---------------|------------------|
| 1 | Stop throwing away runner-up answers | Shipped for phone, tree scope, and price via pipeline decision envelopes |
| 2 | Put “which answer wins” in one place | Partially shipped: envelopes + claim graph attached; win logic still not a single dedicated arbitrator for every field |
| 3 | Accuracy test set (~60 cases) | Shipped: offline eval + `reports/readiness-safety-60-summary.json` + ratchet baseline |
| 4 | Save what reviewers correct, and why | Shipped: reviewer decision log (PDF stamp) + append-only ledger |
| 5 | Keep facts separate from customer wording | Partially shipped: evidence firewall + generated-statement invariant in shadow |

## What changed

### Decision envelopes

- `lib/attachPipelineDecisionEnvelopes.js`
  - Attaches contact / price / tree-count decision envelopes and claim-relationship graph under `normalization.decisions`.
  - Additive: does not change the currently selected customer-facing values.
- `lib/detectClaimRelationships.js` / `lib/normalizeAlphaJson.js` / schema docs
  - Support preserving candidates and relationships for later review and readiness checks.

### Review-by-exception UX

- `lib/reviewDecisionExceptions.js`
  - Derives material exceptions: phone duplicates, tree-scope corrections, price alternatives.
- `app/components/DecisionExceptionCards.jsx`
  - `PhoneDuplicateBadge`, `TreeScopeCorrectionCard`, `PriceAlternativesCard`.
- `app/components/JsonReview.jsx` / `app/page.js` / `app/styles/globals.css`
  - Wires cards into review-by-exception mode only; records reviewer actions into the decision log/ledger.
  - Readiness override checkbox: “Create Estimate despite readiness safety flags” (`acknowledgedReadinessRisk`).

### Reviewer logging

- `lib/reviewerDecisionLog.js` — client action log stamped at PDF confirm (`selected_candidate`, `rejected_candidate`, etc.).
- `lib/reviewerDecisionLedger.js` — append-only structured ledger distinguishing extraction vs business vs formatting edits.
- `app/api/pdf/route.js` — stamps `reviewer_decision_log` on the validated payload before render; does **not** call readiness directly.

### Shadow readiness safety

- `lib/readinessSafety.js` (`readiness-safety-v0.1`)
  - Always returns `shadow_mode: true` and `would_block_pdf`.
  - Does not mutate `blocking_errors` / `can_generate_pdf`.
  - Invariant codes include: `UNRESOLVED_EXPLICIT_CORRECTION`, `CONFLICTING_SUPPORTED_CANDIDATES`, `HIGH_CONFIDENCE_PRICE_UNRESOLVED`, `UNSUPPORTED_CUSTOMER_FACING_VALUE`, `INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED`, `SOURCE_FACT_OMITTED_WITHOUT_REASON`, `GENERATED_STATEMENT_AS_EVIDENCE`.
- `lib/validateJson.js`
  - Attaches `validation.readiness_safety`.
  - `readinessSafetyPdfBlockingEnabled = false` (hardcoded). Blocking + override plumbing is fully wired for a future flip.
- `lib/reviewOverrides.js`
  - `acknowledgedReadinessRisk` recognized for `"Readiness check:"` messages when enforcement is eventually enabled.

### Ratchet / offline eval

- `scripts/eval-offline-dataset.js` — writes readiness summary alongside accuracy summary.
- `scripts/ratchet-gate.js` + `reports/ratchet-baseline.json`
  - Floors/ceilings for accuracy + readiness metrics; fails on new incorrect-but-ready case IDs even if the count does not rise.
- Package scripts: `eval:offline`, `ratchet:check`, `ratchet:update`.

### Tests added

- `tests/readinessSafety.test.js`
- `tests/readinessSafetyEnforcement.test.js` (plumbing works; flag stays false)
- `tests/reviewDecisionExceptions.test.js`
- `tests/reviewerDecisionLedger.test.js`
- `tests/reviewerDecisionLog.test.js`
- `tests/ratchetGate.test.js`
- `tests/attachPipelineDecisionEnvelopes.test.js`
- `tests/evidenceFirewall.test.js`
- `tests/metamorphic.test.js` (includes three intentional `# TODO` probes for known gaps)

## 60-case cohort metrics (authoritative JSON)

Source: `reports/readiness-safety-60-summary.json`

| Metric | Value | Notes |
|--------|------:|-------|
| Cohort size | 60 | Offline eval |
| Currently PDF-ready | 44 | Existing blockers only |
| Currently blocked | 16 | Existing blockers only |
| Incorrect-but-ready | **18** | At safety ceiling; known allowlist in ratchet baseline |
| Caught by shadow invariants | **7 / 18 (38.89%)** | Would catch more bad-ready cases if enforced |
| Correct-but-blocked (projected if enforced) | 1 (`tdsvc-058`) | Already blocked today; newly blocked if shadow enforced: **0** |
| Unresolved-conflict recall | **3 / 20 (15%)** | Equals ratchet floor `0.15` — at baseline, not past it |
| Correct abstention | **9 / 10 (90%)** | Equals ratchet floor `0.9` |
| Unsupported selected facts | **20 / 389 (5.14%)** | Equals ratchet ceiling `0.0514` |
| Shadow would-block count | **19** | Findings present; PDF path unchanged |

Top shadow trip codes:

| Code | Trips |
|------|------:|
| `UNSUPPORTED_CUSTOMER_FACING_VALUE` | 10 |
| `HIGH_CONFIDENCE_PRICE_UNRESOLVED` | 9 |
| `SOURCE_FACT_OMITTED_WITHOUT_REASON` | 9 |
| `CONFLICTING_SUPPORTED_CANDIDATES` | 2 |
| `INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED` | 1 |

## Explicit non-claims

| Claim someone might want | Reality |
|--------------------------|---------|
| PDF blocking from readiness safety | **Off** (`readinessSafetyPdfBlockingEnabled = false`) |
| Catching bad-but-ready estimates | **~39%** shadow catch rate (7/18) |
| Unresolved-conflict recall | **15%** — at floor, not above |
| Incorrect-but-ready eliminated | **Still 18** cases |
| Production enforcement approved | **No** |

This is instrumentation + review UX + safety in shadow, not “we now safely block bad PDFs.”

## Production safety state

- Readiness PDF blocking remains hardcoded off.
- Override plumbing (`acknowledgedReadinessRisk`) is wired in validation and review UI but unused on the live PDF path while the flag is false.
- Ratchet baseline locks current floors/ceilings so silent regressions fail CI-style checks via `npm run ratchet:check` / `node scripts/ratchet-gate.js`.
- No production deployment, hosted API call, default-branch merge, or enforcement enablement was performed in this packaging pass.

## Required local outputs

- `reports/readiness-safety-60-summary.json`
- `reports/ratchet-baseline.json`
- `reports/service-assembler-accuracy-60-summary.json` (ratchet accuracy source)
- `docs/readiness-safety-decision-exceptions-implementation-report.md`

## Validation commands and results

Syntax checks:

```bash
node --check lib/readinessSafety.js
node --check lib/reviewDecisionExceptions.js
node --check lib/reviewerDecisionLedger.js
node --check lib/reviewerDecisionLog.js
node --check lib/attachPipelineDecisionEnvelopes.js
node --check lib/validateJson.js
node --check scripts/ratchet-gate.js
node --check app/api/pdf/route.js
```

Result: all passed.

Focused tests:

```bash
node --test \
  tests/readinessSafety.test.js \
  tests/readinessSafetyEnforcement.test.js \
  tests/reviewDecisionExceptions.test.js \
  tests/reviewerDecisionLedger.test.js \
  tests/reviewerDecisionLog.test.js \
  tests/ratchetGate.test.js \
  tests/attachPipelineDecisionEnvelopes.test.js \
  tests/evidenceFirewall.test.js \
  tests/metamorphic.test.js \
  tests/ui-source.test.js
```

Result: 59 passed, 0 failed, 3 todo (known metamorphic probes; not treated as suite failures).

Ratchet gate:

```bash
node scripts/ratchet-gate.js
```

Result: all ratchet and safety gates passed (floors/ceilings match the 60-case reports above).

Full suite:

```bash
node --test tests/*.test.js
```

Result: 622 tests, 619 passed, 0 failed, 3 todo (same known metamorphic probes).

No hosted API calls, production calls, deploys, or merges were made during this packaging pass.

## Remaining gates (next billable phase)

1. **Invariant retune vs broad fixture corpus** so flipping `readinessSafetyPdfBlockingEnabled` does not fail ~88/603 unit tests.
2. **Raise unresolved-conflict recall** above the `0.15` floor with held-out cases, not just baseline-matching.
3. **Raise incorrect-but-ready shadow catch** past ~39% without newly blocking correct-ready estimates on the 60-case cohort.
4. **Tighten incorrect-but-ready ceiling** below 18 only after catch/recall improve and ratchet `--update` is deliberate.
5. Optional: staging/canary validation plan (same pattern as human-review-34) — only after explicit client approval.

## Decision

`READY_FOR_CLIENT_REVIEW`

This means the work is packaged, measured, and honest enough to send as a consultant deliverable. It does **not** mean `READY_FOR_PRODUCTION_ENFORCEMENT`.
