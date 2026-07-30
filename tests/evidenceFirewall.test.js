import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";

test("generated job summary is never copied into field_evidence.work_scope", () => {
  const rawInput =
    "Sarah Chen 812-555-0199, 42 Oak Street, Madison Indiana. Remove two oaks by the garage. Quote $1,800 without stump or $2,200 with stump grinding.";

  const alphaJson = normalizeToAlphaJsonV14({}, rawInput);
  const evidenceWorkScope = String(alphaJson.normalization?.field_evidence?.work_scope || "");
  const customerSummary = String(alphaJson.job?.description || "");

  assert.ok(customerSummary, "expected a generated customer-facing job summary");
  assert.notEqual(
    evidenceWorkScope,
    customerSummary,
    "field_evidence.work_scope must not equal the generated job.description presentation text",
  );
  assert.match(
    evidenceWorkScope,
    /two oaks|garage|remove/i,
    "field_evidence.work_scope should remain traceable to the original notes",
  );
  assert.doesNotMatch(
    evidenceWorkScope,
    /^Remove (?:one|two|three) (?:oak )?trees?\b/i,
    "field_evidence.work_scope should not be the templated customer summary wording",
  );
});
