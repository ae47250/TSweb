# Live Service-Assembler A/B

Run ID: `service-assembler-live-ab-2026-07-27-240`

Fixture: `C:\Users\eiriksson\Documents\TSweb-service-assembler-accuracy\tests\fixtures\tree-dude-service-classification-60.json` (60 cases, SHA-256 `52c7e9fb9d60b35fdd9ba7e78752175c40dabb3edfe156753acc9f45c6455bbb`)

Base: `d5d5071e477ec04f886db11a73a17bb7d584a2f5`

Candidate: `b5295ced929dc2fffe4c82df4e308c84ea93b821`

## Results

| Model | Architecture | Calls | Primary kind | Exact prices | Exact count | Relationship | Unsafe ready | PDF ready | Tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| gpt-4.1-nano | base | 60 | 53/60 | 42/58 | 44/58 | 41/60 | 17 | 34 | 150792 |
| gpt-4.1-nano | candidate | 60 | 55/60 | 40/58 | 43/58 | 44/60 | 19 | 37 | 151355 |
| gpt-5.4-mini | base | 60 | 53/60 | 41/58 | 45/58 | 42/60 | 26 | 48 | 165787 |
| gpt-5.4-mini | candidate | 60 | 55/60 | 43/58 | 43/58 | 42/60 | 23 | 46 | 166030 |

## Architecture differences

- gpt-4.1-nano: 29 of 60 cases differed between independent base and candidate calls.
- gpt-5.4-mini: 27 of 60 cases differed between independent base and candidate calls.

## API errors

- None.
