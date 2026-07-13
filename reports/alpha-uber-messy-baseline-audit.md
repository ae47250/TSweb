# Alpha uber-messy Baseline Audit

Approval date: 2026-07-10
Approval status: approved_by_user_request
Fixture checksum: 153a0a636b61706d3bb4f52d79f7ad2740e46356c662c3d7297291e0c626cc0e

## Summary

| Metric | Value |
| --- | ---: |
| Total cases | 150 |
| Current passing cases | 102 |
| Observed current failures | 48 |
| Approved non-defect failure baseline | 48 |
| True defects excluded from baseline | 0 |
| Pass rate | 68% |
| Recovered after follow-up | 122 |
| Still blocked after follow-up | 28 |

## Classifications

| Classification | Count |
| --- | ---: |
| correct_safe_block_follow_up | 28 |
| stale_or_incorrect_expectation | 20 |

## Failure Buckets

| Failure bucket | Count |
| --- | ---: |
| follow_up_unrecovered | 28 |
| parser_price_options | 9 |
| parser_tree_count | 18 |

## Regression Rule

- Do not require all deliberately adversarial cases to pass.
- Future runs must not introduce non-defect failing case IDs outside this approved audit set.
- Future runs must not exceed the approved non-defect failing count or still-blocked count.
- True defects remain normal test failures and are not included in the approved non-defect baseline.
- Safe blocking/follow-up is allowed when evidence remains insufficient.

## Case Audit

| Case | Classification | Failure categories | Initial ready | Final ready | Rationale |
| --- | --- | --- | --- | --- | --- |
| case_0038 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0059 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0078 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0250 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0259 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0318 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0359 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0410 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0429 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0449 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0478 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0490 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0509 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0518 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0529 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0658 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0670 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0710 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0909 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0919 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0939 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0999 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1028 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1099 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1168 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1229 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1320 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1440 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1458 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1538 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1589 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1680 | stale_or_incorrect_expectation | parser_tree_count, parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1759 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1809 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1839 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1848 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1889 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1949 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1969 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1978 | stale_or_incorrect_expectation | parser_tree_count | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_0358 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0468 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1338 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1718 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1810 | stale_or_incorrect_expectation | parser_price_options | no | yes | The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate. |
| case_1989 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0399 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_0839 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
