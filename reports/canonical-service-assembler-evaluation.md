# Canonical Service Assembler Evaluation

Generated: 2026-07-10T15:49:39.834Z

No OpenAI calls were made. This is a local deterministic replay over stored artifacts. Production customer-facing behavior was not changed.

## 1. Production Map

- Active API and validation routes still use the existing AlphaJSON normalization, sidecar reconciliation, validation, TD2 review, and document rendering path.
- The new canonical service assembler is present as a pure module only.
- The feature flag is `ENABLE_CANONICAL_SERVICE_ASSEMBLER`; default behavior is disabled.
- Renderer and PDF code remain consumers, not builders of service identity.

## 2. Baseline And Provenance

| Item | Value |
|---|---|
| Commit | cdca3398c5b4db3abedd24c8d46f310da420a233 |
| Branch | master |
| Dirty files | ?? docs/<br>?? lib/canonicalServiceAssembler.js<br>?? reports/canonical-option-builder-simulation.jsonl<br>?? reports/canonical-option-builder-simulation.md<br>?? reports/canonical-service-assembler-evaluation.jsonl<br>?? reports/canonical-service-assembler-evaluation.md<br>?? reports/canonical-service-assembler-heldout-manifest.json<br>?? reports/canonical-service-assembler-input-contract.json<br>?? reports/canonical-service-assembler-release-gates.json<br>?? reports/canonical-service-assembler-shadow.jsonl<br>?? scripts/canonical-option-builder-simulation.js<br>?? scripts/canonical-service-assembler-evaluation.js<br>?? scripts/canonical-service-assembler-shadow.js<br>?? tests/canonicalServiceAssembler.test.js |
| Replay source | C:\Users\eiriksson\Documents\TSweb\reports\live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl |
| Replay checksum | 464161a283f1d30b8b5936a18e54e6c20e33f32838e6de067d7829a6ea3ffbcf |
| Held-out source | C:\Users\eiriksson\Documents\TSweb\reports\liveapi-20case-deep-dive.jsonl |
| Module checksum | f405ce79725b9ab773c09397f4c37476f18fd8803d31532e1613659719615fd3 |
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
- `UNRESOLVED_RELATIONSHIP`
- `UNSUPPORTED_FINAL_PRICE`
- `UNPRICED_RENDERED_ITEM`
- `VALIDATED_RENDER_MISMATCH`

## 9. 382 Replay Results

| Metric | Current | Assembler Shadow | Delta |
|---|---:|---:|---:|
| Exact amount rows | 301/382 78.8% | 382/382 100.0% | 81 |
| Expected-price recall | 671/763 87.9% | 763/763 100.0% | 92 |
| Exact service-kind rows | 132/382 34.6% | 340/382 89.0% | 208 |
| Exact amount-kind rows | 132/382 34.6% | 340/382 89.0% | 208 |
| Semantic PDF-ready rows | n/a | 354/382 92.7% | n/a |

## 10. Structural Counters

| Counter | Cases |
|---|---:|
| Semantic ready but wrong | 14 |
| Correct but blocked | 0 |
| Valid price-drop cases | 0 |
| Valid amount-kind pair-drop cases | 42 |
| Determinism failures | 0 |
| Renderer hash mismatches | 0 |

| Error code | Rows |
|---|---:|
| FABRICATED_SCOPE_FACT | 28 |

## 11. Required Traces

| Case | Canonical service items | Rendered wording | Readiness |
|---|---|---|---|
| obs_0839 | tree_removal $2,050 primary_service<br>stump_grinding $450 optional_add_on | Tree Removal: Remove cedar toward garage. $2,050<br>Stump Grinding: Grind the stump as described in the job notes. $450 | semantic_ready=true, errors=0 |
| obs_0907 | tree_trim $1,100 primary_service | Tree Trimming: Trim two locust trees along alley. $1,100 | semantic_ready=true, errors=0 |
| obs_0909 | tree_removal $1,700 primary_service<br>stump_grinding $900 optional_add_on | Tree Removal: Remove three small ornamental pears. $1,700<br>Stump Grinding: Grind the stump as described in the job notes. $900 | semantic_ready=true, errors=0 |

## 12. Shadow Comparison

- Shadow mode writes comparison artifacts only.
- It does not alter `service_options.items` in the active API path.
- Classifications: improved 208, unchanged 146, regressed 0, uncertain 28.
- Separate shadow detail is written by `scripts/canonical-service-assembler-shadow.js`.

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

- Unit/integration tests added for disabled flag, input isolation, named replay cases, action conflicts, duplicates, deterministic hashing, and approval invalidation.
- Replay command: `node scripts/canonical-service-assembler-evaluation.js`.
- Shadow command: `node scripts/canonical-service-assembler-shadow.js`.
- Focused test command: `node --test tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js`.

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
| zero 382 replay semantic-ready-but-wrong cases | no |
| no regression from best baseline in price correctness | yes |
| no valid prices dropped | yes |
| deterministic and idempotent construction | yes |
| validated semantic hash equals renderer-input semantic hash | yes |
| all uncertain relationships remain blocked or require explicit TD resolution | yes |
| held-out results satisfy the same gates | no |

## 17. Implement Revise Reject

| Decision | Recommendation |
|---|---|
| Implement | Keep the module, type definitions, validation codes, reports, and tests behind disabled/shadow mode. |
| Revise | Improve service-kind labels, relationships, evidence coverage, fabricated-scope checks, and held-out labels before production. |
| Reject | Reject wording-only fixes, raw span copying, benchmark leakage, price-only correctness, and production enablement before semantic gates pass. |

## 18. Final Decision

REVISE
