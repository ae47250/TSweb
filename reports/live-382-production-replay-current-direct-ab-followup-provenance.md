# Production Replay From Saved 382 Live Outputs

Saved live input: C:\Users\eiriksson\Documents\TSweb\reports\live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl
Rows replayed: 382

## Overall

| Metric | Saved current run | Replay after implementation |
|---|---|---|
| Exact expected prices | 301/382 (78.8%) | 74/382 (19.4%) |
| Expected-price recall | 671/763 (87.9%) | 443/763 (58.1%) |
| Final price precision | 671/672 (99.8%) | 443/735 (60.3%) |
| PDF ready | 227/382 (59.4%) | 322/382 (84.3%) |
| Ready but wrong | 1/382 (0.3%) | 289/382 (75.7%) |
| Correct but blocked | 75/382 (19.6%) | 41/382 (10.7%) |
| Blocked and wrong | 80/382 (20.9%) | 19/382 (5.0%) |
| Blocking rows | 155/382 (40.6%) | 60/382 (15.7%) |

## Change Counts

| Change | Rows |
|---|---|
| Ready-wrong fixed | 1 |
| Correct-blocked fixed | 32 |
| New ready-wrong regressions | 289 |
| New correct-blocked regressions | 0 |
| Rows with changed final price list | 293 |
| Rows with changed readiness | 95 |

## Focused Observations

| Case | Before prices | After prices | Before | After | After correctness | After blockers |
|---|---|---|---|---|---|---|
| obs_0907 | 1100, 1100 | 1100 | ready | ready | correct | none |
| obs_0839 | 2050, 450 | 2050, 2500 | blocked | ready | wrong | none |
| obs_0909 | 1700, 900 | 1700, 2600 | blocked | blocked | wrong | Option D is missing a clear price. |

## Buckets

| Bucket | Rows | Exact | PDF ready | Ready wrong | Correct blocked | Blocking rows |
|---|---|---|---|---|---|---|
| easy | 115 | 110 -> 0 | 110 -> 113 | 0 -> 113 | 0 -> 0 | 5 -> 2 |
| medium | 41 | 22 -> 0 | 22 -> 40 | 0 -> 40 | 0 -> 0 | 19 -> 1 |
| hard | 96 | 70 -> 41 | 29 -> 50 | 0 -> 50 | 41 -> 41 | 67 -> 46 |
| uber_messy | 130 | 99 -> 33 | 66 -> 119 | 1 -> 86 | 34 -> 0 | 64 -> 11 |

Detail JSONL: C:\Users\eiriksson\Documents\TSweb\reports\live-382-production-replay-current-direct-ab-followup-provenance.jsonl
