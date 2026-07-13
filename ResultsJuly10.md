# ResultsJuly10 GPT Handoff Prompt

Copy this prompt into a new GPT/Codex thread if you want another agent to continue the work.

```markdown
You are continuing work in the local repo `C:\Users\eiriksson\Documents\TSweb` on branch `codex/canonical-service-assembler-shadow`.

Follow the repo rules in `AGENTS.md`:
- Read `AGENTS.md` first.
- Explain planned file changes before modifying files.
- Keep file changes minimal.
- Do not push unless explicitly asked.
- Do not touch unrelated dirty files.
- Do not report the full suite as green when the alpha cohort harness is intentionally still red.

Current branch context:
- Branch: `codex/canonical-service-assembler-shadow`
- Relevant latest commits:
  - `3052e40 Fix implicit three-price option extraction`
  - `4cecb85 Add uber-plus alpha audit baseline`
  - `4e7133a Add alpha very-messy non-defect baseline audit`
  - `089553e Add alpha uber-messy baseline audit`
  - `0447de6 Update canonical assembler evaluation gates`
  - `8151ae3 Fix canonical service-kind evidence assignment`
- The two newest commits are local as of this handoff unless they have since been pushed by the user.
- The earlier audit commits `089553e` and `4e7133a` were already part of the shadow feature branch before this latest work.

Unrelated files to leave alone:
- `reports/canonical-option-builder-simulation.jsonl`
- `reports/canonical-option-builder-simulation.md`
- `scripts/canonical-option-builder-simulation.js`

What was done in this latest pass:

1. Audited the separate `uber-plus-messy` follow-up-count failure.

Command used:

```powershell
node scripts\audit-alpha-cohort-baseline.js uber-plus-messy --no-write
```

Observed result:

```json
{
  "failure_count": 32,
  "approved_non_defect_failure_count": 6,
  "true_defect_count": 26,
  "classifications": {
    "true_defect": 26,
    "correct_safe_block_follow_up": 6
  },
  "failure_categories": {
    "validator_readiness": 26,
    "follow_up_unrecovered": 6
  }
}
```

Interpretation:
- The follow-up-count issue is not a single parser regression.
- There are 6 cases where the app correctly remains blocked after synthetic follow-up because the evidence is still insufficient.
- Those 6 are approved safe follow-up blocks.
- There are 26 true `validator_readiness` defects that must remain visible failures.
- Do not rebaseline or approve those 26 true defects.

The approved `uber-plus-messy` non-defect baseline was written and committed in:
- Commit: `4cecb85 Add uber-plus alpha audit baseline`
- Files:
  - `reports/alpha-uber-plus-messy-baseline-audit.md`
  - `tests/fixtures/alpha-uber-plus-messy-approved-baseline-2026-07-10.json`
  - `tests/alpha-cohort-RULES-simulation.test.js`

The harness change adds:
- `UBER_PLUS_MESSY_APPROVED_BASELINE_PATH`
- An approved baseline map entry for `uber-plus-messy`

This means future alpha runs accept only the 6 approved `correct_safe_block_follow_up` failures for `uber-plus-messy`, while still failing on the 26 true defects.

The 6 approved safe follow-up block IDs are:
- `case_0928`
- `case_1429`
- `case_1510`
- `case_1668`
- `case_1719`
- `case_1770`

The 26 unapproved true `uber-plus-messy` defect IDs that remain visible are:
- `case_0708`
- `case_1170`
- `case_1409`
- `case_1420`
- `case_1870`
- `case_0048`
- `case_0949`
- `case_1138`
- `case_1629`
- `case_1720`
- `case_1748`
- `case_1938`
- `case_0288`
- `case_1639`
- `case_1899`
- `case_1919`
- `case_1959`
- `case_1999`
- `case_0189`
- `case_0558`
- `case_0698`
- `case_0918`
- `case_1260`
- `case_1740`
- `case_1790`
- `case_1908`

2. Investigated and fixed the 29 `very-messy` true price-option defects.

Before the fix:
- The `very-messy` audit had 38 failures.
- 9 were approved non-defects, classified as stale or incorrect expectations.
- 29 were true `parser_price_options` defects.
- The 29 true defects shared a single root cause.

Root-cause pattern:
- Raw notes contained variants of:

```text
notes: old estimate scribble. drop <price> haul brush <price> stump <price>
```

Example:

```text
note from Alicia Blair 812 555 2249 alicia.blair277@example.com.
2061 Vaughn Drive Hanover IN.
2 oak trees removal.
notes: old estimate scribble. drop $1250 haul brush 1800 stump 2,800
```

Expected prices:
- `$1,250`
- `$1,800`
- `$2,800`

Before the fix, the parser output only:
- `$1,800`
- `$2,800`

The first `drop` amount was lost.

Important investigation finding:
- Basic sidecar money detection could see all three prices in the real fixture/test string.
- The loss happened later when `normalizeAlphaJson` chose final service options.
- The raw fallback path was not using high-confidence implicit sidecar pairings for this 3-price shape.
- The earlier fallback logic kept ordinary labeled sidecar segments and safe direct pairings, but did not safely bridge implicit sidecar pairings into final raw options.

Implementation fix:
- Commit: `3052e40 Fix implicit three-price option extraction`
- File: `lib/normalizeAlphaJson.js`
- Function changed: `extractSidecarOptionPairingsFromRaw`

The fix:
- Collects implicit sidecar pairings where:
  - `source === "option_price_sidecar_implicit"`
  - `price_value` is present
  - `confidence === "high"`
  - `pairing_confidence === "high"`
  - `amount_confidence === "high"`
  - `price_status === "firm_candidate"`
  - `review_warning` is false
  - `description_raw` contains tree-service work scope
- Uses those implicit pairings only when there are 3 or 4 of them.
- Keeps the existing precedence:
  - Segment-start labeled sidecar pairings still win.
  - Safe direct pairings still win for the old 2-option direct-label case.
  - The new implicit bridge is only the fallback after those safer forms.

Why the fix is intentionally limited:
- An earlier broader version allowed 2 implicit pairings and caused regressions in existing two-price shorthand cases.
- The final version requires 3-4 implicit pairings to target the observed defect cluster without changing existing two-price behavior.
- This avoids turning ordinary two-price notes, emergency notes, or add-on ambiguity into auto-final options.

Regression test added:
- File: `tests/normalizeAlphaJson.test.js`
- Test name:

```js
test("old estimate scribble prefix still keeps drop haul and stump prices", () => { ... })
```

The test asserts:
- `can_generate_pdf === true`
- Final service option prices are exactly:
  - `$1,250`
  - `$1,800`
  - `$2,800`
- Option descriptions retain safe scope evidence for removal/drop/tree, haul/brush, and stump.

3. Current post-fix audit results.

Current `very-messy` no-write audit:

Command:

```powershell
node scripts\audit-alpha-cohort-baseline.js very-messy --no-write
```

Result:

```json
{
  "failure_count": 9,
  "approved_non_defect_failure_count": 9,
  "true_defect_count": 0,
  "classifications": {
    "stale_or_incorrect_expectation": 9
  },
  "failure_categories": {
    "parser_price_options": 9
  }
}
```

Interpretation:
- The 29 true `very-messy` price-option defects are fixed.
- The only remaining `very-messy` failures are the 9 already-approved stale or incorrect expectations.
- The historical `very-messy` audit artifact still documents what was approved and what was true at audit time. It was not regenerated after the fix because the original audit evidence is useful.

Current `uber-plus-messy` no-write audit:

Command:

```powershell
node scripts\audit-alpha-cohort-baseline.js uber-plus-messy --no-write
```

Result:

```json
{
  "failure_count": 32,
  "approved_non_defect_failure_count": 6,
  "true_defect_count": 26,
  "classifications": {
    "true_defect": 26,
    "correct_safe_block_follow_up": 6
  },
  "failure_categories": {
    "validator_readiness": 26,
    "follow_up_unrecovered": 6
  }
}
```

Interpretation:
- `uber-plus-messy` remains intentionally red.
- The 6 follow-up blocks are approved non-defects.
- The 26 validator readiness defects remain unapproved true defects.

4. Tests run and results.

Syntax checks passed:

```powershell
node --check lib\normalizeAlphaJson.js
node --check tests\normalizeAlphaJson.test.js
node --check tests\alpha-cohort-RULES-simulation.test.js
```

Focused normalizer suite passed:

```powershell
node --test tests\normalizeAlphaJson.test.js
```

Result:

```text
tests 131
pass 131
fail 0
```

Related sidecar/reconciliation/invariant suites passed:

```powershell
node --test tests\optionPriceNormalizer.test.js tests\priceReconciliation.test.js tests\finalEstimateInvariants.test.js
```

Result:

```text
tests 44
pass 44
fail 0
```

Alpha cohort harness was run:

```powershell
node --test tests\alpha-cohort-RULES-simulation.test.js
```

Result:
- The harness still fails.
- This is expected and correct.
- It fails on the 26 unapproved `uber-plus-messy` true defects outside the approved non-defect baseline.
- Do not call the suite green.
- Do not hide those failures.

Exact alpha harness failure reason:

```text
alpha-uber-plus-messy-150-initial-39pct-2026-06-30-cases.json has failing case IDs outside the approved non-defect audit baseline
```

Current `uber-plus-messy` harness summary:

```json
{
  "fixture": "alpha-uber-plus-messy-150-initial-39pct-2026-06-30-cases.json",
  "tier": "uber-plus-messy",
  "total": 150,
  "failing": 32,
  "errorRate": 0.2133,
  "errorRatePercentExact": 21.33,
  "initiallyReady": 62,
  "recoveredAfterFollowUp": 82,
  "stillBlocked": 6,
  "maxRoundsUsed": 3,
  "failureCategories": {
    "validator_readiness": 26,
    "follow_up_unrecovered": 6
  }
}
```

5. Current state and decision.

What is now better:
- The `very-messy` true price-option defects dropped from 29 to 0.
- The specific first-price-loss bug in `old estimate scribble. drop <price> haul brush <price> stump <price>` is fixed.
- Existing normalizer, option-price sidecar, price reconciliation, and final estimate invariant tests are green.
- The `uber-plus-messy` follow-up-count issue is now separately audited and properly classified.

What remains red:
- The alpha cohort harness remains red on 26 `uber-plus-messy` true validator-readiness defects.
- This is the right status.
- Do not merge or report full-green until those 26 are fixed or explicitly accepted through a documented release waiver.

Recommended next work, most important first:
1. Triage the 26 `uber-plus-messy` `validator_readiness` true defects by shared root cause.
2. Separate "parser was quote-ready but should block" cases from expectation/policy problems.
3. Fix the highest-count readiness root cause first.
4. Keep the approved non-defect baselines frozen unless the user explicitly reopens human approval.
5. Do not silently rebaseline true defects.
6. If asked to push, first verify `git status --short --branch --untracked-files=all` and make sure the unrelated option-builder simulation files are not staged.

Important caution:
- The current price fix touches `lib/normalizeAlphaJson.js`, which is a real normalization path, not the shadow canonical assembler module.
- The fix is narrow and test-backed, but do not describe it as shadow-only.
- The canonical assembler shadow work remains separate from this price-defect implementation fix.

If continuing with commits or push:
- First inspect:

```powershell
git status --short --branch --untracked-files=all
git log --oneline -6
git diff --stat
```

- Expected unrelated untracked files, if still present:

```text
reports/canonical-option-builder-simulation.jsonl
reports/canonical-option-builder-simulation.md
scripts/canonical-option-builder-simulation.js
```

- Do not stage those unless the user explicitly approves that separate work.

Bottom line:
- `very-messy`: fixed the 29 true price-option defects.
- `uber-plus-messy`: audited the follow-up-count issue and approved only the 6 safe blocks.
- Remaining visible work: 26 true `uber-plus-messy` validator-readiness defects.
- Full alpha suite is not green yet, by design.
```
