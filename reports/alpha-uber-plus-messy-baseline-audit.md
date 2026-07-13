# Alpha uber-plus-messy Baseline Audit

Approval date: 2026-07-10
Approval status: approved_by_user_request
Fixture checksum: 00799f02c3a465db64e6f8583dbf48d3fa898692ef1a1aa7c4038386fa2cf75c

## Summary

| Metric | Value |
| --- | ---: |
| Total cases | 150 |
| Current passing cases | 118 |
| Observed current failures | 32 |
| Approved non-defect failure baseline | 6 |
| True defects excluded from baseline | 26 |
| Pass rate | 78.67% |
| Recovered after follow-up | 82 |
| Still blocked after follow-up | 6 |

## Classifications

| Classification | Count |
| --- | ---: |
| correct_safe_block_follow_up | 6 |
| true_defect | 26 |

## Failure Buckets

| Failure bucket | Count |
| --- | ---: |
| follow_up_unrecovered | 6 |
| validator_readiness | 26 |

## Regression Rule

- Do not require all deliberately adversarial cases to pass.
- Future runs must not introduce non-defect failing case IDs outside this approved audit set.
- Future runs must not exceed the approved non-defect failing count or still-blocked count.
- True defects remain normal test failures and are not included in the approved non-defect baseline.
- Safe blocking/follow-up is allowed when evidence remains insufficient.

## Case Audit

| Case | Classification | Failure categories | Initial ready | Final ready | Rationale |
| --- | --- | --- | --- | --- | --- |
| case_0708 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1170 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1409 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1420 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1870 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0048 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0949 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1138 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1629 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1720 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1748 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1938 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0288 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1639 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1899 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1919 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1959 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1999 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0189 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0558 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0698 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0918 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1260 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1740 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1790 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_1908 | true_defect | validator_readiness | yes | yes | The parser was quote-ready even though this adversarial fixture expected a block. |
| case_0928 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1429 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1510 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1668 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1719 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
| case_1770 | correct_safe_block_follow_up | follow_up_unrecovered | no | no | After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing. |
