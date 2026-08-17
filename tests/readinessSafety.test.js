import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReadinessSafety, READINESS_SAFETY_VERSION } from "../lib/readinessSafety.js";

test("evaluateReadinessSafety is shadow-mode and empty for clean estimate", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      raw_input: { customer_text: "Remove one maple by driveway. Price 1000." },
      customer: { name: "Ada", phone_display: "812-555-0101", email: "a@example.com" },
      job: {
        service_address: { display: "101 Main St, Madison, IN" },
        description: "Remove one maple by driveway",
        tree_details: { tree_count: "1 tree" },
      },
      service_options: {
        items: [{
          label: "Option A",
          title: "Remove one maple",
          description: "Remove one maple by driveway",
          price: { amount: 1000, display: "$1,000" },
        }],
      },
      normalization: {
        sidecar_price_reconciliation: {
          sidecar_prices: [{
            amount: 1000,
            amount_confidence: "high",
            pairing_confidence: "high",
            candidate_status: "accepted",
            reason_code: "accepted_exact_final_price",
          }],
        },
        decisions: {},
        claim_graph: { claims: [], relationships: [] },
        field_evidence: {
          work_scope: "Remove one maple by driveway",
        },
      },
    },
    sourceFinalCoverage: { results: [] },
  });

  assert.equal(result.version, READINESS_SAFETY_VERSION);
  assert.equal(result.shadow_mode, true);
  assert.equal(result.would_block_pdf, false);
  assert.deepEqual(result.findings, []);
});

test("flags unresolved explicit correction when correction not adopted", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      raw_input: { customer_text: "Remove two oaks. Actually make that one oak. Price 900." },
      job: { description: "Remove two oaks", tree_details: { tree_count: "2 trees" } },
      service_options: {
        items: [{
          label: "Option A",
          description: "Remove two oaks",
          price: { amount: 900, display: "$900" },
        }],
      },
      normalization: {
        claim_graph: {
          claims: [
            { id: "c1", field: "tree_count", value: 2, evidence: "two oaks" },
            { id: "c2", field: "tree_count", value: 1, evidence: "Actually make that one oak" },
          ],
          relationships: [{
            from: "c2",
            to: "c1",
            type: "supersedes",
            reason: "explicit correction",
            confidence: "confirmed",
          }],
        },
      },
    },
  });

  assert.equal(result.would_block_pdf, true);
  assert.ok(result.invariant_codes.includes("UNRESOLVED_EXPLICIT_CORRECTION"));
});

test("flags conflicting supported candidates on critical field", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      normalization: {
        decisions: {
          tree_count: {
            field: "tree_count",
            candidates: [
              {
                id: "a",
                value: "1 tree",
                source: "raw_notes",
                support: "explicit",
                status: "eligible",
                evidence: [{ quote: "one oak" }],
                reasonCodes: [],
              },
              {
                id: "b",
                value: "2 trees",
                source: "raw_notes",
                support: "explicit",
                status: "eligible",
                evidence: [{ quote: "two oaks" }],
                reasonCodes: [],
              },
            ],
            resolution: {
              status: "unresolved",
              reasonCode: "conflicting_supported_candidates",
              policyVersion: "tree_scope_policy@1",
              resolvedBy: "tree_scope_policy",
            },
          },
        },
      },
    },
  });

  assert.ok(result.invariant_codes.includes("CONFLICTING_SUPPORTED_CANDIDATES"));
});

test("flags high-confidence price that still needs review", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      normalization: {
        sidecar_price_reconciliation: {
          sidecar_prices: [{
            amount: 500,
            amount_confidence: "high",
            pairing_confidence: "medium",
            candidate_status: "eligible",
            reason_code: "needs_review_addon_ambiguity",
          }],
        },
      },
    },
  });

  assert.ok(result.invariant_codes.includes("HIGH_CONFIDENCE_PRICE_UNRESOLVED"));
});

test("flags accepted ambiguous price role as unresolved high-confidence price", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      normalization: {
        sidecar_price_reconciliation: {
          add_on_interpretations: [{
            add_on_amount: 300,
            amount_confidence: "high",
            price_role: "AMBIGUOUS_PRICE_ROLE",
            candidate_status: "accepted",
            reason_code: "accepted_exact_final_price_with_warning",
          }],
        },
      },
    },
  });

  assert.ok(result.invariant_codes.includes("HIGH_CONFIDENCE_PRICE_UNRESOLVED"));
});

test("flags omitted source fact without recorded reason", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {},
    sourceFinalCoverage: {
      results: [{
        fact: "work_actions",
        fact_label: "Work actions",
        status: "missing",
        source_value: "haul debris",
        final_value: "",
        missing_source_values: ["haul debris"],
        override_recorded: false,
        message: "Option A source says work actions is \"haul debris\", but final TD2 says \"not found\".",
        option_label: "A",
        code: "SOURCE_OPTION_ACTION_OMITTED",
      }],
    },
  });

  assert.ok(result.invariant_codes.includes("SOURCE_FACT_OMITTED_WITHOUT_REASON"));
  assert.ok(result.invariant_codes.includes("UNSUPPORTED_CUSTOMER_FACING_VALUE"));
});

test("flags inferred scope on priced option without approval", () => {
  const result = evaluateReadinessSafety({
    alphaJson: { review: { overrides: {} } },
    options: [{
      label: "Option B",
      description: "Remove maple and grind stump",
      price: { amount: 1500, display: "$1,500" },
      review_flags: {
        inferred_base_scope: true,
        inferred_from_job_scope: "Remove maple",
      },
    }],
  });

  assert.ok(result.invariant_codes.includes("INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED"));
});

test("flags generated job summary reused as work_scope evidence", () => {
  const result = evaluateReadinessSafety({
    alphaJson: {
      raw_input: { customer_text: "maple job 1000" },
      job: { description: "Full service maple removal with haul away and site cleanup" },
      normalization: {
        field_evidence: {
          work_scope: "Full service maple removal with haul away and site cleanup",
        },
      },
    },
  });

  assert.ok(result.invariant_codes.includes("GENERATED_STATEMENT_AS_EVIDENCE"));
});
