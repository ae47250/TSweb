# Final Option Structure Shadow Report

- Replay source: reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl
- Manifest source: reports/human-review-34-readiness-reconciliation-manifest.jsonl
- Total replay records: 382

## Counts

| Cohort | Corrected outputs | Newly blocked outputs | Unchanged outputs | Ambiguous outputs | Potential regressions |
|---|---:|---:|---:|---:|---:|
| Full 382 | 32 | 186 | 129 | 196 | 152 |
| Authoritative 34 | 32 | 34 | 0 | 2 | 0 |
| Extra regression | 0 | 0 | 1 | 0 | 0 |

## Structural Codes In Full 382

- AMBIGUOUS_OPTION_RELATIONSHIP: 196
- DEPENDENT_ADDON_STANDALONE: 188
- INVALID_OPTION_LABEL_SEQUENCE: 74
- EXPANDED_PRICE_MISMATCH: 42
- SAFETY_TEXT_IN_CUSTOMER_SCOPE: 20
- MISSING_BASE_CHOICE: 8
- BASE_SCOPE_INCLUDES_ADDON: 3

## Potential Regression IDs

- obs_0004
- obs_0005
- obs_0015
- obs_0017
- obs_0020
- obs_0022
- obs_0025
- obs_0027
- obs_0028
- obs_0032
- obs_0033
- obs_0035
- obs_0040
- obs_0041
- obs_0044
- obs_0050
- obs_0051
- obs_0053
- obs_0057
- obs_0058
- obs_0059
- obs_0061
- obs_0066
- obs_0068
- obs_0069
- obs_0071
- obs_0072
- obs_0076
- obs_0079
- obs_0080
- obs_0091
- obs_0095
- obs_0099
- obs_0101
- obs_0103
- obs_0105
- obs_0106
- obs_0112
- obs_0113
- obs_0114
- obs_0115
- obs_0118
- obs_0119
- obs_0122
- obs_0123
- obs_0125
- obs_0127
- obs_0146
- obs_0147
- obs_0148
- obs_0150
- obs_0154
- obs_0157
- obs_0161
- obs_0167
- obs_0168
- obs_0170
- obs_0171
- obs_0177
- obs_0179
- obs_0181
- obs_0183
- obs_0184
- obs_0186
- obs_0190
- obs_0195
- obs_0198
- obs_0199
- obs_0214
- obs_0220
- obs_0224
- obs_0230
- obs_0239
- obs_0243
- obs_0247
- obs_0280
- obs_0293
- obs_0306
- obs_0316
- obs_0336
- obs_0354
- obs_0368
- obs_0373
- obs_0380
- obs_0388
- obs_0390
- obs_0403
- obs_0424
- obs_0426
- obs_0432
- obs_0472
- obs_0507
- obs_0533
- obs_0539
- obs_0549
- obs_0554
- obs_0562
- obs_0572
- obs_0576
- obs_0592
- obs_0607
- obs_0647
- obs_0650
- obs_0656
- obs_0660
- obs_0663
- obs_0703
- obs_0711
- obs_0712
- obs_0720
- obs_0721
- obs_0731
- obs_0739
- obs_0750
- obs_0761
- obs_0765
- obs_0770
- obs_0771
- obs_0773
- obs_0780
- obs_0786
- obs_0787
- obs_0797
- obs_0807
- obs_0808
- obs_0810
- obs_0821
- obs_0826
- obs_0841
- obs_0848
- obs_0865
- obs_0871
- obs_0873
- obs_0883
- obs_0884
- obs_0885
- obs_0896
- obs_0908
- obs_0915
- obs_0917
- obs_0919
- obs_0920
- obs_0924
- obs_0926
- obs_0944
- obs_0948
- obs_0950
- obs_0961
- obs_0975
- obs_0980
- obs_0988
- obs_1000

## Notes

- This is a local saved-replay shadow analysis only. It does not call live OpenAI or production APIs.
- Newly blocked means the current active validation was PDF-ready but structural enforcement would block it.
- Corrected outputs means the shadow canonical model can build two final customer options for a dependent-add-on structure.
- Potential regressions are non-reviewed records that are currently PDF-ready and would be blocked by the new structural validator.
