# Alpha Tree Service Estimate Builder.

This is the Phase 1 web UI for turning rough Alpha Tree Service job notes into a reviewed customer estimate flow.

## V1 Client Review Handoff

The V1 implementation, client acceptance checklist, operations runbook, scope audit, and proposed PR text are consolidated in [the V1 client review PR document](docs/v1-client-review-pr.md).

## Safety Defaults

- `OPENAI_API_KEY` is server-only. Do not use `NEXT_PUBLIC_OPENAI_API_KEY`.
- Strict staging and production require `OPENAI_API_KEY` and `MOCK_OPENAI_RESPONSES=false`; the extraction route fails closed instead of using the local parser.
- `MOCK_NOTIFICATIONS=true` is the default for local automated testing. A staging canary must set it to `false` and use real notification credentials.
- Real Pingram SMS/email sends require `MOCK_NOTIFICATIONS=false` and `PINGRAM_API_KEY`.
- Staging canary review requires `MOCK_NOTIFICATIONS=false`, real provider credentials, readiness blocking enabled, an approved resolution release, and an explicit internal or limited rollout. Keep all delivery and assembler flags off until those gates are approved.
- The default Pingram base URL is `https://api.pingram.io`; set `PINGRAM_API_URL` only for a non-US Pingram region.
- Pingram email sends require `PINGRAM_FROM_EMAIL`; strict staging and production checks also require `PINGRAM_FROM_NUMBER`. `PINGRAM_FROM_NAME` and `PINGRAM_REPLY_TO` are optional account details.
- `.env.local` and `.env.production` are ignored by Git.

## Local Setup

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Test Strategy

Use three passes:

1. Unit tests for validation, document IDs, rate limiting, and notification safety.
2. Integration-style workflow tests for messy input through signed submission.
3. Edge-case tests for button gating, signature limits, option counts, and mock notification behavior.

Run:

```powershell
npm test
```
