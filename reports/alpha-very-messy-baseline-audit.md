# Alpha very-messy Baseline Audit

Approval date: 2026-07-10
Approval status: approved_by_user_request
Fixture checksum: f043cc6a5535423cd65c8289a9850ddd04b3a4b5e38ef5fb5b35b36f5ce47fff

## Summary

| Metric | Value |
| --- | ---: |
| Total cases | 150 |
| Current passing cases | 112 |
| Observed current failures | 38 |
| Approved non-defect failure baseline | 9 |
| True defects excluded from baseline | 29 |
| Pass rate | 74.67% |
| Recovered after follow-up | 31 |
| Still blocked after follow-up | 0 |

## Classifications

| Classification | Count |
| --- | ---: |
| stale_or_incorrect_expectation | 9 |
| true_defect | 29 |

## Failure Buckets

| Failure bucket | Count |
| --- | ---: |
| parser_price_options | 38 |

## Regression Rule

- Do not require all deliberately adversarial cases to pass.
- Future runs must not introduce non-defect failing case IDs outside this approved audit set.
- Future runs must not exceed the approved non-defect failing count or still-blocked count.
- True defects remain normal test failures and are not included in the approved non-defect baseline.
- Safe blocking/follow-up is allowed when evidence remains insufficient.

## Case Audit

| Case | Classification | Failure categories | Initial ready | Final ready | Rationale |
| --- | --- | --- | --- | --- | --- |
| case_0277 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0321 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0475 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0541 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0652 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1051 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1175 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1497 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1567 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1573 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1654 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0037 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0147 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0477 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0514 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0671 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0941 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1162 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1195 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1202 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1213 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0590 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1391 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_0628 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0659 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1444 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1010 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1457 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1048 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1467 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1069 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1090 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1525 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1179 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1635 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1228 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1653 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
| case_1754 | true_defect | parser_price_options | yes | yes | The fixture expects a parse-ready result, and the current parser output does not match the expected field values. |
