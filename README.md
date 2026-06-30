# Alpha Tree Service Estimate Builder.

This is the Phase 1 web UI for turning rough Alpha Tree Service job notes into a reviewed customer estimate flow.

## Safety Defaults

- `OPENAI_API_KEY` is server-only. Do not use `NEXT_PUBLIC_OPENAI_API_KEY`.
- `MOCK_NOTIFICATIONS=true` is the default for automated testing and staging.
- Real Pingram SMS/email sends require `MOCK_NOTIFICATIONS=false` and `PINGRAM_API_KEY`.
- The default Pingram base URL is `https://api.pingram.io`; set `PINGRAM_API_URL` only for a non-US Pingram region.
- Pingram email sends also require `PINGRAM_FROM_EMAIL`; `PINGRAM_FROM_NAME`, `PINGRAM_FROM_NUMBER`, and `PINGRAM_REPLY_TO` are optional account details.
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

