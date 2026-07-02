# Focused Regression Battery - Latest Baseline

Generated Eastern: 07/02/2026, 10:02:00 AM EDT
Generated UTC: 2026-07-02T14:02:00.008Z
Commit: d1fd8273ab2718b4aac084b0277bb71512686832
Branch: master
Dirty files: 31

## Summary

| Total | Passing | Failing |
|---:|---:|---:|
| 14 | 8 | 6 |

## Category Results

| Category | Total | Passing | Failing |
|---|---:|---:|---:|
| full_address_city_state | 3 | 3 | 0 |
| incomplete_address_blocking | 2 | 0 | 2 |
| option_scope_semantics | 1 | 0 | 1 |
| uncertain_price_evidence | 1 | 0 | 1 |
| fallen_tree_counting | 2 | 1 | 1 |
| species_conjunctions | 2 | 2 | 0 |
| ambiguous_count_terms | 2 | 1 | 1 |
| source_priority | 1 | 1 | 0 |

## Failure Buckets

| Failure code | Count |
|---|---:|
| unexpected_ready | 4 |
| followup_missing | 4 |
| summary_misleading_option_scope | 1 |
| uncertain_price_finalized | 1 |

## Case Details

| Case | Category | Result | Main failures | Address | Tree count/type | Prices | TD2 summary |
|---|---|---|---|---|---|---|---|
| full-address-jeffersonville-service-label | full_address_city_state | PASS | none | 83 River Ave, Jeffersonville, IN | 1 tree | $1,100, $2,100 | Remove one large tree near the shed. Options include haul away or cleanup. |
| full-address-corydon-remuved-at | full_address_city_state | PASS | none | 707 Walnut Street, Corydon, IN | 1 tree / walnut | $1,500, $9,150 | Remove one large walnut tree near the garage. Options include haul away or cleanup. |
| full-address-new-albany-two-word-city | full_address_city_state | PASS | none | 62 Roofline Rd, New Albany, IN | 1 tree / spruce | $1,550, $9,175 | Remove one large spruce tree near the garage. Options include haul away or cleanup. |
| incomplete-address-typed-street-only | incomplete_address_blocking | FAIL | unexpected_ready, followup_missing | 148 maple st | 1 tree | $1,220, $2,280 | Remove one large tree near the shed. Options include haul away or cleanup. |
| incomplete-intake-address-old-note-wrong-address | incomplete_address_blocking | FAIL | unexpected_ready, followup_missing | 148 maple st | 1 tree / pine | $1,720, $2,620 | Remove one pine tree near the garage. Options include haul away. |
| option-package-and-cleanup-not-or | option_scope_semantics | FAIL | summary_misleading_option_scope | 410 Spruce Ct, Madison, IN | 1 tree | $1,400, $2,800 | Remove one large tree near the garage. Options include haul away or cleanup. |
| uncertain-prices-evidence-not-final | uncertain_price_evidence | FAIL | uncertain_price_finalized | 220 Oak Lane, Madison, IN | 1 tree / maple | $1,700, $2,900 | Remove one maple tree near the garage. Options include cleanup. |
| fallen-tree-singular-count-one | fallen_tree_counting | PASS | none | 410 Spruce Ct, Madison, IN | 1 tree | $1,200 | Remove one tree near the driveway. |
| fallen-trees-plural-count-unclear | fallen_tree_counting | FAIL | unexpected_ready, followup_missing | 410 Spruce Ct, Madison, IN |  | $1,200 | Tree service work as described in the selected quote option. |
| species-and-count-two | species_conjunctions | PASS | none | 410 Spruce Ct, Madison, IN | 2 trees / oak and maple | $1,200 | Remove two oak and maple trees near the garage. |
| species-or-count-one-uncertain-species | species_conjunctions | PASS | none | 410 Spruce Ct, Madison, IN | 1 tree / oak or maple | $1,200 | Remove one oak or maple tree near the garage. |
| couple-trees-count-ambiguous | ambiguous_count_terms | FAIL | unexpected_ready, followup_missing | 410 Spruce Ct, Madison, IN |  | $1,700 | Tree service work as described in the selected quote option. |
| few-trees-count-ambiguous | ambiguous_count_terms | PASS | none | 410 Spruce Ct, Madison, IN |  | $1,700 | Remove several trees near the garage. Exact tree count needs confirmation. |
| current-address-wins-over-old-note | source_priority | PASS | none | 410 Spruce Ct, Madison, IN | 1 tree / maple | $1,200 | Remove one maple tree near the garage. |

## Data Captured For Future Analysis

- Input text, intake fields, expected behavior, actual validation state, address, tree count/type, prices, options, TD2 summary, job description, corrected interpretation, commit, branch, timestamp, and dirty file count are stored in the JSONL history.
- This battery intentionally records desired future behavior, so failing cases are baseline evidence before parser/validation changes.
