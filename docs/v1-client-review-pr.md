# TSweb V1 client review and handoff

## Proposed PR title

`Prepare TSweb V1 client review handoff`

## Status

Repository status: `READY_FOR_CLIENT_REVIEW`  
Production status: `NOT_PRODUCTION_APPROVED`

This is the single review document for the V1 handoff. It brings together the implementation summary, client acceptance checklist, operations and rollback notes, and scope audit.

This preparation did not include a commit, push, pull request, deployment, flag enablement, or entry of client secrets.

## What is included in this V1 pass

- Retention and resolution of candidates for phone, price, tree count, and service address.
- Correction detection and write-through to the estimate, PDF, download, notification, customer page, and manual-acceptance inputs.
- Separate review cards for field decisions, with reason codes, validation, stale-decision rejection, and reviewer ledger entries.
- Separation of facts and evidence, plus checks for unsupported facts on PDF-ready estimates.
- Fail-closed trusted boundaries around stored estimates, customer links, PDFs, downloads, notifications, and manual acceptance.
- Readiness safety thresholds; locked 60-case, full 600-case, regression, ratchet, latency, telemetry, and rollback checks.
- Configuration contracts for Blob storage, PDF rendering, signing, authentication, notifications, telemetry, and alerts.
- A controlled rollout policy with safe defaults.
- Explicit V1 exclusion of the assembler. Its rollout and builder flags remain off because the required independently reviewed held-out labels are not available.

## Engineering evidence

The latest local evidence in this workspace is:

| Check | Result |
| --- | --- |
| `node --test tests/*.test.js` | 678/678 passed |
| `node scripts/readiness-safety-release-gate.js --check` | Passed; false-ready catch 18/18, unresolved-conflict recall 20/20, and no new 600-case false blocks |
| `node scripts/stress-release-gate.js --check` | Passed; 0 unsafe-ready cases and 0 false blocks in the 600-case gate |
| `node scripts/customer-pipeline-release-gate.js --check --target resolution` | Passed for the local resolution target |
| `node scripts/ratchet-gate.js` | Passed |
| `node scripts/customer-pipeline-load-test.js --iterations 1 --fail-on-regression` | Passed in isolation; p95 latency stayed below the allowed ceiling |
| `node scripts/production-readiness-preflight.js --stage local --check` | Passed |
| `node scripts/verify-customer-pipeline-rollback.js --check` | Passed; flag-off returns to the legacy pipeline and blocks customer delivery |

These results are from the repository and local environment. They do not replace proof from a deployed staging environment.

The six false-ready cases that were previously missed and are now covered are:

`tdsvc-023`, `tdsvc-029`, `tdsvc-033`, `tdsvc-034`, `tdsvc-036`, and `tdsvc-037`.

The current policy thresholds were not loosened to get this result.

The generated reports are engineering evidence. Before sharing them outside the client-controlled review environment, check for fixture or source text and redact or replace any customer-like values.

## Strict fallback behavior

Staging and production require `OPENAI_API_KEY` and `MOCK_OPENAI_RESPONSES=false`. If the provider credentials are missing or the provider fails, the extraction route stops with an error instead of quietly returning a local-parser result.

Hard-coded Tree Dude contact details are available only during local development. Staging and production require configured sender and recipient identities.

## Default-off configuration

The repository remains safe for review with these defaults:

```text
CUSTOMER_DELIVERY_ENABLED=false
CUSTOMER_RESOLUTION_ROLLOUT=off
CUSTOMER_RESOLUTION_RELEASE_APPROVED=false
CUSTOMER_RESOLUTION_ALLOWLIST=
CUSTOMER_RESOLUTION_PERCENT=0
ENABLE_READINESS_SAFETY_BLOCKING=false
MOCK_OPENAI_RESPONSES=true
CUSTOMER_ASSEMBLER_ROLLOUT=off
CUSTOMER_ASSEMBLER_RELEASE_APPROVED=false
CUSTOMER_ASSEMBLER_ALLOWLIST=
CUSTOMER_ASSEMBLER_PERCENT=0
ENABLE_CANONICAL_SERVICE_ASSEMBLER=false
ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=false
MOCK_NOTIFICATIONS=true
VERCEL_BLOB_ENABLED=false
```

Do not change these repository values to imitate staging. The client should configure real staging providers through encrypted environment settings after reviewing the code and approving the canary plan.

## Client staging setup and acceptance

Never paste secrets into this repository or into chat.

### Required integrations and identities

- Blob storage: set `VERCEL_BLOB_ENABLED=true`, then provide either `BLOB_READ_WRITE_TOKEN` or the `BLOB_STORE_ID`/`VERCEL_OIDC_TOKEN` pair. Verify read-after-write.
- PDF rendering: configure the production renderer and Chromium. Production-like delivery must not fall back to HTML.
- OpenAI extraction: configure `OPENAI_API_KEY` on the server and set `MOCK_OPENAI_RESPONSES=false`.
- Customer access: configure `CUSTOMER_LINK_SIGNING_SECRET` with at least 32 characters and a positive `CUSTOMER_LINK_TTL_SECONDS`. Verify signing, expiration, and document binding.
- Contractor access: configure `CONTRACTOR_USERNAME`, a generated `CONTRACTOR_PASSWORD_SCRYPT_HASH`, and `CONTRACTOR_SESSION_SECRET` with at least 32 characters. Verify login, session signing, expiration, and logout.
- Notifications: set `MOCK_NOTIFICATIONS=false` and configure `PINGRAM_API_KEY`, `PINGRAM_FROM_EMAIL`, `PINGRAM_FROM_NUMBER`, `TREE_DUDE_EMAIL`, and `TREE_DUDE_PHONE`.
- Telemetry and alerts: configure `CUSTOMER_PIPELINE_TELEMETRY_URL`, `CUSTOMER_PIPELINE_TELEMETRY_TOKEN`, `CUSTOMER_PIPELINE_TELEMETRY_SALT` with at least 16 characters, and a reachable alert receiver.
- Staging must not use local persistence or silent secret fallbacks.

### Required deployed checks

1. Deploy the reviewed artifact and record its immutable CI commit SHA.
2. Run the following against the deployed staging configuration:

   ```sh
   node scripts/production-readiness-preflight.js --stage staging
   ```

3. Exercise address accept, keep-original, and override; phone, price, and tree-count correction; reason-code validation; reviewer ledger writes; and stale-decision rejection.
4. Confirm that corrected values reach the stored estimate, customer page, PDF, download, notification, and manual-acceptance paths.
5. Confirm that blocked estimates cannot reach any customer-delivery surface.
6. Capture real staging telemetry JSONL and run:

   ```sh
   node scripts/check-customer-pipeline-observability.js \
     --input <real-staging-telemetry.jsonl> \
     --baseline-correction-rate <approved-baseline>
   ```

7. Run the telemetry and alert health probes against the deployed health URLs. Confirm redaction and the required safety, block, override, correction, parity, and latency metrics. Confirm that false-ready escape and correction-rate degradation alerts work.
8. Complete the internal allowlist rollout, followed by a limited 5% rollout with at least 100 deliveries and 24 hours of observation.
9. Review parity, PDFs, notifications, latency, overrides, corrections, safety events, and rollback. Test immediate flag-off rollback in the deployed environment.
10. Obtain engineering, operations, safety, and product approval before enabling broader delivery.

### Repository review checklist

- [ ] Review this consolidated V1 document.
- [ ] Review the locked 60-case and full 600-case gate reports.
- [ ] Review the six formerly missed false-ready cases and unresolved-conflict coverage.
- [ ] Confirm that assembler exclusion is intentional for V1 and that all assembler flags remain disabled.
- [ ] Freeze and record the exact release commit in CI before deployment.

### Deployed customer-path checklist

- [ ] Real Blob storage is configured and read-after-write is verified.
- [ ] The production PDF renderer is configured and the HTML fallback is unavailable for production-like delivery.
- [ ] The OpenAI key is configured and the mock parser is disabled.
- [ ] The customer-link signing secret and TTL are configured; signature, document binding, and expiration are verified.
- [ ] The contractor username, scrypt password hash, and session secret are configured; login, session, logout, and expiration are verified.
- [ ] Real notification credentials and sender identities are configured; mock notifications are disabled.
- [ ] The telemetry collector URL, token, salt, and alert receiver are configured.
- [ ] `node scripts/production-readiness-preflight.js --stage staging` passes.
- [ ] Address accept works.
- [ ] Keep-original address works.
- [ ] Address override requires and records a valid reason code.
- [ ] Phone, tree-count, and price corrections write through to the selected estimate values.
- [ ] Reviewer ledger entries record the selected or rejected action, field, candidate, reason code, and resulting value.
- [ ] Stale decisions are rejected.
- [ ] Corrected values match across the stored estimate, customer page, PDF, download, notification, and manual acceptance.
- [ ] Blocked estimates cannot reach the PDF, customer-link, download, notification, or manual-acceptance surfaces.

### Observability and rollout checklist

- [ ] Real staging telemetry JSONL is captured.
- [ ] `node scripts/check-customer-pipeline-observability.js --input <file> --baseline-correction-rate <approved-baseline>` passes.
- [ ] Telemetry and alert health probes pass.
- [ ] Telemetry is redacted and includes the required safety, block, override, correction, parity, and latency metrics.
- [ ] False-ready escape alerts are configured and tested.
- [ ] Correction-rate degradation alerts are configured and tested.
- [ ] The internal allowlist rollout passes.
- [ ] The limited 5% rollout reaches at least 100 deliveries and 24 hours of observation.
- [ ] Parity, PDFs, notifications, latency, overrides, corrections, and safety events are reviewed.
- [ ] Immediate flag-off rollback is tested in the deployed environment.

### Final approval checklist

- [ ] Engineering sign-off.
- [ ] Operations sign-off.
- [ ] Safety sign-off.
- [ ] Product sign-off.
- [ ] Customer-facing changes, human-review requirements, assembler exclusion, and known limitations are documented.
- [ ] The release artifact, staging evidence, telemetry evidence, smoke tests, rollback evidence, and gate reports are attached to the immutable release record.

### Evidence record

| Evidence | Location or link | Reviewer | Date | Result |
| --- | --- | --- | --- | --- |
| Immutable CI commit |  |  |  |  |
| Staging preflight |  |  |  |  |
| Browser/customer-path smoke test |  |  |  |  |
| Telemetry JSONL and checker output |  |  |  |  |
| Alert/health probes |  |  |  |  |
| Rollout observation |  |  |  |  |
| Rollback test |  |  |  |  |
| Final sign-offs |  |  |  |  |

## Operations and rollback

### Staging canary sequence

Once the client has configured encrypted staging secrets and deployed the immutable artifact:

1. Run `node scripts/production-readiness-preflight.js --stage staging`.
2. Start with an internal allowlist. Set `CUSTOMER_RESOLUTION_ROLLOUT=internal`, provide `CUSTOMER_RESOLUTION_ALLOWLIST`, set `CUSTOMER_RESOLUTION_RELEASE_APPROVED=true`, set `ENABLE_READINESS_SAFETY_BLOCKING=true`, set `CUSTOMER_DELIVERY_ENABLED=true`, set `MOCK_NOTIFICATIONS=false`, and set `MOCK_OPENAI_RESPONSES=false` with a real `OPENAI_API_KEY`.
3. Keep `CUSTOMER_ASSEMBLER_ROLLOUT=off`, `CUSTOMER_ASSEMBLER_RELEASE_APPROVED=false`, `ENABLE_CANONICAL_SERVICE_ASSEMBLER=false`, and `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=false`.
4. Verify every customer path and capture the evidence listed above.
5. Move to the limited cohort only after the internal review passes. The limited rollout requires an allowlist or a positive `CUSTOMER_RESOLUTION_PERCENT`, followed by at least 100 deliveries and 24 hours of observation.
6. Review safety flags, blocks, reviewer overrides, correction application, parity, PDFs, notifications, latency, and alerts before requesting broader approval.

### Safe defaults

Keep these values in the repository and in any environment that has not been approved:

```text
CUSTOMER_DELIVERY_ENABLED=false
CUSTOMER_RESOLUTION_ROLLOUT=off
CUSTOMER_RESOLUTION_RELEASE_APPROVED=false
CUSTOMER_RESOLUTION_ALLOWLIST=
CUSTOMER_RESOLUTION_PERCENT=0
ENABLE_READINESS_SAFETY_BLOCKING=false
CUSTOMER_ASSEMBLER_ROLLOUT=off
CUSTOMER_ASSEMBLER_RELEASE_APPROVED=false
CUSTOMER_ASSEMBLER_ALLOWLIST=
CUSTOMER_ASSEMBLER_PERCENT=0
ENABLE_CANONICAL_SERVICE_ASSEMBLER=false
ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=false
MOCK_NOTIFICATIONS=true
MOCK_OPENAI_RESPONSES=true
VERCEL_BLOB_ENABLED=false
```

Real secret values must not appear in `.env.example`, source files, reports, or chat.

### Immediate rollback

Use the deployed provider's encrypted environment settings to apply the kill switch:

```text
CUSTOMER_RESOLUTION_ROLLOUT=off
CUSTOMER_RESOLUTION_ALLOWLIST=
CUSTOMER_RESOLUTION_PERCENT=0
CUSTOMER_DELIVERY_ENABLED=false
```

Redeploy or restart the affected service, then run:

```sh
node scripts/production-readiness-preflight.js --stage staging
node scripts/verify-customer-pipeline-rollback.js --check
```

The expected state is the legacy pipeline with customer delivery blocked. Do not roll back by changing assembler flags; the assembler must already be off for V1.

### Alert and evidence expectations

The telemetry stream must stay redacted and include the required safety, block, override, correction, parity, and latency fields from `config/customer-pipeline-observability-policy.json`. Configure alerts for:

- any false-ready escape;
- correction-application rate below the approved baseline floor;
- telemetry collector health failure;
- alert receiver health failure; and
- an unexpected rollout or delivery state.

A local `PASS` report is not live evidence. Add the deployed preflight output, browser smoke evidence, real JSONL observability output, health probes, rollout observation, and rollback result to the immutable release record.

## V1 scope and change audit

This audit uses the supplied customer-facing and production-ready checklist as the V1 boundary. It lists the current worktree changes so that the client can see what is included and what still needs a decision.

### V1 change groups

#### Candidate retention, correction, and unified resolution

- `lib/attachPipelineDecisionEnvelopes.js`
- `lib/addressResolver.js`
- `lib/contactNormalizer.js`
- `lib/decisionEnvelope.js`
- `lib/detectClaimRelationships.js`
- `lib/normalizeAlphaJson.js`
- `lib/optionPriceNormalizer.js`
- `lib/priceDecisionEnvelope.js`
- `lib/priceReconciliation.js`
- `lib/sourceFinalFactCoverage.js`
- `lib/treeCountDecisionEnvelope.js`
- `lib/unifiedFieldResolution.js`
- `tests/phase1Corrections.test.js`
- `tests/phase2UnifiedResolution.test.js`
- related normalization, price, tree-count, evidence, and metamorphic tests

#### Review UI, reason codes, ledger, and stale-decision protection

- `app/components/DecisionExceptionCards.jsx`
- `app/components/ReadinessFindingCards.jsx`
- `app/components/JsonReview.jsx`
- `app/page.js`
- `app/styles/globals.css`
- `lib/readinessReview.js`
- `lib/reviewDecisionExceptions.js`
- `lib/reviewOverrides.js`
- `lib/reviewerDecisionLedger.js`
- `lib/reviewerDecisionLog.js`
- `tests/reviewerDecisionOverrides.test.js`
- `tests/reviewerDecisionLedger.test.js`
- `tests/reviewerDecisionLog.test.js`
- related UI and readiness tests

#### Trusted customer-delivery surfaces

- `app/e/[estimateId]/EstimateClient.jsx`
- `app/e/[estimateId]/page.js`
- `app/api/estimates/**`
- `app/api/manual-acceptance/route.js`
- `app/api/notify/route.js`
- `app/api/pdf/route.js`
- `app/api/upload/route.js`
- `lib/customerAccess.js`
- `lib/customerDocument.js`
- `lib/documentFiles.js`
- `lib/estimateStore.js`
- `lib/trustedEstimateBoundary.js`
- related security-boundary and route tests

#### Authentication, infrastructure contracts, safety, telemetry, and rollout controls

- `app/api/auth/**`
- `app/login/page.jsx`
- `lib/contractorAuth.js`
- `lib/contractorClient.js`
- `lib/customerPipeline.js`
- `lib/customerPipelineTelemetry.js`
- `lib/productionReadiness.js`
- `config/customer-pipeline-locked-case-ids.json`
- `config/customer-pipeline-observability-policy.json`
- `config/customer-pipeline-release-policy.json`
- `config/readiness-safety-release-policy.json`
- `scripts/check-customer-pipeline-observability.js`
- `scripts/customer-pipeline-load-test.js`
- `scripts/customer-pipeline-release-gate.js`
- `scripts/production-readiness-preflight.js`
- `scripts/readiness-safety-release-gate.js`
- `scripts/stress-release-gate.js`
- `scripts/verify-customer-pipeline-rollback.js`
- `.github/workflows/quality-gates.yml`
- `.env.example`, `package.json`, and `pnpm-lock.yaml`
- associated gate reports and tests

Strict provider and identity fallback hardening is also part of V1 because the checklist prohibits silent fallbacks:

- `app/api/openai/route.js`
- `config/constants.js`
- `lib/productionReadiness.js`
- `scripts/production-readiness-preflight.js`

#### Facts, wording, and assembler scope

- `scripts/audit-source-final-389.js`
- `reports/source-final-fact-389-audit.json`
- `reports/source-final-fact-389-audit.md`
- `lib/canonicalServiceAssembler.js`
- assembler evaluation/shadow fixtures and tests already present in the repository

The assembler remains excluded from customer-facing V1 behavior until the required 50+ independently reviewed, adjudicated, frozen, checksum-protected labels are available.

The generated gate and source-fact reports are evidence, not application behavior. Review them for fixture or source text and sanitize any customer-like values before attaching them to the client review.

### Changes outside the V1 application scope

#### Generated architecture-scan cache

- `graphify-out/cache/stat-index.json` is a generated Graphify cache from an architecture scan. It is tooling output, not application behavior, customer evidence, or a release artifact. Leave it out of the client release commit unless the client specifically requests Graphify artifacts.

#### Legacy documentation deletions requiring explicit review

The current worktree marks these existing V1-related documents as deleted:

- `docs/canonical-service-assembler-rollout.md`
- `docs/readiness-safety-decision-exceptions-implementation-report.md`

These are not unrelated product features. They are documentation removals that affect the V1 audit trail. The client or release owner must approve the deletions, or restore and supersede the documents, before the final immutable release commit. This handoff document replaces their status claims for review, but it does not hide the deletions from the change record.

### Scope conclusion

No other current application change is clearly outside the supplied V1 checklist. The change set is broad because the checklist covers correction write-through, every customer-delivery surface, authentication and signing, real integrations, observability, rollout, rollback, and assembler deferral.

Any new feature found during client review should be tracked separately rather than added to this V1 release.

## What this document does not claim

This handoff does not claim that:

- staging or production credentials have been supplied;
- real Blob storage, PDF rendering, notification, authentication, telemetry, or alert services have been exercised;
- deployed browser or customer paths have passed;
- live telemetry JSONL or live alert probes have passed;
- the 100-delivery, 24-hour limited rollout has happened;
- production delivery is enabled;
- the assembler is approved for customer-facing use; or
- the current dirty workspace is an immutable release commit.

The client can review and approve the V1 code and local evidence now. Production approval still depends on the deployed staging checks above. Until those checks are complete, keep customer delivery, readiness blocking, and assembler flags off.

## Proposed PR body

```text
## Summary
- Complete the V1 correction, review, safety, trusted-delivery, and rollout handoff documentation.
- Add strict staging and production fail-closed behavior for provider and identity fallbacks.
- Keep the assembler excluded and rollout controls off by default.

## Validation
- 678/678 tests passed.
- Readiness, stress, resolution, ratchet, rollback, local preflight, and isolated load gates passed.
- Staging preflight remains blocked until client infrastructure and credentials are configured.

## Client approval required
- Deployed staging preflight and customer-path verification.
- Live telemetry, alerts, controlled rollout, rollback, and final sign-offs.
```
