import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

function route(rawInput, decisionLog = [], reviewContext = {}) {
  return validateAlphaJsonRoutePayload({
    alphaJson: normalizeToAlphaJsonV14({}, rawInput, {}),
    customer_text: rawInput,
    decisionLog,
  }, { reviewContext });
}

test("reviewer-selected phone and address candidates write through the trusted route", () => {
  const rawInput = [
    "Jane Doe.",
    "Phone 317-555-0198. Also call 812-555-0222.",
    "Address 42 Oak Street, Madison Indiana. Also service address 44 Pine Road, Madison Indiana.",
    "Remove two oaks. Quote $1,800.",
  ].join(" ");
  const baseline = route(rawInput);
  const phoneCandidate = baseline.alphaJson.normalization.decisions.phone.candidates
    .find((candidate) => candidate.value === "812-555-0222");
  const addressCandidate = baseline.alphaJson.normalization.decisions.service_address.candidates
    .find((candidate) => candidate.value.startsWith("44 Pine Road"));

  const result = route(rawInput, [
    {
      field: "customer.phone",
      action: "selected_candidate",
      candidateId: phoneCandidate.id,
      value: phoneCandidate.value,
    },
    {
      field: "job.service_address",
      action: "selected_candidate",
      candidateId: addressCandidate.id,
      value: addressCandidate.value,
    },
  ]);

  assert.equal(result.alphaJson.customer.phone_display, "812-555-0222");
  assert.match(result.alphaJson.job.service_address.display, /^44 Pine Road/);
  assert.equal(result.alphaJson.normalization.decisions.phone.resolution.resolvedBy, "reviewer");
  assert.equal(result.alphaJson.normalization.decisions.service_address.resolution.resolvedBy, "reviewer");
  assert.equal(result.alphaJson.validation.can_generate_pdf, true);
});

test("reviewer-entered tree and price values rewrite estimate and PDF inputs", () => {
  const rawInput = "Jane Doe, 317-555-0198, 42 Oak Street, Madison Indiana. Remove two oaks. Quote $1,800.";
  const result = route(rawInput, [
    {
      field: "job.tree_details.tree_count",
      action: "entered_new_value",
      value: "1 tree",
      note: "Customer correction",
    },
    {
      field: "service_options.prices",
      action: "entered_new_value",
      optionId: "Option A",
      value: 2100,
      note: "Reviewer correction",
    },
  ]);

  assert.equal(result.alphaJson.job.tree_details.tree_count, "1 tree");
  assert.match(result.alphaJson.job.description, /one oak tree/);
  assert.equal(result.alphaJson.service_options.items[0].price.amount, 2100);
  assert.equal(result.alphaJson.service_options.items[0].price.display, "$2,100");
  assert.equal(result.alphaJson.normalization.decisions.tree_count.resolution.resolvedBy, "reviewer");
  assert.equal(result.alphaJson.normalization.decisions.prices.resolution.resolvedBy, "reviewer");
});

test("server reviewer ledger records actual before and after values with authenticated actor", () => {
  const rawInput = "Jane Doe, 317-555-0198, 42 Oak Street, Madison Indiana. Remove two oaks. Quote $1,800.";
  const result = route(rawInput, [{
    field: "job.tree_details.tree_count",
    action: "entered_new_value",
    value: "1 tree",
    note: "Customer corrected the count.",
  }], { actorId: "contractor:tree-dude" });
  const decision = result.alphaJson.reviewer_decisions.find((entry) => (
    entry.field === "job.tree_details.tree_count"
  ));

  assert.equal(decision.before, "2 trees");
  assert.equal(decision.after, "1 tree");
  assert.equal(decision.actorId, "contractor:tree-dude");

  const replay = route(rawInput, [{
    field: "job.tree_details.tree_count",
    action: "entered_new_value",
    value: "1 tree",
    note: "Customer corrected the count.",
  }], { actorId: "contractor:tree-dude" });
  assert.equal(replay.alphaJson.reviewer_decisions[0].id, decision.id);
});

test("trusted reviewer resolution ignores unknown candidate ids and invalid entered values", () => {
  const rawInput = "Jane Doe, 317-555-0198, 42 Oak Street, Madison Indiana. Remove one oak. Quote $1,800.";
  const result = route(rawInput, [
    {
      field: "customer.phone",
      action: "selected_candidate",
      candidateId: "forged_phone_candidate",
      value: "999-555-0199",
    },
    {
      field: "job.service_address",
      action: "entered_new_value",
      value: "not an address",
    },
    {
      field: "job.service_address",
      action: "keep_original",
      value: "999 Fake Road, Madison IN",
    },
  ]);

  assert.equal(result.alphaJson.customer.phone_display, "317-555-0198");
  assert.match(result.alphaJson.job.service_address.display, /^42 Oak Street/);
  assert.notEqual(result.alphaJson.normalization.decisions.phone.resolution.resolvedBy, "reviewer");
  assert.notEqual(result.alphaJson.normalization.decisions.service_address.resolution.resolvedBy, "reviewer");
});
