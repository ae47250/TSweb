import test from "node:test";
import assert from "node:assert/strict";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { validateDecisionEnvelope } from "../lib/decisionEnvelope.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

const NOTES = [
  "Customer: Jordan Lee",
  "Phone: (317) 555-0198",
  "Remove two oaks by the garage.",
  "Actually, only remove the rear oak.",
  "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
].join("\n");

test("attachPipelineDecisionEnvelopes includes tree_count when missing", () => {
  const contact = normalizeContactFields({ rawText: NOTES, intake: {} });
  const view = buildOptionPriceCandidateView(NOTES);
  const alphaJson = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, NOTES, {}), view);
  // Simulate a payload that lost tree_count before pipeline attach.
  if (alphaJson.normalization?.decisions) {
    delete alphaJson.normalization.decisions.tree_count;
  }

  const next = attachPipelineDecisionEnvelopes(alphaJson, contact, NOTES);
  assert.ok(next.normalization.decisions.tree_count);
  assert.equal(validateDecisionEnvelope(next.normalization.decisions.tree_count).ok, true);
  assert.ok(next.normalization.decisions.tree_count.candidates.length >= 1);
});

test("attachPipelineDecisionEnvelopes preserves normalize tree_count envelope", () => {
  const contact = normalizeContactFields({ rawText: NOTES, intake: {} });
  const view = buildOptionPriceCandidateView(NOTES);
  const alphaJson = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, NOTES, {}), view);
  const beforeId = alphaJson.normalization.decisions.tree_count?.resolution?.selectedCandidateId;
  assert.ok(beforeId);

  const next = attachPipelineDecisionEnvelopes(alphaJson, contact, NOTES);
  assert.equal(
    next.normalization.decisions.tree_count.resolution.selectedCandidateId,
    beforeId,
  );
});

test("tree_count envelope survives validateAlphaJsonRoutePayload round-trip", () => {
  const contact = normalizeContactFields({ rawText: NOTES, intake: {} });
  const view = buildOptionPriceCandidateView(NOTES);
  const alphaJson = attachPipelineDecisionEnvelopes(
    reconcileSidecarPrices(normalizeToAlphaJsonV14({}, NOTES, {}), view),
    contact,
    NOTES,
  );
  assert.ok(alphaJson.normalization.decisions.tree_count);

  const validation = validateAlphaJsonRoutePayload({
    alphaJson,
    customer_text: NOTES,
    intake: {},
  });
  assert.ok(validation?.alphaJson?.normalization?.decisions?.tree_count);
  assert.equal(
    validateDecisionEnvelope(validation.alphaJson.normalization.decisions.tree_count).ok,
    true,
  );
});
