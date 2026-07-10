# Production Replay From Saved 382 Live Outputs

Saved live input: .\reports\live-sidecar-fixed-382-2026-07-10T13-00-00-full-live-after-1-2-4.jsonl
Rows replayed: 382

## Overall

| Metric | Saved current run | Replay after implementation |
|---|---|---|
| Exact expected prices | 299/382 (78.3%) | 299/382 (78.3%) |
| Expected-price recall | 661/763 (86.6%) | 661/763 (86.6%) |
| Final price precision | 661/661 (100.0%) | 661/661 (100.0%) |
| PDF ready | 257/382 (67.3%) | 257/382 (67.3%) |
| Ready but wrong | 0/382 (0.0%) | 0/382 (0.0%) |
| Correct but blocked | 42/382 (11.0%) | 42/382 (11.0%) |
| Blocked and wrong | 83/382 (21.7%) | 83/382 (21.7%) |
| Blocking rows | 125/382 (32.7%) | 125/382 (32.7%) |

## Change Counts

| Change | Rows |
|---|---|
| Ready-wrong fixed | 0 |
| Correct-blocked fixed | 0 |
| New ready-wrong regressions | 0 |
| New correct-blocked regressions | 0 |
| Rows with changed final price list | 0 |
| Rows with changed readiness | 0 |

## Focused Observations

| Case | Before prices | After prices | Before | After | After correctness | After blockers |
|---|---|---|---|---|---|---|
| obs_0907 | 1100 | 1100 | ready | ready | correct | none |
| obs_0839 | 2050 | 2050 | blocked | blocked | wrong | High-confidence sidecar price $450 needs TD2 review before PDF. |
| obs_0909 | 1700, 900 | 1700, 900 | ready | ready | correct | none |

## Buckets

| Bucket | Rows | Exact | PDF ready | Ready wrong | Correct blocked | Blocking rows |
|---|---|---|---|---|---|---|
| easy | 115 | 109 -> 109 | 109 -> 109 | 0 -> 0 | 0 -> 0 | 6 -> 6 |
| medium | 41 | 22 -> 22 | 21 -> 21 | 0 -> 0 | 1 -> 1 | 20 -> 20 |
| hard | 96 | 78 -> 78 | 37 -> 37 | 0 -> 0 | 41 -> 41 | 59 -> 59 |
| uber_messy | 130 | 90 -> 90 | 90 -> 90 | 0 -> 0 | 0 -> 0 | 40 -> 40 |

Detail JSONL: C:\Users\eiriksson\Documents\TSweb\reports\live-382-production-replay-2026-07-10T13-00-00-full-live-after-1-2-4-replay.jsonl
