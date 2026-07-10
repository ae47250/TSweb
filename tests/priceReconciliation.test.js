import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function prices(validation) {
  return validation.alphaJson.service_options.items.map((option) => option.price.display);
}

test("post-AI reconciliation auto-adds computed high-confidence sidecar add-on bundle", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN remove cedar leaning toward garage prices tree removal 2000 + stump grinding 650";
  const sidecar = buildOptionPriceCandidateView(raw);
  const aiDroppedAddOn = {
    customer: {
      name: "Karen Wright",
      phone: "463-994-6709",
      email: "wright491@gmail.com",
      service_address: "1256 Mill St Madison IN",
    },
    job: {
      description: "Remove cedar leaning toward garage.",
      tree_details: { tree_count: "1 tree", tree_type: "cedar" },
    },
    service_options: {
      items: [
        {
          title: "tree removal",
          description: "tree removal",
          price: { amount: 2000 },
        },
      ],
    },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(aiDroppedAddOn, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$2,000", "$2,650"]);
  assert.match(validation.warnings.join(" "), /Added computed high-confidence add-on option \$2,650/i);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /High-confidence sidecar price \$650/i);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].candidate_status,
    "accepted",
  );
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].reason_code,
    "accepted_into_bundled_option",
  );
});

test("post-AI reconciliation inherits base scope for higher later bundled add-on price", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 stump grinding 2000";
  const sidecar = buildOptionPriceCandidateView(raw);
  const aiDroppedBundledOption = {
    customer: {
      name: "Karen Wright",
      phone: "463-994-6709",
      email: "wright491@gmail.com",
      service_address: "1256 Mill St Madison IN",
    },
    job: {
      description: "Remove tree.",
      tree_details: { tree_count: "1 tree", tree_type: "tree" },
    },
    service_options: {
      items: [
        {
          title: "tree removal",
          description: "tree removal",
          price: { amount: 1000 },
        },
      ],
    },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(aiDroppedBundledOption, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$2,000"]);
  assert.match(validation.alphaJson.service_options.items[1].description, /removal.*stump grinding/i);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /High-confidence sidecar price \$2,000 needs TD2 review/i);
});

test("post-AI reconciliation downgrades high-confidence scoped second price to warning", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 stump grinding 400";
  const sidecar = buildOptionPriceCandidateView(raw);

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$400"]);
  assert.equal(validation.alphaJson.service_options.items[1].price.review_warning, true);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /Possible add-on price \$400 needs TD2 review/i);
  assert.match(validation.warnings.join(" "), /Allowed high-confidence second price \$400/i);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].reason_code,
    "accepted_exact_final_price_with_warning",
  );
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.downgraded_add_on_reviews[0].display,
    "$400",
  );
});

test("computed add-on amount from sidecar is accepted as evidence, not invented", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 + stump grinding 400";
  const sidecar = buildOptionPriceCandidateView(raw);
  const aiComputedBundle = {
    customer: {
      name: "Karen Wright",
      phone: "463-994-6709",
      email: "wright491@gmail.com",
      service_address: "1256 Mill St Madison IN",
    },
    job: {
      description: "Remove tree.",
      tree_details: { tree_count: "1 tree", tree_type: "tree" },
    },
    service_options: {
      items: [
        {
          title: "tree removal",
          description: "tree removal",
          price: { amount: 1000 },
        },
        {
          title: "tree removal and stump grinding",
          description: "tree removal and stump grinding",
          price: { amount: 1400 },
        },
      ],
    },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(aiComputedBundle, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$1,400"]);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /TD2 price \$1,400 was not found/i);
});

test("post-AI reconciliation replaces local standalone add-on amount with computed bundled option", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 + stump grinding 400";
  const sidecar = buildOptionPriceCandidateView(raw);

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$1,400"]);
  assert.doesNotMatch(prices(validation).join(" "), /\$400/);
  assert.doesNotMatch(validation.alphaJson.service_options.items[1].description, /1256 Mill St|Madison IN/i);
  assert.match(validation.alphaJson.service_options.items[1].description, /removal.*stump grinding/i);
  assert.match(validation.warnings.join(" "), /Replaced standalone add-on amount \$400/i);
});

test("ambiguous per-unit add-on amount requires review instead of silent PDF readiness", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 + stump grinding 400 per stump";
  const sidecar = buildOptionPriceCandidateView(raw);

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$400"]);
  assert.match(validation.blocking_errors.join(" "), /Possible add-on price \$400 needs TD2 review/i);
  assert.equal(validation.alphaJson.service_options.items[1].price.review_warning, true);
});

test("post-AI reconciliation sends high amount with weak pairing to review instead of auto-adding", () => {
  const raw = "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN price 2000";
  const sidecar = buildOptionPriceCandidateView(raw);
  const noOptionDraft = {
    customer: {
      name: "Karen Wright",
      phone: "463-994-6709",
      email: "wright491@gmail.com",
      service_address: "1256 Mill St Madison IN",
    },
    job: { description: "Tree work.", tree_details: { tree_count: "1 tree", tree_type: "tree" } },
    service_options: { items: [] },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(noOptionDraft, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.equal(validation.alphaJson.service_options.items.some((option) => option.price.display === "$2,000"), false);
  assert.match(validation.blocking_errors.join(" "), /High-confidence sidecar price \$2,000 needs TD2 review/i);
  assert.match(validation.follow_ups.join(" "), /Confirm what work \$2,000 belongs to/i);
});

test("post-AI reconciliation records invented TD2 prices without keeping stale hidden blockers", () => {
  const raw =
    "Paula Anderson 812-396-5750 paula.a2@hotmial.com 3043 Meadow Ln Bedford IN take down dead ash by shed prices tree removal 2650 stump grinding 750";
  const sidecar = buildOptionPriceCandidateView(raw);
  const inventedPriceDraft = {
    customer: {
      name: "Paula Anderson",
      phone: "812-396-5750",
      email: "paula.a2@hotmail.com",
      service_address: "3043 Meadow Ln Bedford IN",
    },
    job: {
      description: "Take down dead ash by shed.",
      tree_details: { tree_count: "1 tree", tree_type: "ash" },
    },
    service_options: {
      items: [
        {
          title: "2@hotmial",
          description: "2@hotmial",
          price: { amount: 2 },
        },
      ],
    },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(inventedPriceDraft, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.doesNotMatch(validation.blocking_errors.join(" "), /TD2 price \$2 was not found in sidecar\/raw price evidence/i);
  assert.doesNotMatch(validation.follow_ups.join(" "), /Confirm whether \$2 is a real quote price/i);
  assert.equal(validation.alphaJson.service_options.items.some((option) => option.price.display === "$2"), false);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.invented_prices[0].display,
    "$2",
  );
});

test("post-AI reconciliation quarantines sidecar-backed weak pairings before final TD2", () => {
  const raw =
    "611 Northview Ct Eric 3176793573 1000 not phone price, email eric38@aol.com, cut up large limb and haul debris, stump/haul if listed limb removal 700 haul away 300";
  const sidecar = buildOptionPriceCandidateView(raw);
  const aiKeptWeakPrice = {
    customer: {
      name: "Eric",
      phone: "317-679-3573",
      email: "eric38@aol.com",
      service_address: "611 Northview Ct",
    },
    job: {
      description: "Cut up large limb and haul debris.",
      tree_details: { tree_count: "1 tree", tree_type: "limb" },
    },
    service_options: {
      items: [
        { title: "611 Northview Ct Eric 3176793573", description: "611 Northview Ct Eric 3176793573", price: { amount: 1000 } },
        { title: "limb removal", description: "limb removal", price: { amount: 700 } },
        { title: "haul away", description: "haul away", price: { amount: 300 } },
      ],
    },
  };

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14(aiKeptWeakPrice, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$700", "$300"]);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /TD2 price \$1,000 was quarantined/i);
  assert.doesNotMatch(validation.follow_ups.join(" "), /Confirm whether \$1,000 is a real quote price/i);
  assert.match(validation.blocking_errors.join(" "), /High-confidence sidecar price \$1,000 needs TD2 review/i);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.quarantined_final_prices[0].display,
    "$1,000",
  );
  const quarantinedCandidate = validation.alphaJson.normalization.sidecar_price_reconciliation.sidecar_prices.find(
    (item) => item.amount === 1000,
  );
  assert.equal(quarantinedCandidate.candidate_status, "quarantined");
  assert.equal(quarantinedCandidate.reason_code, "quarantined_weak_sidecar_evidence");
});
