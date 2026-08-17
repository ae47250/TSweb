import test from "node:test";
import assert from "node:assert/strict";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { clearClientDecisionEnvelopes, validateDecisionEnvelope } from "../lib/decisionEnvelope.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { buildPriceDecisionEnvelope } from "../lib/priceDecisionEnvelope.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { applyTrustedRouteValidationEvidence } from "../lib/validateRoutePayload.js";

const NOTES = [
  "Remove two oaks by the garage.",
  "Actually, only remove the rear oak.",
  "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
].join("\n");

test("price envelope mirrors sidecar accepted and quarantined statuses", () => {
  const contact = normalizeContactFields({ rawText: NOTES, intake: {} });
  const view = buildOptionPriceCandidateView(NOTES);
  const alphaJson = reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, NOTES, {}),
    view,
  );
  const envelope = buildPriceDecisionEnvelope(alphaJson);
  const validation = validateDecisionEnvelope(envelope);
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.equal(envelope.field, "service_options.prices");

  const sidecar = alphaJson.normalization.sidecar_price_reconciliation.sidecar_prices;
  const acceptedIds = new Set(
    sidecar.filter((entry) => entry.candidate_status === "accepted").map((entry) => entry.price_id),
  );
  const selectedIds = new Set(
    envelope.candidates.filter((candidate) => candidate.status === "selected").map((candidate) => candidate.id),
  );
  for (const id of acceptedIds) {
    assert.ok(selectedIds.has(id), `accepted ${id} should be selected in envelope`);
  }

  const quarantinedSidecar = sidecar.filter((entry) => entry.candidate_status === "quarantined");
  for (const entry of quarantinedSidecar) {
    const candidate = envelope.candidates.find((item) => item.id === entry.price_id);
    assert.equal(candidate?.status, "quarantined");
    assert.ok(candidate.reasonCodes.includes(entry.reason_code));
  }

  if (quarantinedSidecar.length || (alphaJson.normalization.sidecar_price_reconciliation.needs_review || []).length) {
    assert.equal(envelope.resolution.status, "requires_review");
  }
});

test("trusted validation strips client decisions and restamps server envelopes", () => {
  const contact = normalizeContactFields({ rawText: NOTES, intake: {} });
  const view = buildOptionPriceCandidateView(NOTES);
  let alphaJson = attachPipelineDecisionEnvelopes(
    reconcileSidecarPrices(normalizeToAlphaJsonV14({}, NOTES, {}), view),
    contact,
  );

  alphaJson.normalization.decisions.phone = {
    field: "customer.phone",
    candidates: [],
    resolution: {
      status: "selected",
      selectedCandidateId: "forged",
      reasonCode: "single_explicit_candidate",
      policyVersion: "forged@1",
      resolvedBy: "contact_policy",
    },
  };

  applyTrustedRouteValidationEvidence(alphaJson, { rawInput: NOTES, intake: {} });
  assert.notEqual(alphaJson.normalization.decisions.phone?.resolution?.policyVersion, "forged@1");
  assert.ok(alphaJson.normalization.decisions.prices);
  assert.ok(alphaJson.normalization.decisions.tree_count);
  assert.equal(validateDecisionEnvelope(alphaJson.normalization.decisions.prices).ok, true);
});

test("clearClientDecisionEnvelopes removes decisions bag", () => {
  const alphaJson = { normalization: { decisions: { phone: { field: "customer.phone" } } } };
  clearClientDecisionEnvelopes(alphaJson);
  assert.equal(alphaJson.normalization.decisions, undefined);
});
