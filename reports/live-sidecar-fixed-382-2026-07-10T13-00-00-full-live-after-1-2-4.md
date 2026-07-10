# Live Sidecar Fixed 382 Comparison

Model: gpt-4.1-nano
Rows: 382

| Metric | Before | Current |
|---|---:|---:|
| Final exact price correctness | 0.0% | 78.3% |
| Final expected-price recall | 49.4% | 86.6% |
| Final price precision | 100.0% | 100.0% |
| Final any expected price | 98.7% | 95.0% |
| PDF ready | 90.3% | 67.3% |
| Sidecar amount recall | 49.4% | 86.6% |
| Sidecar pair recall | 0.0% | 100.0% |
| Rows changed by reconciliation | 0.0% | 100.0% |
| Rows with added price(s) | 0.0% | 78.3% |
| Rows sent to review | 0.0% | 32.7% |
| Rows with blocking errors | 0.0% | 32.7% |
| High-confidence correct pair rate | n/a | 100.0% |
| High-confidence wrong pair rate | n/a | 0.0% |

## Bucket Breakdown

| Bucket | Rows | Before exact | Current exact | Before recall | Current recall | Before ready | Current ready | Review rows | Blocking rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| easy | 115 | 0.0% | 94.8% | 49.1% | 97.4% | 98.3% | 94.8% | 5.2% | 5.2% |
| medium | 41 | 0.0% | 53.7% | 50.0% | 76.8% | 82.9% | 51.2% | 48.8% | 48.8% |
| hard | 96 | 0.0% | 81.3% | 49.0% | 88.0% | 91.7% | 38.5% | 61.5% | 61.5% |
| uber_messy | 130 | 0.0% | 69.2% | 49.8% | 79.2% | 84.6% | 69.2% | 30.8% | 30.8% |
| unknown | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

Detail JSONL: C:\Users\eiriksson\Documents\TSweb\reports\live-sidecar-fixed-382-2026-07-10T13-00-00-full-live-after-1-2-4.jsonl
