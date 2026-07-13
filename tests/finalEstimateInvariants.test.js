import test from "node:test";
import assert from "node:assert/strict";
import { renderCustomerDocument } from "../lib/customerDocument.js";
import { buildEstimateSemanticProjection } from "../lib/estimateSemantics.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function draftBase(rawText = "") {
  return {
    raw_input: { customer_text: rawText },
    customer: {
      name: "Test Customer",
      phone_primary: "8125551111",
      phone_display: "812-555-1111",
      email: "customer@example.com",
    },
    job: {
      service_address: { display: "123 Main St Madison IN" },
      description: "Remove one tree.",
      tree_details: { tree_count: "1 tree", tree_type: "tree" },
    },
    service_options: { items: [] },
  };
}

function priceDisplays(validation) {
  return validation.alphaJson.service_options.items.map((option) => option.price?.display).filter(Boolean);
}

function semanticSnapshot(validation) {
  return {
    can_generate_pdf: validation.can_generate_pdf,
    blocking_errors: validation.blocking_errors,
    options: buildEstimateSemanticProjection(validation.alphaJson).options,
  };
}

test("obs_0907 repeated same-price mention must not create two customer options", () => {
  const raw =
    "6613 Sycamore Way 1100 is estimate not addr Carlos/Jones cell 463 998 5541 e mail carlos.j8@hotmail.com prune two locust trees along alley tree trim 1100 thx";
  const alphaJson = {
    ...draftBase(raw),
    customer: {
      name: "Carlos Jones",
      phone_primary: "4639985541",
      phone_display: "463-998-5541",
      email: "carlos.j8@hotmail.com",
    },
    job: {
      service_address: { display: "6613 Sycamore Way, Madison, IN" },
      description: "Prune two locust trees along alley.",
      tree_details: { tree_count: "2 trees", tree_type: "locust" },
    },
    service_options: {
      items: [
        {
          label: "Option A",
          title: "Sycamore Way is estimate not addr Carlos/Jones cell",
          description: "Sycamore Way is estimate not addr Carlos/Jones cell",
          price: { amount: 1100, display: "$1,100" },
        },
        {
          label: "Option B",
          title: "trim thx",
          description: "trim thx",
          price: { amount: 1100, display: "$1,100" },
        },
      ],
    },
  };

  const validation = validateAlphaJson(reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw)));

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(priceDisplays(validation), ["$1,100"]);
  assert.equal(validation.alphaJson.service_options.items.length, 1);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /Repeated price \$1,100/i);
});

test("obs_0839 stale rejected price evidence must not remain as readiness state", () => {
  const raw =
    "patrici maybe Patricia A 765 280 2765 no thats phone patricia.a8@icloud.com 4773 County Line Rd rmv cedar leaning toward garage tree removal 2050 stump grinding 450 pls";
  const alphaJson = {
    ...draftBase(raw),
    customer: {
      name: "Patricia A",
      phone_primary: "7652802765",
      phone_display: "765-280-2765",
      email: "patricia.a8@icloud.com",
    },
    job: {
      service_address: { display: "4773 County Line Rd, Madison, IN" },
      description: "Remove cedar leaning toward garage.",
      tree_details: { tree_count: "1 tree", tree_type: "cedar" },
    },
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 2050, display: "$2,050" } },
        { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 450, display: "$450" } },
      ],
    },
    validation: {
      price_reconciliation_blocking_errors: ["TD2 price $8 was not found in sidecar/raw price evidence."],
      price_reconciliation_follow_ups: ["Confirm whether $8 is a real quote price or remove it from TD2."],
    },
  };

  const validation = validateAlphaJson(alphaJson);

  assert.equal(validation.can_generate_pdf, true);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /\$8/);
  assert.deepEqual(priceDisplays(validation), ["$2,050", "$450"]);
});

test("obs_0909 unpriced third item is removed during canonical construction", () => {
  const raw =
    "cod maybe Cody D 463 801 9782 no thats phone cody.d2@yahoo.com 3793 Elm St rmv three small ornamental pears tree removal 1700 stump grinding 900 pls";
  const alphaJson = {
    ...draftBase(raw),
    customer: {
      name: "Cody D",
      phone_primary: "4638019782",
      phone_display: "463-801-9782",
      email: "cody.d2@yahoo.com",
    },
    job: {
      service_address: { display: "3793 Elm St, Madison, IN" },
      description: "Remove three small ornamental pears.",
      tree_details: { tree_count: "3 trees", tree_type: "ornamental pear" },
    },
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 1700, display: "$1,700" } },
        { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 900, display: "$900" } },
        { label: "Option D", title: "2@yahoo", description: "2@yahoo", price: { display: "", amount: null } },
      ],
    },
  };

  const validation = validateAlphaJson(alphaJson);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(priceDisplays(validation), ["$1,700", "$900"]);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /Option D is missing a clear price/i);
  assert.equal(validation.alphaJson.service_options.items.length, 2);
  assert.equal(
    validation.alphaJson.normalization.canonical_final_estimate.removed_unpriced_options[0].label,
    "Option D",
  );
});

test("explicit total plus component prices keeps components and does not require total as a customer option", () => {
  const raw =
    "John 8125551111 123 Main Madison IN remove oak option A removal 700 option B haul away 300 total 1000";
  const sidecar = buildOptionPriceCandidateView(raw);
  const aiDraft = {
    ...draftBase(raw),
    customer: {
      name: "John",
      phone_primary: "8125551111",
      phone_display: "812-555-1111",
      email: "john@example.com",
    },
    job: {
      service_address: { display: "123 Main Madison IN" },
      description: "Remove oak.",
      tree_details: { tree_count: "1 tree", tree_type: "oak" },
    },
    service_options: {
      items: [
        { label: "Option A", title: "removal", description: "removal", price: { amount: 700, display: "$700" } },
        { label: "Option B", title: "haul away", description: "haul away", price: { amount: 300, display: "$300" } },
      ],
    },
  };

  const validation = validateAlphaJson(reconcileSidecarPrices(normalizeToAlphaJsonV14(aiDraft, raw), sidecar));

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(priceDisplays(validation), ["$700", "$300"]);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /\$1,000/);
});

test("two legitimate different services can share the same price", () => {
  const alphaJson = {
    ...draftBase("John 8125551111 123 Main Madison IN remove oak option A removal 900 option B stump grinding 900"),
    job: {
      service_address: { display: "123 Main St Madison IN" },
      description: "Remove one oak tree.",
      tree_details: { tree_count: "1 tree", tree_type: "oak" },
    },
    service_options: {
      items: [
        { label: "Option A", title: "oak tree removal", description: "oak tree removal", price: { amount: 900, display: "$900" } },
        { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 900, display: "$900" } },
      ],
    },
  };

  const validation = validateAlphaJson(alphaJson);

  assert.equal(validation.can_generate_pdf, true);
});

test("address, phone, route, gate, count, and email digits do not become prices", () => {
  const raw =
    "John 812-555-1111 john.a8@example.com 123 Main Madison IN, route 46, gate code 1234, remove 2 maples, option A removal 900";
  const clues = buildOptionPriceCandidateView(raw).pre_ai_option_price_candidate_clues;

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_value), [900]);
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "phone"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "address"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "route_number"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "gate_code"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "tree_count"));
});

test("repeated validation is semantically stable", () => {
  const validation = validateAlphaJson({
    ...draftBase("John 8125551111 123 Main Madison IN remove oak option A removal 900"),
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 900, display: "$900" } },
      ],
    },
  });
  const secondValidation = validateAlphaJson(validation.alphaJson);

  assert.deepEqual(semanticSnapshot(secondValidation), semanticSnapshot(validation));
});

test("approval is invalidated after semantic edits", () => {
  const initial = validateAlphaJson({
    ...draftBase("John 8125551111 123 Main Madison IN remove oak option A removal 900"),
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 900, display: "$900" } },
      ],
    },
  });
  assert.equal(initial.can_generate_pdf, true);

  const edited = structuredClone(initial.alphaJson);
  edited.review = {
    ...(edited.review || {}),
    approved_for_pdf: true,
    approved_semantic_hash: initial.alphaJson.validation.estimate_semantic_hash,
  };
  edited.service_options.items[0].price.amount = 950;
  edited.service_options.items[0].price.display = "$950";

  const validation = validateAlphaJson(edited);

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /Estimate changed after approval/i);
});

test("rendered estimate carries the same semantic hash that validation approved", () => {
  const validation = validateAlphaJson({
    ...draftBase("John 8125551111 123 Main Madison IN remove oak option A removal 900"),
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 900, display: "$900" } },
      ],
    },
  });
  const html = renderCustomerDocument(validation.alphaJson);

  assert.match(html, new RegExp(`data-estimate-semantic-hash="${validation.alphaJson.validation.estimate_semantic_hash}"`));
});
