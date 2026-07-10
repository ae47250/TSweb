# Sidecar Price Pairing Comparison

Input: C:\Users\eiriksson\Documents\TSweb\reports\live-messy-customer-intake-1000-2026-07-07T03-30-32-192Z.jsonl
Rows: 1000

Before = saved sidecars/final TD2 from the prior 1,000-row run.
Current = rebuilt sidecars with the current local normalizer, then current post-AI reconciliation applied to the saved AI draft output. No live API calls.

| Metric | Before | Current |
|---|---:|---:|
| 1. Sidecar amount recall | 86.7% (1523/1757) | 86.7% (1523/1757) |
| 2. Sidecar amount precision | 80.9% (1523/1883) | 80.9% (1523/1883) |
| 3. Sidecar pair recall | 0.0% (0/1757) | 85.5% (1502/1757) |
| 4. Sidecar pair precision | n/a (0/0) | 79.8% (1502/1883) |
| 5. Correct option/scope attachment | 0.0% (0/1523) | 98.6% (1502/1523) |
| 6. False price rate | 19.1% (360/1883; contact/address false 213) | 19.1% (360/1883; contact/address false 213) |
| 7. Missed price rate | 13.3% (234/1757) | 13.3% (234/1757) |
| 8. Unpaired found-price rate | 100.0% (1523/1523) | 1.4% (21/1523) |
| 9. High-confidence correct pair rate | n/a (0/0) | 98.1% (1341/1367) |
| 10. High-confidence wrong pair rate | n/a (0/0) | 1.9% (26/1367) |
| 11. Post-AI draft price preservation | 91.6% (614/670) | 91.6% (614/670) |
| 12. Final TD2 exact price correctness | 35.5% (355/1000) | 73.7% (737/1000) |
| Final TD2 expected-price recall | 52.4% (920/1757) | 78.5% (1380/1757) |
| Final TD2 price precision | 87.5% (920/1052) | 91.3% (1380/1512) |
| Final TD2 any expected price | 76.9% (769/1000) | 81.5% (815/1000) |
| Can generate PDF | 83.9% (839/1000) | 70.9% (709/1000) |
| Rows changed by reconciliation | 0.0% (0/1000) | 42.4% (424/1000) |
| Rows with added price(s) | 0.0% (0/1000) | 42.4% (424/1000) |
| Rows sent to review | 0.0% (0/1000) | 29.1% (291/1000) |
| Rows with blocking errors | 0.0% (0/1000) | 29.1% (291/1000) |

## Bucket Breakdown

| Bucket | Pair recall | Pair precision | Final exact | PDF ready | Review rows | Blocking rows |
|---|---:|---:|---:|---:|---:|---:|
| easy | 98.6% | 100.0% | 95.0% | 96.5% | 3.5% | 3.5% |
| medium | 36.3% | 60.3% | 48.5% | 88.5% | 11.5% | 11.5% |
| hard | 97.1% | 71.4% | 60.3% | 42.7% | 57.3% | 57.3% |
| uber_messy | 98.3% | 84.6% | 89.7% | 70.3% | 29.7% | 29.7% |
| unknown | n/a | n/a | n/a | n/a | n/a | n/a |

## Bucket Breakdown Before

| Bucket | Pair recall | Pair precision | Final exact | PDF ready | Review rows | Blocking rows |
|---|---:|---:|---:|---:|---:|---:|
| easy | 0.0% | n/a | 37.5% | 99.0% | 0.0% | 0.0% |
| medium | 0.0% | n/a | 28.0% | 88.5% | 0.0% | 0.0% |
| hard | 0.0% | n/a | 28.3% | 65.0% | 0.0% | 0.0% |
| uber_messy | 0.0% | n/a | 46.3% | 89.7% | 0.0% | 0.0% |
| unknown | n/a | n/a | n/a | n/a | n/a | n/a |

Detail JSONL contains only raw input, expected pairs, sidecar candidates/pairings, AI draft prices, final TD2 prices, and per-row metric counts needed to recompute the table.

Detail JSONL: C:\Users\eiriksson\Documents\TSweb\reports\sidecar-price-pairing-comparison-2026-07-07T12-55-38-172Z.jsonl
