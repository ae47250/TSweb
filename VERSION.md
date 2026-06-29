# TSweb — Alpha Tree Service Estimate Builder

**Build:** TSwebVE-2026-06-28-2219
**Generated:** June 28, 2026

## What this is
A Next.js 16 (App Router, TypeScript) web app that turns messy tree-service job
notes into a structured, validated, signable estimate.

## Flow
1. Owner pastes rough job notes (`/`).
2. OpenAI (via Vercel AI Gateway, `gpt-5.4-mini`) structures them into AlphaJSON v1.4.
3. Server-side validation engine flags blocking errors / warnings / follow-ups.
4. Owner reviews, approves, and gets a shareable signing link.
5. Customer opens `/sign/[id]`: picks an option, types name (renders in cursive),
   reads the e-signature disclaimer, and submits.
6. Server generates a signed PDF (`@react-pdf/renderer`), stores it in Vercel Blob,
   and notifies the contractor.

## Integrations
- **Vercel Blob** (connected): stores estimate JSON + signed PDFs.
- **Vercel AI Gateway** (zero-config): OpenAI structuring.

## Stubbed until keys are added
- `PINGRAM_API_KEY` — customer + contractor SMS (Pingram / NotificationAPI).
- `SENDGRID_API_KEY` — contractor email delivery.
Both no-op gracefully and log intended messages; the rest of the flow works without them.

## Optional environment variables
- `TREE_DUDE_PHONE` (default 502-310-6952)
- `TREE_DUDE_EMAIL` (default huagalli@hotmail.com)
- `SIGNATURE_MIN_LENGTH` (default 2)

## Notes / deviations from the original spec
- The spec called for "interactive buttons + live signature inside the PDF."
  PDFs are static, so interactivity lives on the web signing page; the final
  signed PDF is generated server-side after submission.
- Single responsive PDF is generated instead of separate desktop/mobile files
  (one document renders well on both); can be split later if desired.
