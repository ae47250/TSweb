# Human Review 34 Readiness Implementation Report

Status: ready for second code review in shadow/default-off mode. Not ready for production enablement.

## Files and Functions Changed

- `lib/canonicalServiceAssembler.js`
  - Added canonical final-option relationship dimensions and stable IDs.
  - Added `buildCanonicalFinalOptionModel`.
  - Extended `buildCanonicalShadowEstimate` to attach `normalization.canonical_final_option_model` and a final-option structural hash.
- `lib/finalOptionStructureValidator.js`
  - New structural validator.
  - Exports `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT_FLAG`.
  - Exports `validateFinalOptionStructure`.
- `lib/validateJson.js`
  - Calls `validateFinalOptionStructure`.
  - Adds shadow structural errors, codes, blocking errors, enforcement state, canonical option model, validator version, and final structural hash to validation output.
  - Keeps structural blocking default-off unless `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=true`.
- `lib/reviewOverrides.js`
  - Keeps existing narrow review overrides.
  - Prevents generic overrides from clearing structural blocking errors.
- `lib/validateRoutePayload.js`
  - Adds `preserveRouteValidationEvidence`.
  - Preserves sidecar price reconciliation evidence through route normalization before validation.
- `app/api/pdf/route.js`
  - Preserves route validation evidence.
  - Adds an enforcement-mode structural blocker guard before PDF rendering/storage.
- `scripts/generate-human-review-readiness-manifest.js`
  - New privacy-safe manifest generator and verifier.
- `scripts/run-final-option-structure-shadow-report.js`
  - New saved-replay shadow comparison report.
- `tests/finalOptionStructureValidator.test.js`
  - New focused structural validator and shadow-builder tests.
- `tests/humanReviewManifest.test.js`
  - New privacy-safe manifest and source-drift tests.
- `tests/ui-source.test.js`
  - Added a source assertion that PDF rejects structural blockers before rendering.

## Final Ownership Boundaries

- `optionPriceNormalizer`: extracts price candidates and local evidence. It does not construct final customer options.
- `priceReconciliation`: classifies price evidence and arithmetic relationships. It does not decide final customer-facing choices.
- `canonicalServiceAssembler`: owns the shadow canonical relationship model and the conservative final customer option builder.
- `finalOptionStructureValidator`: owns machine-readable structural invariants.
- `validateJson`: combines semantic, reconciliation, and structural validation into readiness.
- Preview/PDF routes: must consume validation output. PDF now rejects structural blockers in enforcement mode before rendering.

## Data-Model Additions

Canonical service items now carry separate dimensions:

- `service_role`
- `price_relationship`
- `selectability`
- `item_id`
- `price_id`
- `base_item_id`
- `target_id`
- `component_item_ids`
- `source_spans`
- `confidence`
- `provenance`
- `builder_version`

The shadow final-option model is attached under:

- `normalization.canonical_final_option_model`

Validation now exposes:

- `structural_errors`
- `structural_error_codes`
- `structural_blocking_errors`
- `structural_enforcement_enabled`
- `final_option_structural_hash`
- `final_option_structure_validator_version`
- `canonical_option_model`

## Structural Error Codes Implemented

- `AMBIGUOUS_OPTION_RELATIONSHIP`
- `CONFLICTING_PACKAGE_TOTAL`
- `UNSUPPORTED_RELATIONSHIP_ARITHMETIC`
- `TARGET_BINDING_UNRESOLVED`
- `MISSING_BASE_CHOICE`
- `MULTI_ADDON_COMBINATION_UNSUPPORTED`
- `DEPENDENT_ADDON_STANDALONE`
- `EXPANDED_SCOPE_INCOMPLETE`
- `EXPANDED_PRICE_MISMATCH`
- `BASE_SCOPE_INCLUDES_ADDON`
- `INVALID_OPTION_LABEL_SEQUENCE`
- `GENERIC_OPTION_SCOPE`
- `CONTAMINATED_OPTION_SCOPE`
- `SAFETY_TEXT_IN_CUSTOMER_SCOPE`

## Builder Rules Implemented

The cumulative option builder constructs customer options only when all of these are true:

- one concrete base service exists;
- one recognized dependent add-on exists;
- source price evidence is accepted;
- a supported total equals base price plus add-on price;
- base and add-on target facts are compatible;
- no package, discount, per-unit, conditional, optional, included, separate, or conflicting wording is present;
- no multi-add-on combination is needed;
- the expanded scope can be built without inventing facts.

For `obs_0724`, the shadow builder constructs:

- Option A: take down the dead ash tree by the shed, `$2,500`;
- Option B: take down the dead ash tree by the shed and grind the stump, `$3,250`.

The `$750` stump-grinding amount remains audit evidence. It is not emitted as a standalone customer option by the shadow builder.

## Intentionally Blocked or Deferred

- Production output is not changed.
- The new builder is not enabled for live customer-facing rendering.
- Structural blocking is default-off.
- Multi-add-on combination generation is detected and blocked, not solved.
- Full persistence/schema migration is deferred.
- Structured relationship-edit UI is deferred.
- Full preview/PDF immutable binding by stored record version, input hash, model hash, and approval hash is deferred.
- Authoritative held-out semantic review remains required before enabling enforcement.

## Test Commands and Results

Baseline focused tests before implementation:

```bash
node --test tests/optionPriceNormalizer.test.js tests/priceReconciliation.test.js tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js tests/unit.test.js tests/workflow.test.js tests/ui-source.test.js
```

Result: 156 tests, 0 failures.

Syntax checks after implementation:

```bash
node --check lib/canonicalServiceAssembler.js
node --check lib/finalOptionStructureValidator.js
node --check lib/validateJson.js
node --check lib/reviewOverrides.js
node --check app/api/pdf/route.js
node --check lib/validateRoutePayload.js
node --check scripts/generate-human-review-readiness-manifest.js
node --check scripts/run-final-option-structure-shadow-report.js
```

Result: all passed.

Manifest generation:

```bash
node scripts/generate-human-review-readiness-manifest.js
```

Result: 35 records, 34 authoritative records, 1 extra regression record.

Manifest verification:

```bash
node scripts/generate-human-review-readiness-manifest.js --verify-existing
```

Result: passed. Authoritative position 1 is `obs_0724`; extra regression is `obs_0730`.

Focused implementation tests:

```bash
node --test tests/optionPriceNormalizer.test.js tests/priceReconciliation.test.js tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js tests/finalOptionStructureValidator.test.js tests/humanReviewManifest.test.js tests/unit.test.js tests/workflow.test.js tests/ui-source.test.js
```

Result: 169 tests, 0 failures.

Full test suite:

```bash
node --test tests/*.test.js
```

Result: 406 tests, 0 failures.

Local HTTP validation with `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=true`:

- `POST http://127.0.0.1:3000/api/validate` with `obs_0724`: status `200`, `can_generate_pdf=false`, structural codes `DEPENDENT_ADDON_STANDALONE`, `EXPANDED_PRICE_MISMATCH`, `INVALID_OPTION_LABEL_SEQUENCE`.
- `POST http://127.0.0.1:3000/api/pdf` with `obs_0724`: status `400`, error `Final customer option structure must be fixed before generating customer documents.`

No live production API calls were made.

## Replay Results and Counts

Shadow comparison command:

```bash
node scripts/run-final-option-structure-shadow-report.js
```

Result files:

- `reports/final-option-structure-shadow-report.json`
- `reports/final-option-structure-shadow-report.md`

Counts:

| Cohort | Corrected outputs | Newly blocked outputs | Unchanged outputs | Ambiguous outputs | Potential regressions |
|---|---:|---:|---:|---:|---:|
| Full 382 | 32 | 186 | 129 | 196 | 152 |
| Authoritative 34 | 32 | 34 | 0 | 2 | 0 |
| Extra regression | 0 | 0 | 1 | 0 | 0 |

Interpretation:

- All 34 authoritative reviewed cases would be blocked under structural enforcement.
- 32 of those 34 can be automatically reconstructed into base plus cumulative customer options.
- 2 of those 34 remain ambiguous and must stay blocked.
- 152 currently PDF-ready records outside the reviewed cohort would newly block. These are potential regressions until human semantic review says otherwise.

## Active Versus Shadow Differences

- Active production behavior remains unchanged by default.
- Shadow diagnostics are added to validation output.
- With enforcement off, structural errors are reported but do not change `can_generate_pdf`.
- With `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=true`, structural errors become blockers and PDF generation rejects before rendering.
- The shadow builder can construct the corrected final customer option model, but that model is not used as the active production renderer.

## Privacy Treatment

The committed manifest artifacts are privacy-safe:

- `reports/human-review-34-readiness-reconciliation-manifest.jsonl`
- `reports/human-review-34-readiness-reconciliation-manifest.md`

The JSONL manifest stores:

- SHA-256 raw note hashes;
- observation IDs;
- source filenames and line references;
- readiness states;
- cohort membership;
- expected final option structures.

It does not store full raw customer notes, phone fields, customer names, email fields, or unredacted email domains.

## Schema and Migration Status

This pass uses an in-memory versioned model and structural hashes. It does not perform a database or persisted-record schema migration.

Remaining persistence work:

- store builder version;
- store input hash;
- store canonical model hash;
- store final-option structural hash;
- bind approval and PDF rendering to those hashes;
- require reapproval when current structural hash differs from approved structural hash.

## Remaining Risks

- The 152 potential regressions from the full 382 replay need human semantic review before enforcement.
- Same-target binding is conservative and source-evidence based. It should block rather than guess when target facts are unclear.
- Safety/access wording is detected as customer-scope contamination, but the full warning-versus-blocker product policy remains unresolved.
- Old saved estimates can ignore unknown fields, but server-side persisted approval binding is not complete.
- Preview rendering still uses the active option list unless future work switches it to consume the validated canonical final-option model.

## Unresolved Product Decisions

- Whether safety/access facts should always warn or sometimes block.
- How structured relationship edits should look in the review UI.
- Whether the first production rollout should enforce only the reviewed 34 patterns or a broader detector.
- What held-out semantic review threshold is required before enabling enforcement.
- Whether package/discount cases should get a separate customer-facing total renderer in the next pass.

## Ready for Second Review

Yes for second code review and semantic review of the shadow model.

No for production enablement. Enforcement and active builder output must remain disabled until the 152 potential regressions and held-out semantic review are resolved.

## Concise Diff Summary

- Added privacy-safe manifest generation and verification.
- Added a shadow canonical final-option model.
- Added a structural validator with stable machine-readable codes.
- Added default-off enforcement wiring through validation and PDF.
- Preserved generic override safety by preventing structural blockers from being cleared.
- Added tests for `obs_0724`, override behavior, route parity, manifest privacy, no-total add-ons, multi-add-on blocking, package/discount/per-unit/conditional blocking, target binding, and safety-scope contamination.
- Added saved-replay shadow reporting for the authoritative 34, the extra `obs_0730` regression, and the full 382 replay.
