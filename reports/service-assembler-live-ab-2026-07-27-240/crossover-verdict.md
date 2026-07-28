# Service-Assembler Live A/B Verdict

## Execution

- Approved and completed calls: 240
- API failures: 0
- Malformed structured responses: 0
- Fixture: 60 locked cases
- Base architecture: `d5d5071e477ec04f886db11a73a17bb7d584a2f5`
- Candidate architecture: `b5295ced929dc2fffe4c82df4e308c84ea93b821`
- Prompt and response-schema hashes were identical.
- Reasoning effort was unset, sampling used provider defaults, and SDK retries were disabled.

The returned model snapshots were:

- `gpt-4.1-nano-2025-04-14`
- `gpt-5.4-mini-2026-03-17`

## Independent Live Matrix

Each cell below used its own model response. These results include normal
model-to-model and call-to-call variability.

| Model | Architecture | Exact prices | Exact count | Primary kind | Service recall | Relationship | Factually correct | Unsafe ready | PDF ready |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| gpt-4.1-nano | Base | 42/58 | 44/58 | 53/60 | 30/60 | 41/60 | 18/60 | 17 | 34 |
| gpt-4.1-nano | Candidate | 40/58 | 43/58 | 55/60 | 30/60 | 44/60 | 19/60 | 19 | 37 |
| gpt-5.4-mini | Base | 41/58 | 45/58 | 53/60 | 36/60 | 42/60 | 23/60 | 26 | 48 |
| gpt-5.4-mini | Candidate | 43/58 | 43/58 | 55/60 | 38/60 | 42/60 | 24/60 | 23 | 46 |

The independent base/candidate reversals in price and readiness metrics are
not reliable architecture evidence because each side received a separate
model response.

## Same-Draft Crossover

Every cached response was replayed locally through both architectures. This
isolates the deterministic code change from model variability and adds no API
calls.

Across Nano base drafts, Nano candidate drafts, Mini base drafts, and Mini
candidate drafts:

- Primary service-kind matches improved from 53/60 to 55/60 every time.
- Exact prices were unchanged.
- Exact option counts were unchanged.
- Service-kind recall was unchanged.
- Option relationships and price roles were unchanged.
- PDF readiness and unsafe-ready lists were unchanged.
- Source-final omission/change counts were unchanged.
- Customer-visible output was unchanged in all 60 cases.

The two consistent classification repairs were:

- `tdsvc-010`: branch removal from walnut
- `tdsvc-015`: take down branch over driveway

Only internal reconciliation-warning wording changed for `tdsvc-022` and
`tdsvc-056`; their final options, prices, facts, readiness, and source-final
findings were identical.

## Model Comparison

On the candidate architecture:

| Metric | gpt-4.1-nano | gpt-5.4-mini |
|---|---:|---:|
| Exact prices | 40/58 | 43/58 |
| Exact option count | 43/58 | 43/58 |
| Complete service-kind recall | 30/60 | 38/60 |
| Relationship accuracy | 44/60 | 42/60 |
| Factually correct overall | 19/60 | 24/60 |
| Unsafe ready | 19 | 23 |
| PDF ready | 37 | 46 |
| Total tokens | 151,355 | 166,030 |
| Average call duration | 3.1 seconds | 5.3 seconds |

`gpt-5.4-mini` is the stronger extraction model in this run: it recovered
more exact prices, more service kinds, and more fully correct cases. However,
the current readiness rules allowed four more factually incorrect cases to
become PDF-ready than with `gpt-4.1-nano`.

## Verdict

Approve the candidate architecture. Its two intended classification gains
survive both models and both independent response samples, with no
customer-visible or scored deterministic regression.

Keep `gpt-4.1-nano` as the production default for now. Run
`gpt-5.4-mini` in shadow because it has better extraction potential, then
review the unsafe-ready cases and design a separate evidence-backed readiness
gate before switching the production model.

Source-final findings remain warning-only in this branch. No deployment,
push, environment change, or PDF-blocking change was performed.
