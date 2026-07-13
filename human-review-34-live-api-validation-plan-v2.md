# Human Review 34 Live API Validation Plan v2

Do not execute this plan without explicit approval.

## Recommendation

No production API calls are recommended now.

The next useful external check is staging/canary validation only, with synthetic data and `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=true` set only in that staging/canary environment.

## Preconditions

- Confirm the exact staging/canary URL before sending requests.
- Do not use the default production deployment.
- Use synthetic test data only.
- Do not send real customer notes.
- Do not create production PDFs.
- Do not modify production estimates.
- Disable the staging/canary enforcement flag after validation.

## Call 1: Staging Validate, Valid Structure

Endpoint:

```http
POST /api/validate
```

Purpose:

- Confirms that a valid cumulative add-on structure remains PDF-ready when enforcement is enabled.
- Confirms route evidence is server-recomputed.

Expected pass criteria:

- HTTP `200`
- `can_generate_pdf=true`
- `structural_error_codes=[]`
- `normalization.route_validation_evidence.trusted=true`
- `validation.final_option_render_binding.option_count=2`

## Call 2: Staging Validate, obs_0724-Shaped Invalid Structure

Endpoint:

```http
POST /api/validate
```

Purpose:

- Confirms the reviewed obs_0724 defect is blocked under enforcement.
- Confirms the `$750` amount is treated as dependent add-on evidence, not as a standalone customer option.

Synthetic payload shape:

- Customer note says a base tree takedown is `$2,500`.
- Customer note says stump grinding is `$750`.
- Customer note says total with stump grinding is `$3,250`.
- Submitted options show the base option plus a standalone stump-grinding option.

Expected pass criteria:

- HTTP `200`
- `can_generate_pdf=false`
- `structural_error_codes` includes `DEPENDENT_ADDON_STANDALONE`
- `structural_error_codes` includes either `EXPANDED_SCOPE_INCOMPLETE` or `MISSING_EXPANDED_CHOICE`, depending on whether the submitted payload includes a malformed expanded option.
- `normalization.route_validation_evidence.trusted=true`

## Call 3: Staging Validate, Forged Client Evidence

Endpoint:

```http
POST /api/validate
```

Purpose:

- Confirms the route does not trust client-submitted sidecar evidence.

Synthetic payload shape:

- Raw note includes `$2,500` base and `$750` stump grinding.
- Raw note does not include a supported `$3,250` total.
- Submitted AlphaJSON tries to include forged sidecar evidence for a `$3,250` total.

Expected pass criteria:

- HTTP `200`
- `can_generate_pdf=false`
- Server response does not preserve the forged sidecar price ID.
- Blocking errors include unsupported or not-found final price evidence.
- `normalization.route_validation_evidence.trusted=true`

## Call 4: Staging PDF Rejection

Endpoint:

```http
POST /api/pdf
```

Purpose:

- Confirms PDF uses the same trusted validation path as `/api/validate`.
- Confirms invalid structure rejects before rendering/storage.

Payload:

- Use the same obs_0724-shaped invalid structure as Call 2.

Expected pass criteria:

- HTTP `400`
- Error text: `Final customer option structure must be fixed before generating customer documents.`
- Response includes structural blocking errors.
- No PDF or estimate record is created.

## Call 5: Staging PDF Stale Approval Rejection

Endpoint:

```http
POST /api/pdf
```

Purpose:

- Confirms a stale final-option structural hash cannot approve a changed estimate.

Expected pass criteria:

- HTTP `400`
- Blocking errors include `STALE_STRUCTURAL_APPROVAL`
- No PDF or estimate record is created.

## Calls Not Recommended

- Production `/api/validate`
- Production `/api/pdf`
- Hosted calls with real customer notes
- Enabling the canonical builder for active production rendering
- Enabling structural enforcement on the default production branch

## Exit Criteria For Moving Beyond REVISE

- All 152 potential regressions receive held-out semantic review.
- Review shows false-positive risk is acceptable or the validator is narrowed.
- Staging/canary checks pass with synthetic data.
- A separate explicit approval is given to enable production behavior.
