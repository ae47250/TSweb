# TSweb Progress Report

Generated: 07/01/2026, 11:07:30 PM EDT
Current commit: ab05ba9

## What This Uses

- Existing Alpha metrics history: `reports/alpha-metrics-history.jsonl`
- Latest internal 700-case tracking: `reports\internal-100-each-tracking-2026-07-01_19-43-fresh-700-v2b.jsonl`
- First comparable LIVEapi result: `reports\LIVEapi-results-2026-07-01_19-55-50cases.jsonl`
- Latest LIVEapi result: `reports\LIVEapi-results-2026-07-01_22-48-50cases.jsonl`
- Git commits from the last 24 hours.

No new OpenAI calls, production calls, PDFs, or notifications are made by this report.

## Tracked Cohort Trend

History window: 2026-06-30T23:35:40.593Z to 07/01/2026, 3:30:53 AM EDT

| Metric | Baseline | Latest | Change |
| --- | --- | --- | --- |
| Failing cases | 240/1050 | 157/1050 | 83 fewer failures |
| Error rate | 22.86% | 14.95% | 7.91 points lower |
| Customer-facing leakage | 277 | 0 | 277 fewer leaks |

| Tier | Baseline fail | Latest fail | Error change | Leakage change |
| --- | --- | --- | --- | --- |
| easy | 6/150 | 0/150 | 4 pts | 48 -> 0 |
| hard-knownfail | 142/150 | 137/150 | 3.34 pts | 34 -> 0 |
| medium | 6/150 | 0/150 | 4 pts | 44 -> 0 |
| medium-messy | 10/150 | 0/150 | 6.67 pts | 34 -> 0 |
| uber-messy | 22/150 | 20/150 | 1.34 pts | 40 -> 0 |
| uber-plus-messy | 46/150 | 0/150 | 30.67 pts | 37 -> 0 |
| very-messy | 8/150 | 0/150 | 5.33 pts | 40 -> 0 |

## LIVEapi TD2 Summary Trend

| Metric | Earlier live run | Latest live run | Change |
| --- | --- | --- | --- |
| Cases passed | 50/50 | 50/50 | 0 |
| OpenAI used | 50 | 50 | 0 |
| Local fallback/mock | 0 | 0 | 0 |
| Risky TD2 summaries | 25 | 0 | 25 fewer |
| Warning cases | 10 | 10 | 0 |
| Warnings leaked into summary | 4 | 0 | 4 fewer |

## Internal 700-Case Battery

| Metric | Value |
| --- | --- |
| Total cases | 700 |
| Passed | 700 |
| Failed | 0 |

| Category | Passed | Failed | Warnings | Blocked by design |
| --- | --- | --- | --- | --- |
| clean_baseline | 100/100 | 0 | 20 | 0 |
| messy_job_description | 100/100 | 0 | 20 | 0 |
| messy_service_address | 100/100 | 0 | 20 | 0 |
| incomplete_ambiguous_address | 100/100 | 0 | 0 | 100 |
| large_price_spread | 100/100 | 0 | 100 | 0 |
| tree_count_tree_detail | 100/100 | 0 | 20 | 0 |
| noise_heavy_notes | 100/100 | 0 | 30 | 0 |

## Last 24 Hours

Commits in last 24 hours: 23

```text
ab05ba9 (HEAD -> master, origin/master, origin/HEAD) Keep warning details out of TD2 summaries
4d3d81f Improve TD2 summary normalization
d3c1573 Add TD2 warnings and address normalization
80554a1 Improve TD2 job summary convergence
d31f3d3 Refine TD2 debug panel display
91c8403 Add TD2 debug pipeline panel
30328dc Fix TD2 address fallback
2c667fb Align TD2 review layout
5cf94f8 Refine front page action buttons
7fab051 Refine new estimate intake UI
22f82c3 Refine Tree Dude review UI
94cb4cc Refine Tree Dude review layout
8598970 Constrain TD2 job summary output
37d448d Build structured customer job summaries
5028160 Harden customer-safe messy note cleanup
2b28cd5 Reconcile parsed facts before validation
882fb70 Harden messy note parsing
97e76ef Protect intake fields during normalization
b5313e4 Parse clear article tree counts
7a55092 Clarify follow-up for vague tree jobs
c3137d8 Block vague tree counts from route numbers
1ca9a1a Fix customer name cleanup for contact cues
08cb995 Fix tow tree count parsing
```

## Honest Read

- Rerunning fixed examples proves regression safety, not full generalization.
- The stronger evidence is the broader tracked cohort trend, the fresh 700-case internal battery, and the live 50-case TD2 summary comparison.
- The weakest remaining area is still tree-count behavior in hard and uber-messy cases.
- Next best measurement improvement: create a locked holdout set that we do not tune against.

## Source Files

- Metrics history: `reports\alpha-metrics-history.jsonl`
- Internal tracking: `reports\internal-100-each-tracking-2026-07-01_19-43-fresh-700-v2b.jsonl`
- Earlier live results: `reports\LIVEapi-results-2026-07-01_19-55-50cases.jsonl`
- Latest live results: `reports\LIVEapi-results-2026-07-01_22-48-50cases.jsonl`

