import test from "node:test";
import assert from "node:assert/strict";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import {
  CONTACT_POLICY_VERSION,
  PRICE_POLICY_VERSION,
  TREE_SCOPE_POLICY_VERSION,
  createCandidate,
  createEnvelope,
} from "../lib/decisionEnvelope.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import {
  buildPhoneException,
  buildPriceAlternativesException,
  buildTreeScopeException,
  getReviewDecisionExceptions,
} from "../lib/reviewDecisionExceptions.js";

test("phone exception surfaces duplicate equivalent candidates", () => {
  const envelope = createEnvelope({
    field: "customer.phone",
    candidates: [
      createCandidate({
        id: "phone_intake_3175550198",
        value: "(317) 555-0198",
        source: "structured_intake",
        status: "selected",
        evidence: [{ quote: "(317) 555-0198" }],
      }),
      createCandidate({
        id: "phone_raw_3175550198",
        value: "(317) 555-0198",
        source: "raw_notes",
        status: "eligible",
        evidence: [{ quote: "Phone: (317) 555-0198" }],
      }),
    ],
    resolution: {
      status: "selected",
      selectedCandidateId: "phone_intake_3175550198",
      reasonCode: "duplicate_equivalent_candidates",
      policyVersion: CONTACT_POLICY_VERSION,
      resolvedBy: "contact_policy",
    },
  });

  const exception = buildPhoneException(envelope);
  assert.ok(exception);
  assert.equal(exception.equivalent, true);
  assert.equal(exception.candidateCount, 2);
  assert.equal(exception.candidates[0].value, "(317) 555-0198");
});

test("phone exception is null for single explicit candidate", () => {
  const envelope = createEnvelope({
    field: "customer.phone",
    candidates: [
      createCandidate({
        id: "phone_1",
        value: "(317) 555-0198",
        source: "raw_notes",
        status: "selected",
      }),
    ],
    resolution: {
      status: "selected",
      selectedCandidateId: "phone_1",
      reasonCode: "single_explicit_candidate",
      policyVersion: CONTACT_POLICY_VERSION,
      resolvedBy: "contact_policy",
    },
  });
  assert.equal(buildPhoneException(envelope), null);
});

test("tree scope exception surfaces correction language claims", () => {
  const envelope = createEnvelope({
    field: "job.tree_details.tree_count",
    candidates: [
      createCandidate({
        id: "tree_raw_claim_1",
        value: "2 trees",
        source: "raw_notes",
        status: "eligible",
        evidence: [{ quote: "Remove two oaks by the garage.", start: 0, end: 30 }],
        reasonCodes: ["raw_count_claim"],
      }),
      createCandidate({
        id: "tree_raw_claim_2",
        value: "1 tree",
        source: "raw_notes",
        status: "selected",
        evidence: [{ quote: "Actually, only remove the rear oak.", start: 31, end: 66 }],
        reasonCodes: ["correction_language_claim"],
      }),
    ],
    resolution: {
      status: "selected",
      selectedCandidateId: "tree_raw_claim_2",
      reasonCode: "conflicting_supported_candidates",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    },
  });

  const exception = buildTreeScopeException(envelope);
  assert.ok(exception);
  assert.match(exception.earlier.quote, /two oaks/i);
  assert.match(exception.later.quote, /rear oak/i);
  assert.equal(exception.suggested.value, "1 tree");
  assert.match(exception.keepBothLabel, /both|2 trees|Keep/i);
});

test("tree scope exception hides after reviewer resolution", () => {
  const envelope = createEnvelope({
    field: "job.tree_details.tree_count",
    candidates: [
      createCandidate({
        id: "tree_override_1",
        value: "1 tree",
        source: "reviewer",
        status: "selected",
        reasonCodes: ["tree_count_override", "correction_language_claim"],
        evidence: [{ quote: "Actually, only remove the rear oak.", start: 10, end: 40 }],
      }),
      createCandidate({
        id: "tree_raw_claim_1",
        value: "2 trees",
        source: "raw_notes",
        status: "eligible",
        evidence: [{ quote: "Remove two oaks by the garage.", start: 0, end: 30 }],
        reasonCodes: ["raw_count_claim"],
      }),
    ],
    resolution: {
      status: "selected",
      selectedCandidateId: "tree_override_1",
      reasonCode: "explicit_correction",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "reviewer",
    },
  });
  assert.equal(buildTreeScopeException(envelope), null);
});

test("price alternatives exception surfaces requires_review options", () => {
  const envelope = createEnvelope({
    field: "service_options.prices",
    candidates: [
      createCandidate({
        id: "price-1800",
        value: { amount: 1800, display: "$1,800", description: "Without stump grinding" },
        source: "raw_notes",
        status: "selected",
      }),
      createCandidate({
        id: "price-2200",
        value: { amount: 2200, display: "$2,200", description: "With stump grinding" },
        source: "raw_notes",
        status: "eligible",
      }),
    ],
    resolution: {
      status: "requires_review",
      selectedCandidateId: "price-1800",
      reasonCode: "stronger_scope_pairing",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    },
  });

  const exception = buildPriceAlternativesException(envelope);
  assert.ok(exception);
  assert.equal(exception.candidates.length, 2);
  assert.equal(exception.candidates[0].display, "$1,800");
  assert.equal(exception.candidates[1].description, "With stump grinding");
  assert.equal(exception.needsConfirmation, true);
});

test("getReviewDecisionExceptions returns nulls when nothing is material", () => {
  const alphaJson = {
    normalization: {
      decisions: {
        phone: createEnvelope({
          field: "customer.phone",
          candidates: [
            createCandidate({
              id: "phone_1",
              value: "(317) 555-0198",
              source: "structured_intake",
              status: "selected",
            }),
          ],
          resolution: {
            status: "selected",
            selectedCandidateId: "phone_1",
            reasonCode: "single_explicit_candidate",
            policyVersion: CONTACT_POLICY_VERSION,
            resolvedBy: "contact_policy",
          },
        }),
      },
    },
  };
  const exceptions = getReviewDecisionExceptions(alphaJson);
  assert.equal(exceptions.phone, null);
  assert.equal(exceptions.treeScope, null);
  assert.equal(exceptions.priceAlternatives, null);
});

test("getReviewDecisionExceptions reads live pipeline envelopes", () => {
  const notes = [
    "Phone: (317) 555-0198",
    "Call (317) 555-0198 again.",
    "Remove two oaks by the garage.",
    "Actually, only remove the rear oak.",
    "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
  ].join("\n");
  const contact = normalizeContactFields({
    rawText: notes,
    intake: { phone: "(317) 555-0198" },
  });
  const view = buildOptionPriceCandidateView(notes);
  const alphaJson = attachPipelineDecisionEnvelopes(
    reconcileSidecarPrices(normalizeToAlphaJsonV14({}, notes, { phone: "(317) 555-0198" }), view),
    contact,
    notes,
  );

  const exceptions = getReviewDecisionExceptions(alphaJson);
  // Phone may or may not be duplicate depending on normalizer; tree and/or prices should be material.
  assert.ok(exceptions.treeScope || exceptions.priceAlternatives || exceptions.phone);
  if (exceptions.treeScope) {
    assert.ok(exceptions.treeScope.earlier.quote || exceptions.treeScope.later.quote);
  }
  if (exceptions.priceAlternatives) {
    assert.ok(exceptions.priceAlternatives.candidates.length >= 2);
  }
});
