import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalAssemblerInput } from "../lib/canonicalServiceAssembler.js";
import { renderCustomerDocument } from "../lib/customerDocument.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

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

test("trusted resolution separates verified facts, business decisions, and customer wording", () => {
  const rawInput =
    "Jane Doe 317-555-0198 42 Oak Street Madison Indiana. Remove two oaks by the garage. Option A remove only $1,800. Option B grind stumps and haul away $2,200.";
  const draft = normalizeToAlphaJsonV14({}, rawInput);
  const trusted = validateAlphaJsonRoutePayload({
    alphaJson: draft,
    customer_text: rawInput,
  }).alphaJson;

  assert.equal(trusted.normalization.fact_resolution_locked, true);
  assert.equal(trusted.normalization.verified_facts.version, "verified-facts-v1");
  assert.equal(trusted.normalization.business_decisions.version, "business-decisions-v1");
  assert.equal(trusted.normalization.customer_wording.locked_after_facts, true);
  assert.equal(
    trusted.normalization.customer_wording.job_description,
    trusted.job.description,
  );
  assert.notEqual(
    trusted.normalization.verified_facts.job.source_work_scope.value,
    trusted.normalization.customer_wording.job_description,
  );

  const assemblerInput = buildCanonicalAssemblerInput(trusted);
  assert.equal(
    assemblerInput.normalizedJobFacts.source_evidence.some((evidence) => evidence.evidence_id === "job.description"),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(assemblerInput.normalizedJobFacts.source_evidence),
    new RegExp(trusted.normalization.customer_wording.job_description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("trusted PDF validation blocks an unbacked changed scope fact", () => {
  const rawInput =
    "Jane Doe 317-555-0198 42 Oak Street Madison Indiana. Option A: Remove two oaks by the garage for $1,800. Option B: Remove two oaks by the garage and grind stumps for $2,200.";
  const alphaJson = normalizeToAlphaJsonV14({}, rawInput);
  alphaJson.normalization.fact_resolution_locked = true;
  alphaJson.service_options.items[0] = {
    ...alphaJson.service_options.items[0],
    title: "Remove one maple",
    description: "Remove one maple",
  };

  const validation = validateAlphaJson(alphaJson);

  assert.equal(validation.can_generate_pdf, false);
  assert.ok(validation.blocking_errors.some((error) => error.includes("SOURCE_TREE_QUANTITY_CHANGED")));
});

test("customer document renders locked customer wording", () => {
  const alphaJson = normalizeToAlphaJsonV14(
    {},
    "Jane Doe 317-555-0198 42 Oak Street Madison Indiana. Remove one oak. Option A remove only $1,800.",
  );
  alphaJson.job.description = "Remove the rear oak beside the garage.";

  const html = renderCustomerDocument(alphaJson);

  assert.match(html, /Remove the rear oak beside the garage\./);
  assert.doesNotMatch(html, /Remove one oak tree/);
});
