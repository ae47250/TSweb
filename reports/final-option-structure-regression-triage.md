# Final Option Structure Regression Triage

- Replay source: reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl
- Manifest source: reports/human-review-34-readiness-reconciliation-manifest.jsonl
- Total replay records: 382
- Active PDF-ready records: 322
- Newly blocked under shadow enforcement: 66
- Potential regressions requiring held-out semantic review: 33

## Mutually Exclusive Categories

| Category | Count |
|---|---:|
| shadow_correction_available_no_block | 254 |
| unchanged_not_pdf_ready | 57 |
| reviewed_authoritative_structural_block | 33 |
| potential_regression_dependent_addon_structure | 17 |
| potential_regression_other_structural | 16 |
| shadow_correction_available_already_blocked | 2 |
| extra_regression_no_new_block | 1 |
| reviewed_authoritative_no_new_block | 1 |
| unchanged_pdf_ready | 1 |

## Cohorts

| Cohort | Count |
|---|---:|
| full_382_only | 347 |
| authoritative_34 | 34 |
| extra_regression | 1 |

## Triage Buckets

| Bucket | Count |
|---|---:|
| none | 258 |
| dependent_addon_structure | 54 |
| other_structural | 49 |
| ambiguous_or_unsupported_relationship | 21 |

## Structural Codes

| Code | Count |
|---|---:|
| AMBIGUOUS_PRICE_ROLE | 89 |
| INVALID_OPTION_LABEL_SEQUENCE | 88 |
| AMBIGUOUS_OPTION_RELATIONSHIP | 56 |
| DEPENDENT_ADDON_STANDALONE | 47 |
| EXPANDED_SCOPE_INCOMPLETE | 17 |
| REVERSED_BASE_ADDON_ORDER | 17 |
| BASE_SCOPE_INCLUDES_ADDON | 10 |
| INCREMENTAL_ADDON_USED_AS_TOTAL | 10 |
| EXPLICIT_QUANTITY_OMITTED_OR_CHANGED | 2 |

## Potential Regression Review Set

- obs_0022
- obs_0033
- obs_0035
- obs_0051
- obs_0062
- obs_0069
- obs_0076
- obs_0092
- obs_0119
- obs_0137
- obs_0179
- obs_0184
- obs_0190
- obs_0199
- obs_0200
- obs_0214
- obs_0354
- obs_0357
- obs_0363
- obs_0507
- obs_0573
- obs_0607
- obs_0620
- obs_0660
- obs_0707
- obs_0780
- obs_0787
- obs_0802
- obs_0808
- obs_0810
- obs_0865
- obs_0884
- obs_0948

## Notes

- This report is generated from saved local replay JSONL only.
- The JSONL output intentionally excludes raw customer notes and full AlphaJSON payloads.
- Potential regression means the current active output is PDF-ready, but shadow structural enforcement would block it and the observation is outside the reviewed manifest.
- Every potential regression remains marked requires_held_out_semantic_review; this report is triage only, not semantic adjudication.
