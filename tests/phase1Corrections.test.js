import test from "node:test";
import assert from "node:assert/strict";
import { renderCustomerDocument } from "../lib/customerDocument.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

const CORRECTION_NOTES = [
  "Jane Doe 317-555-0001 jane@example.com 42 Oak Street Madison Indiana.",
  "Remove two oaks by the garage. Actually, only remove the rear oak.",
  "Option A removal only $1,800. Actually, make that $2,200.",
  "Actually use 812-555-0002.",
].join(" ");

function route(customerText) {
  return validateAlphaJsonRoutePayload({ alphaJson: {}, customer_text: customerText });
}

function selectedCandidate(envelope) {
  return envelope?.candidates?.find(
    (candidate) => candidate.id === envelope.resolution.selectedCandidateId,
  );
}

test("Phase 1 correction case writes tree, phone, and price winners through to customer output", () => {
  const validation = route(CORRECTION_NOTES);
  const alphaJson = validation.alphaJson;
  const decisions = alphaJson.normalization.decisions;
  const phoneCandidate = selectedCandidate(decisions.phone);
  const treeCandidate = selectedCandidate(decisions.tree_count);
  const priceCandidate = selectedCandidate(decisions.prices);
  const options = alphaJson.service_options.items;
  const html = renderCustomerDocument(alphaJson);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.blocking_errors, []);
  assert.equal(alphaJson.normalization.fact_resolution_locked, true);
  assert.equal(alphaJson.customer.phone_display, "812-555-0002");
  assert.equal(phoneCandidate.value, "812-555-0002");
  assert.equal(decisions.phone.resolution.reasonCode, "explicit_correction");
  assert.equal(alphaJson.job.tree_details.tree_count, "1 tree");
  assert.equal(treeCandidate.value, "1 tree");
  assert.equal(decisions.tree_count.resolution.reasonCode, "explicit_correction");
  assert.equal(options.length, 1);
  assert.equal(options[0].price.amount, 2200);
  assert.equal(options[0].price.display, "$2,200");
  assert.equal(priceCandidate.value.amount, 2200);
  assert.equal(decisions.prices.resolution.reasonCode, "explicit_correction");
  assert.deepEqual(
    alphaJson.normalization.sidecar_price_reconciliation.final_price_gate.accepted_amounts.map((entry) => entry.amount),
    [2200],
  );
  assert.match(html, /812-555-0002/);
  assert.match(html, /one oak tree/);
  assert.match(html, /\$2,200/);
  assert.doesNotMatch(html, /two oaks/);
  assert.doesNotMatch(html, /\$1,800/);
});

test("phone area code 812 is never emitted as a price candidate", () => {
  const validation = route(
    "Jane Doe 812-555-0002 jane@example.com 42 Oak Street Madison Indiana. Remove one oak. Option A removal only $1,800.",
  );
  const sidecar = validation.alphaJson.normalization.sidecar_price_reconciliation;

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.customer.phone_display, "812-555-0002");
  assert.equal(sidecar.sidecar_prices.some((price) => Number(price.amount) === 812), false);
  assert.equal(validation.alphaJson.service_options.items.some((option) => Number(option.price?.amount) === 812), false);
});

test("repeated price sentences produce exactly the two legitimate options", () => {
  const raw = [
    "Jane Doe 317-555-0001 jane@example.com 42 Oak Street Madison Indiana.",
    "Remove two oaks. Quote $1,800 without stump grinding or $2,200 with stump grinding.",
    "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
  ].join(" ");
  const validation = route(raw);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => option.price.display),
    ["$1,800", "$2,200"],
  );
  assert.equal(validation.alphaJson.service_options.items.length, 2);
});

test("ambiguous price correction fails closed without guessing an option replacement", () => {
  const raw = [
    "Jane Doe 317-555-0001 jane@example.com 42 Oak Street Madison Indiana.",
    "Option A remove oak $1,800. Option B remove pine $1,800. Actually, make that $2,200.",
  ].join(" ");
  const validation = route(raw);
  const priceDecision = validation.alphaJson.normalization.decisions.prices;

  assert.equal(priceDecision.resolution.status, "requires_review");
  assert.equal(validation.can_generate_pdf, false);
  assert.ok(validation.blocking_errors.some((error) => /explicit price correction|needs TD2 review/i.test(error)));
  assert.equal(
    validation.alphaJson.service_options.items.some((option) => Number(option.price?.amount) === 2200),
    false,
  );
});
