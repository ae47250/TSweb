# Human Review 34 Live API Validation Plan

Do not execute this plan without explicit approval.

## Is Live or Staging Validation Necessary Now?

No live production API calls are necessary for this pass.

Local unit tests, full tests, saved-replay analysis, local `/api/validate`, and local `/api/pdf` already prove the core behavior:

- the structural validator reports the defect;
- enforcement blocks PDF readiness;
- PDF rejects before rendering when enforcement is enabled;
- the canonical builder can construct the corrected `obs_0724` option structure in shadow mode;
- production behavior remains default-off.

Staging or canary validation is useful later only to prove deployment wiring, environment-variable behavior, route parity, and reject-before-render behavior in a hosted environment.

Production validation is not recommended at this stage.

## Preconditions

- Use a staging or canary deployment, not the default production deployment.
- Set `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT=true` only on that staging/canary environment.
- Use synthetic redacted test data only.
- Do not send real customer notes.
- Do not create production PDFs.
- Do not modify production estimates.
- Confirm the tested deployment URL before sending requests.

## Proposed Call 1: Staging Validate

Environment: staging or canary only.

Method and endpoint:

```http
POST /api/validate
```

Purpose:

- Confirms that hosted validation preserves sidecar evidence and reports the same structural blockers as local validation.
- Adds deployment-environment evidence that local tests cannot provide.

Redacted example payload:

```json
{
  "customer_text": "TEST DATA ONLY. Test Customer, 812-555-0100, 123 Test St, Madison IN. Take down dead ash tree by shed for $2,500. Stump grinding $750. Total with stump grinding $3,250.",
  "alphaJson": {
    "raw_input": {
      "customer_text": "TEST DATA ONLY. Take down dead ash tree by shed for $2,500. Stump grinding $750. Total with stump grinding $3,250."
    },
    "customer": {
      "name": "Test Customer",
      "phone_primary": "8125550100",
      "phone_display": "812-555-0100",
      "email": "test@example.invalid"
    },
    "job": {
      "service_address": {
        "display": "123 Test St Madison IN"
      },
      "description": "Take down the dead ash tree by the shed.",
      "tree_details": {
        "tree_count": "1 tree",
        "tree_type": "ash"
      }
    },
    "service_options": {
      "items": [
        {
          "label": "Option A",
          "title": "none",
          "description": "none",
          "price": {
            "amount": 2500,
            "display": "$2,500"
          }
        },
        {
          "label": "Option B",
          "title": "Stump grinding",
          "description": "Grind the stump",
          "price": {
            "amount": 750,
            "display": "$750"
          }
        },
        {
          "label": "Option C",
          "title": "Take down tree and grind stump",
          "description": "Take down the dead ash tree by the shed and grind the stump",
          "price": {
            "amount": 3250,
            "display": "$3,250"
          }
        }
      ]
    },
    "normalization": {
      "sidecar_price_reconciliation": {
        "sidecar_prices": [
          {
            "price_id": "price_1",
            "amount": 2500,
            "display": "$2,500",
            "description": "Take down the dead ash tree by the shed",
            "candidate_status": "accepted",
            "reason_code": "accepted_component_of_total"
          },
          {
            "price_id": "price_2",
            "amount": 750,
            "display": "$750",
            "description": "Stump grinding",
            "candidate_status": "accepted",
            "reason_code": "accepted_component_of_total"
          },
          {
            "price_id": "price_3",
            "amount": 3250,
            "display": "$3,250",
            "description": "Total with stump grinding",
            "candidate_status": "accepted",
            "reason_code": "accepted_total_component_relationship"
          }
        ],
        "monetary_relationships": [
          {
            "relationship_id": "test_total_price_3_of_price_1_price_2",
            "type": "total_of",
            "total_price_id": "price_3",
            "total_amount": 3250,
            "component_price_ids": ["price_1", "price_2"],
            "component_amounts": [2500, 750],
            "confidence": "high",
            "accepted": true
          }
        ]
      }
    }
  }
}
```

Read-only or side effects:

- Intended as read-only validation.
- Normal request logging may occur in the staging/canary environment.

Expected response and pass criteria:

- HTTP status `200`.
- `can_generate_pdf=false`.
- `structural_enforcement_enabled=true`.
- `structural_error_codes` includes:
  - `DEPENDENT_ADDON_STANDALONE`
  - `EXPANDED_PRICE_MISMATCH`
  - `INVALID_OPTION_LABEL_SEQUENCE`
- `final_option_structural_hash` is present.

Data/privacy risk:

- Low if only synthetic data is used.
- Do not use real customer text or customer identifiers.

Rollback or cleanup:

- Remove or disable `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT` on the staging/canary deployment after validation.
- No customer data cleanup should be needed if synthetic payloads are used.

## Proposed Call 2: Staging PDF Rejection

Environment: same staging or canary deployment as Call 1.

Method and endpoint:

```http
POST /api/pdf
```

Purpose:

- Confirms that hosted PDF generation rejects structural blockers before rendering or storage.
- Adds evidence that route-level PDF gating matches local behavior.

Payload:

- Use the same redacted synthetic payload as Call 1.

Read-only or side effects:

- Expected side effect: none, because the request should reject before PDF rendering/storage.
- Risk: if the guard is misconfigured, the route could attempt to generate a staging PDF. This is why the environment must not be production.

Expected response and pass criteria:

- HTTP status `400`.
- Error text: `Final customer option structure must be fixed before generating customer documents.`
- Response includes structural blocking errors.
- No PDF is created.

Data/privacy risk:

- Low with synthetic data.
- Do not use real customer text.

Rollback or cleanup:

- If a staging PDF is unexpectedly created, delete that staging artifact.
- Disable `ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT` on the staging/canary deployment after validation.

## Smallest Proposed Call Set

Minimum useful hosted validation:

1. One staging/canary `POST /api/validate` synthetic `obs_0724`-shaped payload.
2. One staging/canary `POST /api/pdf` synthetic `obs_0724`-shaped payload.

No production calls are recommended for this pass.

## Calls Not Recommended Yet

- Live production `/api/validate`.
- Live production `/api/pdf`.
- Sending real customer notes.
- Creating or modifying production estimates.
- Enabling the shadow builder as active production output.
- Enabling structural enforcement on the default production branch.
