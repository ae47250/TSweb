# Canonical Service Assembler Evaluation

Generated: 2026-07-10T18:03:36.615Z

No OpenAI calls were made. This is a local deterministic replay over stored artifacts. Production customer-facing behavior was not changed.

## 1. Production Map

- Active API and validation routes still use the existing AlphaJSON normalization, sidecar reconciliation, validation, TD2 review, and document rendering path.
- The new canonical service assembler is present as a pure module only.
- The feature flag is `ENABLE_CANONICAL_SERVICE_ASSEMBLER`; default behavior is disabled.
- Renderer and PDF code remain consumers, not builders of service identity.

## 2. Baseline And Provenance

| Item | Value |
|---|---|
| Commit | 7eb4476a7031c9af83e801271819baca4bb2007d |
| Branch | codex/canonical-service-assembler-shadow |
| Dirty files | M lib/canonicalServiceAssembler.js<br> M reports/canonical-service-assembler-evaluation.jsonl<br> M reports/canonical-service-assembler-evaluation.md<br> M reports/canonical-service-assembler-heldout-manifest.json<br> M reports/canonical-service-assembler-input-contract.json<br> M reports/canonical-service-assembler-release-gates.json<br> M reports/canonical-service-assembler-shadow.jsonl<br> M scripts/canonical-service-assembler-evaluation.js<br> M tests/canonicalServiceAssembler.test.js<br>?? reports/canonical-option-builder-simulation.jsonl<br>?? reports/canonical-option-builder-simulation.md<br>?? scripts/canonical-option-builder-simulation.js |
| Replay source | C:\Users\eiriksson\Documents\TSweb\reports\live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl |
| Replay checksum | 464161a283f1d30b8b5936a18e54e6c20e33f32838e6de067d7829a6ea3ffbcf |
| Held-out source | C:\Users\eiriksson\Documents\TSweb\reports\liveapi-20case-deep-dive.jsonl |
| Module checksum | 5465b0ceeb1a7bef2103c4180f87a4e5e986cdc02dad3e9fb1450187afb95a65 |
| Prompt checksum | 87505ece92e2a7ceb196704c3cbb00d116825dab32be58574b917615e17ac949 |
| Schema checksum | e85d974cc4a8c949c6da46cb4fadc650308c42830f3487b50e14219ebed88710 |
| Best prior source | C:\Users\eiriksson\Documents\TSweb\reports\canonical-option-builder-simulation.jsonl |
| Best prior status | loaded |
| Prior recommendation | REVISE |

## 3. Input Contract And Isolation

- Builder input is limited to `normalizedJobFacts`, `typedPriceEvidence`, and `extractedRelationships`.
- Forbidden benchmark fields include expected labels, expected amounts, service-kind labels, pass/fail flags, and reviewer conclusions.
- Expected labels are loaded only after construction for scoring.
- Leakage failures in replay: 0/382.

## 4. Builder Architecture

- `buildCanonicalServiceItems(...)` creates typed canonical items with service kind, amount, relationship, scope evidence, uncertainty, and source price occurrence.
- `renderCanonicalOptionWording(...)` turns canonical items into customer-facing titles/descriptions.
- Price preservation, service kind, and relationship structure are built before wording.
- This rejects wording-only fixes because wording cannot safely decide whether $900 is stump grinding, removal, haul-away, or a rejected artifact.

## 5. Service Kinds And Relationships

| Type | Values |
|---|---|
| Service kinds | tree_removal, tree_trim, limb_removal, stump_grinding, haul_away, brush_cleanup, storm_cleanup, other_supported_service, unresolved_service |
| Relationship types | primary_service, required_component, optional_add_on, total, component_of, restates, alternative_to, alternative_customer_choice, unresolved_relationship |

## 6. Evidence Assignment

- Every rendered option points back to one or more supporting price occurrence IDs.
- Address/contact-like local price context is quarantined when it lacks a service kind.
- Duplicate same amount/service-kind records are collapsed unless an allowed relationship exists.
- Scope wording is generated from supported facts only.

## 7. Wording Renderer

- Titles are action-specific: Tree Removal, Tree Trimming, Stump Grinding, Haul Away, Brush Cleanup, Storm Cleanup.
- Descriptions use action-consistent verbs.
- Raw spans remain audit evidence; they are not copied directly into customer-facing wording.
- The renderer has no authority to create prices or relationships.

## 8. Semantic Validation Codes

- `SERVICE_KIND_EVIDENCE_MISMATCH`
- `AMOUNT_SERVICE_PAIRING_MISMATCH`
- `TITLE_DESCRIPTION_ACTION_CONFLICT`
- `DUPLICATE_SEMANTIC_ITEM`
- `UNSUPPORTED_SERVICE_SCOPE`
- `FABRICATED_SCOPE_FACT`
- `SERVICE_SCOPE_CONFLICT`
- `UNSUPPORTED_SCOPE_INFERENCE`
- `OMITTED_SUPPORTED_SCOPE`
- `SCOPE_ASSIGNED_TO_WRONG_SERVICE`
- `AMBIGUOUS_SCOPE_FACT`
- `UNRESOLVED_RELATIONSHIP`
- `UNSUPPORTED_FINAL_PRICE`
- `UNPRICED_RENDERED_ITEM`
- `VALIDATED_RENDER_MISMATCH`

## 9. 382 Replay Results

| Metric | Current | Assembler Shadow | Delta |
|---|---:|---:|---:|
| Exact amount rows | 301/382 78.8% | 382/382 100.0% | 81 |
| Expected-price recall | 671/763 87.9% | 763/763 100.0% | 92 |
| Exact service-kind rows | 142/382 37.2% | 382/382 100.0% | 240 |
| Exact amount-kind rows | 142/382 37.2% | 382/382 100.0% | 240 |
| Semantic PDF-ready rows | n/a | 382/382 100.0% | n/a |

## 10. Structural Counters

| Counter | Cases |
|---|---:|
| Semantic ready but wrong | 0 |
| Correct but blocked | 0 |
| Valid price-drop cases | 0 |
| Valid amount-kind pair-drop cases | 0 |
| Determinism failures | 0 |
| Renderer hash mismatches | 0 |

| Error code | Rows |
|---|---:|
| none | 0 |

Absolute semantic classifications:

| Classification | Rows |
|---|---:|
| correct_and_improved | 240 |
| correct_and_unchanged | 142 |
| still_wrong | 0 |
| semantic_regression | 0 |
| unsafe_ready | 0 |
| overblocked | 0 |
| unresolved | 0 |

## 11. Required Traces

| Case | Canonical service items | Rendered wording | Readiness |
|---|---|---|---|
| obs_0839 | tree_removal $2,050 primary_service<br>stump_grinding $450 optional_add_on | Tree Removal: Remove cedar toward garage. $2,050<br>Stump Grinding: Grind the stump as described in the job notes. $450 | semantic_ready=true, errors=0 |
| obs_0907 | tree_trim $1,100 primary_service | Tree Trimming: Trim two locust trees along alley. $1,100 | semantic_ready=true, errors=0 |
| obs_0909 | tree_removal $1,700 primary_service<br>stump_grinding $900 optional_add_on | Tree Removal: Remove three small ornamental pears. $1,700<br>Stump Grinding: Grind the stump as described in the job notes. $900 | semantic_ready=true, errors=0 |

## 12. Shadow Comparison

- Shadow mode writes comparison artifacts only.
- It does not alter `service_options.items` in the active API path.
- Absolute classifications: correct_and_improved 240, correct_and_unchanged 142, still_wrong 0, unsafe_ready 0, unresolved 0, overblocked 0.
- Separate shadow detail is written by `scripts/canonical-service-assembler-shadow.js`.

Previously unsafe-ready root causes:

| Case | Root cause | Why construction failed | Why validation allowed readiness | Status after revision |
|---|---|---|---|---|
| obs_0401 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0429 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0456 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0460 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0465 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0491 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0543 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0552 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0606 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0652 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0667 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0674 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0679 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |
| obs_0696 | misleading boilerplate such as stump/haul if listed | Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount. | Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised. | resolved_in_shadow |

Previously broad scope-error classifications:

| Case | Classification | Previous codes | After codes | Disposition |
|---|---|---|---|---|
| obs_0405 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0427 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0431 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0442 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0488 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0498 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0500 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0504 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0518 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0521 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0526 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0527 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0532 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0536 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0563 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0564 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0587 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0594 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0596 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0609 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0630 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0632 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0645 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0657 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0658 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0692 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0693 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |
| obs_0695 | service-kind mismatch causing an apparent scope conflict | FABRICATED_SCOPE_FACT | none | resolved |

## 13. Held-Out Status

- Status: BLOCKED - INSUFFICIENT GROUND TRUTH.
- Semantic truth available: false.
- Gate pass: false.
- Reason: Held-out artifact has price/readiness expectations but lacks authoritative service-kind and relationship labels.

## 14. Held-Out Label Packet

- Manifest: C:\Users\eiriksson\Documents\TSweb\reports\canonical-service-assembler-heldout-manifest.json.
- Required labels: service kind, amount, relationship type, source span, and reviewer notes for each canonical service item.
- Price-only labels are insufficient for production enablement.

## 15. Tests

- Unit/integration tests cover disabled flag, input isolation, named replay cases, the 14 prior unsafe-ready cases, the 28 prior scope-conflict cases, action conflicts, duplicates, every structural validation code, deterministic hashing, and approval invalidation.
- Replay command: `node scripts/canonical-service-assembler-evaluation.js`.
- Shadow command: `node scripts/canonical-service-assembler-shadow.js`.
- Focused test command: `node --test tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js`.
- Full suite caveat: the known alpha-uber-messy cohort failure was independently verified at 48 failing cases on both the clean baseline and this branch; the full suite must not be reported as passing until that separate baseline issue is resolved.

Known full-suite baseline comparison:

| Check | Clean baseline | Revised shadow branch |
|---|---:|---:|
| alpha-uber-messy failing cases, run 1 | 48 | 48 |
| alpha-uber-messy failing cases, run 2 | 48 | 48 |

## 16. Rollback And Feature Flag

- Rollback is disabling `ENABLE_CANONICAL_SERVICE_ASSEMBLER` or leaving it unset.
- Current code has no production integration, so rollback is immediate.
- Production enablement requires passing release gates and an authoritative held-out semantic set.

Production gate results:

| Gate | Pass |
|---|---:|
| production assembler remains behind disabled flag | yes |
| zero PDF-ready duplicate semantic items | yes |
| zero PDF-ready amount-to-service-kind mismatches | yes |
| zero PDF-ready title/description action conflicts | yes |
| zero fabricated scope facts in PDF-ready estimates | yes |
| zero unresolved structural errors that remain PDF-ready | yes |
| obs_0907, obs_0839, and obs_0909 remain fixed | yes |
| zero 382 replay semantic-ready-but-wrong cases | yes |
| PDF-ready amount-kind mismatches are zero | yes |
| exact amount-kind rows remain 382/382 | yes |
| exact price rows remain 382/382 | yes |
| no regression from best baseline in price correctness | yes |
| no valid prices dropped | yes |
| deterministic and idempotent construction | yes |
| validated semantic hash equals renderer-input semantic hash | yes |
| all uncertain relationships remain blocked or require explicit TD resolution | yes |
| known alpha-uber-messy failure does not exceed clean baseline of 48 | yes |
| held-out results satisfy the same gates | no |

## 17. Implement Revise Reject

| Decision | Recommendation |
|---|---|
| Implement | Keep the module, type definitions, validation codes, reports, and tests behind disabled/shadow mode. |
| Revise | Improve service-kind labels, relationships, evidence coverage, fabricated-scope checks, and held-out labels before production. |
| Reject | Reject wording-only fixes, raw span copying, benchmark leakage, price-only correctness, and production enablement before semantic gates pass. |

## 18. Final Decision

REVISE
