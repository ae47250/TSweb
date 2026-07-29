import test from "node:test";
import assert from "node:assert/strict";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import {
  buildContactDecisionEnvelopes,
  buildPhoneDecisionEnvelope,
} from "../lib/contactDecisionEnvelope.js";
import { validateDecisionEnvelope } from "../lib/decisionEnvelope.js";
import { buildDebugPipelinePayload } from "../lib/debugPipeline.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { buildPriceDecisionEnvelope } from "../lib/priceDecisionEnvelope.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";
import { contactNormalizerFixtures } from "./contactNormalizerFixtures.js";

function selectedValue(envelope) {
  if (!envelope?.resolution?.selectedCandidateId) return "";
  const selected = envelope.candidates.find((candidate) => candidate.id === envelope.resolution.selectedCandidateId);
  if (!selected) return "";
  if (selected.value && typeof selected.value === "object") {
    return selected.value.display || String(selected.value.amount ?? "");
  }
  return String(selected.value || "");
}

function assertEnvelopeOk(envelope, label) {
  assert.ok(envelope, `${label} missing`);
  const validation = validateDecisionEnvelope(envelope);
  assert.equal(validation.ok, true, `${label}: ${validation.errors.join("; ")}`);
}

test("contact fixture suite: envelope winners match normalizeContactFields", () => {
  const failures = [];

  for (const fixture of contactNormalizerFixtures) {
    const contact = normalizeContactFields({
      rawText: fixture.rawText,
      intake: fixture.intake || {},
    });
    const decisions = buildContactDecisionEnvelopes(contact);

    for (const [key, envelope] of Object.entries(decisions)) {
      const shape = validateDecisionEnvelope(envelope);
      if (!shape.ok) failures.push(`${fixture.id}.${key}: ${shape.errors.join("; ")}`);
    }

    const phoneSelected = selectedValue(decisions.phone);
    const emailSelected = selectedValue(decisions.email);

    if ((phoneSelected || "") !== (contact.phone.display || "")) {
      failures.push(`${fixture.id}: phone envelope ${phoneSelected || "<empty>"} != ${contact.phone.display || "<empty>"}`);
    }
    if ((emailSelected || "") !== (contact.email.value || "")) {
      failures.push(`${fixture.id}: email envelope ${emailSelected || "<empty>"} != ${contact.email.value || "<empty>"}`);
    }

    if (!contact.phone.display && decisions.phone.resolution.status !== "unresolved") {
      failures.push(`${fixture.id}: empty phone should be unresolved, got ${decisions.phone.resolution.status}`);
    }
    if (!contact.email.value && decisions.email.resolution.status !== "unresolved") {
      failures.push(`${fixture.id}: empty email should be unresolved, got ${decisions.email.resolution.status}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("empty contact note yields unresolved phone and email envelopes", () => {
  const contact = normalizeContactFields({
    rawText: "Remove three maple trees near the garage. Option A remove $1,200.",
  });
  const phone = buildPhoneDecisionEnvelope(contact);
  const decisions = buildContactDecisionEnvelopes(contact);

  assertEnvelopeOk(phone, "phone");
  assert.equal(phone.resolution.status, "unresolved");
  assert.equal(phone.resolution.reasonCode, "insufficient_support");
  assert.equal(selectedValue(phone), "");
  assert.equal(decisions.email.resolution.status, "unresolved");
  assert.equal(selectedValue(decisions.email), "");
});

test("clean firm prices produce selected price envelope without review", () => {
  const raw =
    "Megan Taylor contact 317-918-5139 / mtaylor@icloud.com. Address 804 Farm Ln, Bloomington, IN. Work requested: remove cedar leaning toward garage. Estimate tree removal 2100 stump grinding 600.";
  const reconciled = reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, raw),
    buildOptionPriceCandidateView(raw),
  );
  const envelope = buildPriceDecisionEnvelope(reconciled);
  assertEnvelopeOk(envelope, "prices");

  const sidecar = reconciled.normalization.sidecar_price_reconciliation;
  const accepted = sidecar.sidecar_prices.filter((entry) => entry.candidate_status === "accepted");
  assert.ok(accepted.length >= 1);
  assert.equal((sidecar.quarantined_final_prices || []).length, 0);
  assert.equal((sidecar.needs_review || []).length, 0);

  for (const entry of accepted) {
    const candidate = envelope.candidates.find((item) => item.id === entry.price_id);
    assert.ok(candidate, `accepted ${entry.price_id} missing from envelope`);
    assert.ok(["selected", "eligible"].includes(candidate.status), `${entry.price_id} status ${candidate.status}`);
    assert.ok(candidate.reasonCodes.includes(entry.reason_code));
  }
  assert.equal(envelope.resolution.status, "selected");
  assert.ok(accepted.some((entry) => entry.price_id === envelope.resolution.selectedCandidateId));
  assert.ok(["single_explicit_candidate", "stronger_scope_pairing", "duplicate_equivalent_candidates"].includes(
    envelope.resolution.reasonCode,
  ));
});
test("tree Unknown override abstains while review-range model count requires review", () => {
  const unknown = normalizeToAlphaJsonV14(
    {},
    "Ella Knox 812-555-0105 ella.knox@example.com. 312 Cedar Dr Seymour IN. Remove one maple tree. Option A cut only $1,200.",
    { treeCountOverride: "Unknown" },
  );
  assertEnvelopeOk(unknown.normalization.decisions.tree_count, "unknown tree");
  assert.equal(unknown.job.tree_details.tree_count, "");
  assert.equal(unknown.normalization.decisions.tree_count.resolution.status, "abstained");
  assert.equal(unknown.normalization.decisions.tree_count.resolution.resolvedBy, "reviewer");

  const unclearOk = normalizeToAlphaJsonV14(
    {},
    "Ella Knox 812-555-0105 ella.knox@example.com. 312 Cedar Dr Seymour IN. Remove maple trees. Option A cut only $1,200.",
    { treeCountOverride: "Still unclear but OK to proceed" },
  );
  assert.equal(unclearOk.normalization.decisions.tree_count.resolution.status, "abstained");

  const review = normalizeToAlphaJsonV14(
    { tree_count: "16 trees" },
    "Mara King 812-555-3101 mara@example.com. 310 Oak Lane Madison Indiana. Remove maple trees by fence. Option A remove trees $8,500.",
  );
  assertEnvelopeOk(review.normalization.decisions.tree_count, "review tree");
  assert.equal(review.job.tree_details.tree_count, "");
  assert.equal(review.normalization.decisions.tree_count.resolution.status, "requires_review");
});

test("openai mock pipeline smoke with pre-normalizers and debug returns decision envelopes", () => {
  // Mirrors app/api/openai/route.js mock path without importing next/server.
  const notes = [
    "Remove two oaks by the garage.",
    "Actually, only remove the rear oak.",
    "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
    "Call 812-555-0134. 123 Main St Bloomington IN 47401",
  ].join("\n");
  const intake = { phone: "812-555-9999" };
  const contactNormalizationResult = normalizeContactFields({ rawText: notes, intake });
  const optionPriceCandidateView = buildOptionPriceCandidateView(notes);
  const alphaJson = attachPipelineDecisionEnvelopes(
    reconcileSidecarPrices(
      applyContactNormalizationOverlay(
        normalizeToAlphaJsonV14({}, notes, intake),
        contactNormalizationResult,
      ),
      optionPriceCandidateView,
    ),
    contactNormalizationResult,
  );
  const debug = buildDebugPipelinePayload({
    enabled: true,
    rawTd1Text: notes,
    rawOpenAiDraftJson: {},
    alphaJson,
    validation: { can_generate_pdf: false, blocking_errors: [], follow_ups: [], warnings: [] },
    mocked: true,
    contactNormalizationResult,
    optionPriceCandidateView,
  });

  assert.ok(alphaJson.normalization?.decisions);
  assertEnvelopeOk(alphaJson.normalization.decisions.phone, "route phone");
  assertEnvelopeOk(alphaJson.normalization.decisions.prices, "route prices");
  assertEnvelopeOk(alphaJson.normalization.decisions.tree_count, "route tree");
  assert.equal(selectedValue(alphaJson.normalization.decisions.phone), "812-555-9999");
  assert.equal(alphaJson.customer.phone_display || alphaJson.customer.phone_primary, "812-555-9999");
  assert.equal(alphaJson.job.tree_details.tree_count, "2 trees");
  assert.ok(alphaJson.normalization.decisions.tree_count.candidates.length >= 2);
  assert.ok(debug.debugPipeline?.decisionEnvelopes);
  assert.equal(
    debug.debugPipeline.decisionEnvelopes.tree_count.resolution.selectedCandidateId,
    alphaJson.normalization.decisions.tree_count.resolution.selectedCandidateId,
  );
  assert.ok(debug.debugPipeline.td1ContactNormalization);
  assert.ok(debug.debugPipeline.td1OptionPriceCandidateView);
});
test("validate route restamps forged decisions and keeps tree envelope", () => {
  const raw = [
    "Remove two oaks by the garage.",
    "Actually, only remove the rear oak.",
    "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
    "Call 812-555-0134. 123 Main St Bloomington IN 47401",
  ].join("\n");
  const contact = normalizeContactFields({ rawText: raw, intake: {} });
  const alphaJson = attachPipelineDecisionEnvelopes(
    reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw)),
    contact,
  );

  alphaJson.normalization.decisions.prices = {
    field: "service_options.prices",
    candidates: [],
    resolution: {
      status: "selected",
      selectedCandidateId: "forged_price",
      reasonCode: "single_explicit_candidate",
      policyVersion: "forged@9",
      resolvedBy: "price_policy",
    },
  };

  const validation = validateAlphaJsonRoutePayload({
    alphaJson,
    customer_text: raw,
    intake: {},
  });

  const decisions = validation.alphaJson.normalization.decisions;
  assertEnvelopeOk(decisions.prices, "validated prices");
  assertEnvelopeOk(decisions.tree_count, "validated tree");
  assert.notEqual(decisions.prices.resolution.policyVersion, "forged@9");
  assert.equal(decisions.prices.resolution.policyVersion, "price_policy@1");
  assert.equal(validation.alphaJson.job.tree_details.tree_count, "2 trees");
  assert.ok(decisions.tree_count.candidates.length >= 2);
});

test("debug payload includes decisionEnvelopes when present", () => {
  const alphaJson = {
    normalization: {
      decisions: {
        phone: {
          field: "customer.phone",
          candidates: [],
          resolution: {
            status: "unresolved",
            reasonCode: "insufficient_support",
            policyVersion: "contact_policy@1",
            resolvedBy: "contact_policy",
          },
        },
      },
    },
  };
  const payload = buildDebugPipelinePayload({
    enabled: true,
    rawTd1Text: "enough text for notes",
    alphaJson,
    validation: { can_generate_pdf: false, blocking_errors: [], follow_ups: [], warnings: [] },
  });
  assert.deepEqual(payload.debugPipeline.decisionEnvelopes, alphaJson.normalization.decisions);
});

test("pre-normalizers off still keep tree decisions from normalize", () => {
  const raw = "Remove one maple by garage. Quote removal $1,200. Call 812-555-0134.";
  const alphaJson = reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, raw),
    null,
  );
  // Mimic route when contactNormalizationResult is null: only tree from normalize.
  assert.ok(alphaJson.normalization.decisions?.tree_count);
  assertEnvelopeOk(alphaJson.normalization.decisions.tree_count, "tree without contact");
  const withoutContact = attachPipelineDecisionEnvelopes(alphaJson, null);
  assert.ok(withoutContact.normalization.decisions.tree_count);
  assert.equal(withoutContact.normalization.decisions.phone, undefined);
});
