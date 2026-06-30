# Alpha Metrics Report

Generated: 2026-06-30T23:37:55.847Z
Commit: b6e8906fc2712a3aa706f1f74995599832f124c2
Branch: master

## Current Cohort Metrics

| Tier | Error | Trend | Failing | Recovered | Still blocked | Customer leakage | Top failure buckets |
|---|---:|---:|---:|---:|---:|---:|---|
| easy | 4.00% `#.......................` | same | 6/150 | 0 | 0 | 0 | parser_name 5, parser_tree_count 1 |
| hard-knownfail | 94.67% `#######################.` | same | 142/150 | 92 | 0 | 34 | parser_tree_count 122, parser_price_options 95, validator_readiness 57 |
| medium | 4.00% `#.......................` | same | 6/150 | 0 | 0 | 0 | parser_name 4, parser_tree_count 2 |
| medium-messy | 6.67% `##......................` | same | 10/150 | 0 | 0 | 0 | parser_price_options 8, parser_tree_count 2 |
| uber-messy | 14.67% `####....................` | same | 22/150 | 150 | 0 | 40 | parser_tree_count 20, parser_name 2 |
| uber-plus-messy | 30.67% `#######.................` | same | 46/150 | 101 | 0 | 28 | parser_price_options 21, validator_readiness 13, parser_name 10 |
| very-messy | 5.33% `#.......................` | same | 8/150 | 31 | 0 | 12 | parser_price_options 5, parser_name 2, parser_tree_count 1 |

## Error Rate History

### easy

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 4.00% | 6/150 | 0 | 48 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 4.00% | 6/150 | 0 | 0 |

### hard-knownfail

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 94.67% | 142/150 | 0 | 34 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 94.67% | 142/150 | 0 | 34 |

### medium

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 4.00% | 6/150 | 0 | 44 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 4.00% | 6/150 | 0 | 0 |

### medium-messy

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 6.67% | 10/150 | 0 | 34 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 6.67% | 10/150 | 0 | 0 |

### uber-messy

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 14.67% | 22/150 | 0 | 40 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 14.67% | 22/150 | 0 | 40 |

### uber-plus-messy

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 30.67% | 46/150 | 0 | 37 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 30.67% | 46/150 | 0 | 28 |

### very-messy

| Commit | Time | Error | Failing | Still blocked | Leakage |
|---|---|---:|---:|---:|---:|
| b6e8906 | 2026-06-30T23:35:40.593Z | 5.33% | 8/150 | 0 | 40 |
| b6e8906 | 2026-06-30T23:37:55.847Z | 5.33% | 8/150 | 0 | 12 |

## How To Read This

- Error rate measures parser/readiness mismatch against the fixture expected outcomes.
- Recovered means the simulated Tree Dude follow-up loop eventually produced a quote-ready AlphaJSON.
- Still blocked should stay at 0 when follow-up answers contain enough information.
- Customer leakage counts customer-facing summaries containing contact labels, phones, emails, follow-up labels, or internal safety/access notes.
- Top failure buckets tell us what to improve next without guessing.

