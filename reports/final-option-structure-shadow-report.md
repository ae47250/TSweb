# Final Option Structure Shadow Report

- Replay source: reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl
- Manifest source: reports/human-review-34-readiness-reconciliation-manifest.jsonl
- Total replay records: 382

## Counts

| Cohort | Corrected outputs | Newly blocked outputs | Unchanged outputs | Ambiguous outputs | Potential regressions |
|---|---:|---:|---:|---:|---:|
| Full 382 | 289 | 59 | 265 | 56 | 26 |
| Authoritative 34 | 1 | 33 | 0 | 11 | 0 |
| Extra regression | 1 | 0 | 1 | 0 | 0 |

## Structural Codes In Full 382

- AMBIGUOUS_PRICE_ROLE: 89
- INVALID_OPTION_LABEL_SEQUENCE: 88
- AMBIGUOUS_OPTION_RELATIONSHIP: 56
- DEPENDENT_ADDON_STANDALONE: 47
- REVERSED_BASE_ADDON_ORDER: 17
- BASE_SCOPE_INCLUDES_ADDON: 10
- EXPANDED_SCOPE_INCOMPLETE: 10
- INCREMENTAL_ADDON_USED_AS_TOTAL: 10
- EXPLICIT_QUANTITY_OMITTED_OR_CHANGED: 2

## Potential Regression IDs

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
- obs_0507
- obs_0607
- obs_0620
- obs_0660
- obs_0780
- obs_0787
- obs_0810
- obs_0865

## Notes

- This is a local saved-replay shadow analysis only. It does not call live OpenAI or production APIs.
- Newly blocked means the current active validation was PDF-ready but structural enforcement would block it.
- Corrected outputs means the shadow canonical model can build two final customer options for a dependent-add-on structure.
- Potential regressions are non-reviewed records that are currently PDF-ready and would be blocked by the new structural validator.
