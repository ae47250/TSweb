# Final Option Structure Shadow Report

- Replay source: reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl
- Manifest source: reports/human-review-34-readiness-reconciliation-manifest.jsonl
- Total replay records: 382

## Counts

| Cohort | Corrected outputs | Newly blocked outputs | Unchanged outputs | Ambiguous outputs | Potential regressions |
|---|---:|---:|---:|---:|---:|
| Full 382 | 278 | 183 | 137 | 60 | 150 |
| Authoritative 34 | 1 | 33 | 0 | 11 | 0 |
| Extra regression | 1 | 0 | 1 | 0 | 0 |

## Structural Codes In Full 382

- AMBIGUOUS_PRICE_ROLE: 100
- EXPANDED_SCOPE_INCOMPLETE: 96
- INVALID_OPTION_LABEL_SEQUENCE: 87
- AMBIGUOUS_OPTION_RELATIONSHIP: 60
- DEPENDENT_ADDON_STANDALONE: 50
- EXPLICIT_QUANTITY_OMITTED_OR_CHANGED: 49
- REVERSED_BASE_ADDON_ORDER: 17
- BASE_SCOPE_INCLUDES_ADDON: 9
- INCREMENTAL_ADDON_USED_AS_TOTAL: 9

## Potential Regression IDs

- obs_0003
- obs_0005
- obs_0007
- obs_0008
- obs_0010
- obs_0011
- obs_0016
- obs_0022
- obs_0028
- obs_0033
- obs_0034
- obs_0035
- obs_0040
- obs_0041
- obs_0042
- obs_0043
- obs_0046
- obs_0048
- obs_0050
- obs_0051
- obs_0052
- obs_0060
- obs_0062
- obs_0063
- obs_0069
- obs_0070
- obs_0072
- obs_0073
- obs_0076
- obs_0077
- obs_0081
- obs_0082
- obs_0090
- obs_0092
- obs_0093
- obs_0099
- obs_0106
- obs_0111
- obs_0115
- obs_0118
- obs_0119
- obs_0125
- obs_0128
- obs_0130
- obs_0133
- obs_0137
- obs_0139
- obs_0140
- obs_0145
- obs_0146
- obs_0148
- obs_0150
- obs_0151
- obs_0153
- obs_0156
- obs_0158
- obs_0162
- obs_0164
- obs_0167
- obs_0168
- obs_0174
- obs_0175
- obs_0178
- obs_0179
- obs_0184
- obs_0185
- obs_0186
- obs_0188
- obs_0190
- obs_0191
- obs_0197
- obs_0198
- obs_0199
- obs_0200
- obs_0214
- obs_0220
- obs_0224
- obs_0280
- obs_0290
- obs_0316
- obs_0354
- obs_0357
- obs_0358
- obs_0363
- obs_0372
- obs_0381
- obs_0388
- obs_0390
- obs_0425
- obs_0426
- obs_0443
- obs_0452
- obs_0466
- obs_0507
- obs_0533
- obs_0539
- obs_0550
- obs_0554
- obs_0557
- obs_0572
- obs_0573
- obs_0592
- obs_0607
- obs_0620
- obs_0642
- obs_0660
- obs_0663
- obs_0671
- obs_0699
- obs_0703
- obs_0707
- obs_0723
- obs_0731
- obs_0742
- obs_0744
- obs_0770
- obs_0771
- obs_0773
- obs_0780
- obs_0787
- obs_0797
- obs_0804
- obs_0808
- obs_0810
- obs_0811
- obs_0822
- obs_0838
- obs_0865
- obs_0869
- obs_0884
- obs_0885
- obs_0888
- obs_0894
- obs_0903
- obs_0905
- obs_0910
- obs_0915
- obs_0917
- obs_0918
- obs_0920
- obs_0926
- obs_0931
- obs_0937
- obs_0948
- obs_0951
- obs_0954
- obs_0963
- obs_0968
- obs_0975
- obs_0980

## Notes

- This is a local saved-replay shadow analysis only. It does not call live OpenAI or production APIs.
- Newly blocked means the current active validation was PDF-ready but structural enforcement would block it.
- Corrected outputs means the shadow canonical model can build two final customer options for a dependent-add-on structure.
- Potential regressions are non-reviewed records that are currently PDF-ready and would be blocked by the new structural validator.
