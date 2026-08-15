import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { renderCustomerDocument } from "../lib/customerDocument.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

const RAW_INPUT = [
  "Jane Doe.",
  "Phone 317-555-0198. Also call 812-555-0222.",
  "Address 42 Oak Street, Madison Indiana. Also service address 44 Pine Road, Madison Indiana.",
  "Remove two oaks. Quote $1,800.",
].join(" ");

function route(decisionLog = []) {
  return validateAlphaJsonRoutePayload({
    alphaJson: normalizeToAlphaJsonV14({}, RAW_INPUT, {}),
    customer_text: RAW_INPUT,
    decisionLog,
  });
}

function fieldDecision(result, field) {
  const decision = result.alphaJson.normalization?.decisions?.[field];
  assert.ok(decision, `missing ${field} decision envelope`);
  return decision;
}

function selectedCandidate(envelope) {
  return envelope.candidates.find(
    (candidate) => candidate.id === envelope.resolution.selectedCandidateId,
  );
}

function phoneCandidate(result, value) {
  return fieldDecision(result, "phone").candidates.find((candidate) => candidate.value === value);
}

function addressCandidate(result, prefix) {
  return fieldDecision(result, "service_address").candidates.find((candidate) => candidate.value.startsWith(prefix));
}

function candidateSelectionLog(field, candidate) {
  return {
    field,
    action: "selected_candidate",
    candidateId: candidate.id,
    value: candidate.value,
  };
}

test("Phase 2 route envelopes provide candidates, evidence, reasons, and resolution text", () => {
  const result = route();

  for (const field of ["phone", "prices", "tree_count", "service_address"]) {
    const envelope = fieldDecision(result, field);
    assert.ok(envelope.candidates.length >= 1, `${field} should expose candidates`);
    for (const candidate of envelope.candidates) {
      assert.ok(candidate.evidence.some((item) => item.quote), `${field} candidate needs evidence`);
      assert.ok(candidate.reasonCodes.length >= 1, `${field} candidate needs a reason`);
    }
    assert.ok(envelope.resolution.reasonText, `${field} resolution needs reason text`);
  }

  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.alphaJson.validation.field_resolution_blocking_errors.some((message) => /phone/i.test(message)));
  assert.ok(result.alphaJson.validation.field_resolution_blocking_errors.some((message) => /address/i.test(message)));
});

test("address review has an independent accept, keep-original, and override path", () => {
  const baseline = route();
  const alternatePhone = phoneCandidate(baseline, "812-555-0222");
  const alternateAddress = addressCandidate(baseline, "44 Pine Road");
  const originalAddress = baseline.alphaJson.job.service_address.display;

  const accepted = route([
    candidateSelectionLog("customer.phone", alternatePhone),
    candidateSelectionLog("job.service_address", alternateAddress),
  ]);
  assert.equal(accepted.can_generate_pdf, true);
  assert.equal(accepted.alphaJson.job.service_address.display, alternateAddress.value);
  assert.equal(fieldDecision(accepted, "service_address").resolution.resolvedBy, "reviewer");

  const kept = route([
    candidateSelectionLog("customer.phone", alternatePhone),
    {
      field: "job.service_address",
      action: "keep_original",
      value: originalAddress,
    },
  ]);
  assert.equal(kept.can_generate_pdf, true);
  assert.equal(kept.alphaJson.job.service_address.display, originalAddress);
  assert.equal(fieldDecision(kept, "service_address").resolution.resolvedBy, "reviewer");
  assert.ok(selectedCandidate(fieldDecision(kept, "service_address"))?.reasonCodes.includes("reviewer_keep_original"));

  const overridden = route([
    candidateSelectionLog("customer.phone", alternatePhone),
    {
      field: "job.service_address",
      action: "entered_new_value",
      value: "77 Birch Lane, Madison Indiana",
    },
  ]);
  assert.equal(overridden.can_generate_pdf, true);
  assert.equal(overridden.alphaJson.job.service_address.display, "77 Birch Lane, Madison Indiana");
  assert.equal(fieldDecision(overridden, "service_address").resolution.resolvedBy, "reviewer");
});

test("all four Phase 2 reviewer outcomes write through the customer document path", () => {
  const baseline = route();
  const alternatePhone = phoneCandidate(baseline, "812-555-0222");
  const alternateAddress = addressCandidate(baseline, "44 Pine Road");
  const result = route([
    candidateSelectionLog("customer.phone", alternatePhone),
    candidateSelectionLog("job.service_address", alternateAddress),
    {
      field: "job.tree_details.tree_count",
      action: "entered_new_value",
      value: "1 tree",
      note: "Customer corrected the tree count",
    },
    {
      field: "service_options.prices",
      action: "entered_new_value",
      optionId: "Option A",
      value: 2100,
      note: "Reviewer corrected the quote",
    },
  ]);

  assert.equal(result.can_generate_pdf, true);
  assert.equal(result.alphaJson.customer.phone_display, "812-555-0222");
  assert.equal(result.alphaJson.job.service_address.display, "44 Pine Road, Madison, Indiana");
  assert.equal(result.alphaJson.job.tree_details.tree_count, "1 tree");
  assert.equal(result.alphaJson.service_options.items[0].price.display, "$2,100");
  assert.match(result.alphaJson.job.description, /one oak tree/i);

  for (const field of ["phone", "service_address", "tree_count", "prices"]) {
    const resolution = fieldDecision(result, field).resolution;
    assert.equal(resolution.status, "selected");
    assert.equal(resolution.resolvedBy, "reviewer");
    assert.equal(resolution.reasonCode, "reviewer_override");
  }

  const customerHtml = renderCustomerDocument(result.alphaJson);
  assert.match(customerHtml, /812-555-0222/);
  assert.match(customerHtml, /44 Pine Road, Madison, Indiana/);
  assert.match(customerHtml, /Remove one oak tree/i);
  assert.match(customerHtml, /\$2,100/);
  assert.doesNotMatch(customerHtml, /normalization|decision envelope|reviewer_override/i);
});

test("the UI exposes a dedicated address review card with all three decisions", () => {
  const cardSource = readFileSync("app/components/DecisionExceptionCards.jsx", "utf8");
  const reviewSource = readFileSync("app/components/JsonReview.jsx", "utf8");

  assert.match(cardSource, /export function AddressDecisionCard/);
  assert.match(cardSource, /data-testid="address-decision-card"/);
  assert.match(cardSource, /Accept this address/);
  assert.match(cardSource, /data-testid="keep-original-address"/);
  assert.match(cardSource, /data-testid="override-address"/);
  assert.match(reviewSource, /<AddressDecisionCard/);
  assert.match(reviewSource, /onSelectCandidate=\{onSelectAddressCandidate\}/);
  assert.match(reviewSource, /onKeepOriginal=\{onKeepOriginalAddress\}/);
  assert.match(reviewSource, /onOverride=\{onOverrideAddress\}/);
});
