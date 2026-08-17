import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const CASES = JSON.parse(readFileSync("tests/fixtures/tree-dude-service-classification-60.json", "utf8"));

function rawTextFor(row) {
  return row.raw_note || row.raw_customer_input || row.raw || row.input || row.text || row.customer_text || "";
}

function validateCase(row) {
  const rawText = rawTextFor(row);
  const intake = row.intake || row.structured_input || {};
  const contact = normalizeContactFields({ rawText, intake });
  let alphaJson = normalizeToAlphaJsonV14({}, rawText, intake);
  alphaJson = applyContactNormalizationOverlay(alphaJson, contact);
  alphaJson = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(rawText));
  alphaJson = attachPipelineDecisionEnvelopes(alphaJson, contact, rawText);

  return validateAlphaJson(alphaJson, {
    includeStructuralReadiness: true,
    env: { ENABLE_READINESS_SAFETY_BLOCKING: "true" },
  });
}

function rowById(caseId) {
  return CASES.find((row) => (row.case_id || row.id) === caseId);
}

test("all six frozen false-ready cases are covered by readiness findings", () => {
  const expectedFindings = new Map([
    ["tdsvc-023", { code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED", enforceable: true, ready: false }],
    ["tdsvc-029", { code: "UNSUPPORTED_CUSTOMER_FACING_VALUE", enforceable: false, ready: true }],
    ["tdsvc-033", { code: "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED", enforceable: true, ready: false }],
    ["tdsvc-034", { code: "UNSUPPORTED_CUSTOMER_FACING_VALUE", enforceable: true, ready: false }],
    ["tdsvc-036", { code: "UNSUPPORTED_CUSTOMER_FACING_VALUE", enforceable: false, ready: true }],
    ["tdsvc-037", { code: "UNSUPPORTED_CUSTOMER_FACING_VALUE", enforceable: true, ready: false }],
  ]);

  for (const [caseId, expected] of expectedFindings) {
    const validation = validateCase(rowById(caseId));
    const finding = validation.readiness_safety.findings.find(
      (candidate) => candidate.invariant_code === expected.code && candidate.enforceable === expected.enforceable,
    );
    assert.ok(finding, `${caseId} should expose ${expected.code}`);
    assert.equal(finding.enforceable, expected.enforceable, caseId);
    assert.equal(validation.can_generate_pdf, expected.ready, caseId);
  }
});

test("independent alternatives with different target wording retain a review finding without a false block", () => {
  const validation = validateCase(rowById("tdsvc-047"));
  const finding = validation.readiness_safety.findings.find(
    (candidate) => candidate.evidence?.kind === "independent_alternative_review",
  );

  assert.ok(finding);
  assert.equal(finding.enforceable, false);
  assert.equal(validation.can_generate_pdf, true);
});

test("source-faithful dependent option wording preserves material-specific details", () => {
  const cases = [
    ["tdsvc-029", /haul away the logs/i],
    ["tdsvc-036", /cut the rounds/i],
  ];

  for (const [caseId, expectedText] of cases) {
    const validation = validateCase(rowById(caseId));
    const optionText = validation.alphaJson.service_options.items
      .map((option) => `${option.title} ${option.description}`)
      .join(" ");
    assert.match(optionText, expectedText, caseId);
  }
});
