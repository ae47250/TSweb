import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import {
  EXPLICIT_OPTION_TOTAL,
  INCREMENTAL_ADDON_PRICE,
  PRICE_RELATIONSHIP_RESOLVER_VERSION,
  PRICE_RELATIONSHIP_ROLES,
  reconcileSidecarPrices,
} from "../lib/priceReconciliation.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function prices(validation) {
  return validation.alphaJson.service_options.items.map((option) => option.price.display);
}

test("price reconciliation exposes the authoritative price-relationship resolver vocabulary", () => {
  assert.equal(PRICE_RELATIONSHIP_RESOLVER_VERSION, "price-relationship-resolver-v0.1");
  assert.equal(PRICE_RELATIONSHIP_ROLES.EXPLICIT_OPTION_TOTAL, EXPLICIT_OPTION_TOTAL);
  assert.equal(PRICE_RELATIONSHIP_ROLES.INCREMENTAL_ADDON_PRICE, INCREMENTAL_ADDON_PRICE);
});

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
  assert.match(validation.alphaJson.service_options.items[1].description, /remov(?:e|al).*stump grinding/i);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /High-confidence sidecar price \$2,000 needs TD2 review/i);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].price_role,
    EXPLICIT_OPTION_TOTAL,
  );
});

test("post-AI reconciliation treats clear lower scoped second price as incremental add-on", () => {
  const raw =
    "Karen Wright 463-994-6709 wright491@gmail.com 1256 Mill St Madison IN tree removal 1000 stump grinding 400";
  const sidecar = buildOptionPriceCandidateView(raw);

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), sidecar);
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(prices(validation), ["$1,000", "$1,400"]);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /Possible add-on price \$400 needs TD2 review/i);
  assert.match(validation.warnings.join(" "), /Replaced standalone add-on amount \$400/i);
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].reason_code,
    "accepted_into_bundled_option",
  );
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].price_role,
    INCREMENTAL_ADDON_PRICE,
  );
});

test("post-AI reconciliation computes stump grinding as expanded option total", () => {
  const raw =
    "Megan Taylor contact 317-918-5139 / mtaylor@icloud.com. Address 804 Farm Ln, Bloomington, IN. Work requested: remove cedar leaning toward garage. Estimate tree removal 2100 stump grinding 600.";

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "remove cedar", "$2,100"],
      ["Option B", "remove cedar and stump grinding", "$2,700"],
    ],
  );
  assert.equal(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"), false);
  assert.equal(validation.structural_error_codes.includes("MISSING_EXPANDED_CHOICE"), false);
});

test("post-AI reconciliation computes haul-away as expanded option total and keeps utility line as warning", () => {
  const raw =
    "Customer Kelly Hernandez; phone 317-295-6019; email kelly.hernandez@aol.com; job at 3722 Brookside Dr, Bargersville, IN: trim branches touching service line; prices tree trim 1200 haul away 275.";

  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "trim branches", "$1,200"],
      ["Option B", "trim branches and haul away", "$1,475"],
    ],
  );
  assert.match(validation.warnings.join(" "), /service line/i);
  assert.doesNotMatch(validation.alphaJson.service_options.items.map((option) => option.title).join(" "), /service line/i);
  assert.equal(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"), false);
  assert.equal(validation.structural_error_codes.includes("MISSING_EXPANDED_CHOICE"), false);
});

test("post-AI reconciliation treats lower haul-away price as incremental despite context-leading b fragment", () => {
  const raw =
    "j taylor or Jennifer 317 470 3366 repeat 3366 jennifer.taylor @ yahoo.com use this one 1826 Pine Ln tree job trim branches touching service line tree trim 1050 haul away 175";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  alphaJson.service_options.items = [
    { label: "Option A", title: "trim branches touching service line tree trim", description: "trim branches touching service line tree trim", price: { amount: 1050, display: "$1,050" } },
    { label: "Option B", title: "haul away", description: "haul away", price: { amount: 175, display: "$175" } },
  ];

  const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "trim branches", "$1,050"],
      ["Option B", "trim branches and haul away", "$1,225"],
    ],
  );
  assert.equal(
    validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].price_role,
    INCREMENTAL_ADDON_PRICE,
  );
  assert.match(validation.warnings.join(" "), /service line/i);
  assert.doesNotMatch(validation.alphaJson.service_options.items.map((option) => option.title).join(" "), /service line/i);
});

test("post-AI reconciliation replaces generic saved TD2 scope with base job scope", () => {
  const raw =
    "Megan Taylor contact 317-918-5139 / mtaylor@icloud.com. Address 804 Farm Ln, Bloomington, IN. Work requested: remove cedar leaning toward garage. Estimate tree removal 2100 stump grinding 600.";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  alphaJson.service_options.items = [
    { label: "Option A", title: "tree service", description: "tree service", price: { amount: 2100, display: "$2,100" } },
    { label: "Option B", title: "tree service", description: "tree service", price: { amount: 600, display: "$600" } },
  ];

  const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "remove cedar", "$2,100"],
      ["Option B", "remove cedar and stump grinding", "$2,700"],
    ],
  );
  assert.deepEqual(validation.structural_error_codes, []);
});

test("post-AI reconciliation preserves limb work scope over generic tree removal", () => {
  const raw =
    "David Johnson, 812-292-5161, johnson980@att.net. Service address: 1056 Sunset Blvd, Bloomington, IN. Please cut up large limb and haul debris. Quote limb removal 800 haul away 300.";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  alphaJson.service_options.items = [
    { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 800, display: "$800" } },
    { label: "Option B", title: "haul away", description: "haul away", price: { amount: 300, display: "$300" } },
  ];

  const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "cut up large limb", "$800"],
      ["Option B", "cut up large limb and haul away", "$1,100"],
    ],
  );
  assert.deepEqual(validation.structural_error_codes, []);
});

test("post-AI reconciliation preserves explicit multi-tree scope in expanded stump option", () => {
  const raw =
    "Patricia Miller, 812-728-7226, patricia.m1@att.net. Service address: 9689 Farm Ln, Martinsville, IN. Please remove three small ornamental pears. Quote tree removal 1650 stump grinding 1000.";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  alphaJson.service_options.items = [
    { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 1650, display: "$1,650" } },
    { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 1000, display: "$1,000" } },
  ];

  const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "remove three small ornamental pears", "$1,650"],
      ["Option B", "remove three small ornamental pears and grind stumps", "$2,650"],
    ],
  );
  assert.deepEqual(validation.structural_error_codes, []);
});

test("post-AI reconciliation normalizes saved sidecar labels after computed add-on rebuild", () => {
  const cases = [
    {
      raw: "Richard Jackson, 317-754-5869, richard.jackson@aol.com. Service address: 7060 Jefferson St, Bedford, IN. Please trim branches touching service line. Quote tree trim 1100 haul away 175.",
      options: [
        { label: "Option A", raw_label: "Sidecar price_2", sort_order: 1, title: "haul away", description: "haul away", price: { amount: 175, display: "$175" } },
        { label: "Option B", raw_label: "Sidecar price_1", sort_order: 2, title: "trim", description: "trim", price: { amount: 1100, display: "$1,100" } },
      ],
      expected: [
        ["Option A", "trim branches", "$1,100"],
        ["Option B", "trim branches and haul away", "$1,275"],
      ],
      warning: /service line/i,
    },
    {
      raw: "Paula Miller, 812-594-4300, pmiller@comcast.net. Service address: 1308 Park Ave, Greenwood, IN. Please remove oak tree near driveway. Quote tree removal 2300 stump grinding 400.",
      options: [
        { label: "Option A", raw_label: "Sidecar price_2", sort_order: 1, title: "stump grinding", description: "stump grinding", price: { amount: 400, display: "$400" } },
        { label: "Option B", raw_label: "Sidecar price_1", sort_order: 2, title: "remove one oak tree only", description: "remove one oak tree only", price: { amount: 2300, display: "$2,300" } },
      ],
      expected: [
        ["Option A", "remove oak", "$2,300"],
        ["Option B", "remove oak and stump grinding", "$2,700"],
      ],
      warning: /near driveway/i,
    },
  ];

  for (const { raw, options, expected, warning } of cases) {
    const alphaJson = normalizeToAlphaJsonV14({}, raw);
    alphaJson.service_options.items = options;

    const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
    const validation = validateAlphaJson(reconciled);

    assert.deepEqual(
      validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
      expected,
      raw,
    );
    assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.raw_label), ["", ""], raw);
    assert.match(validation.warnings.join(" "), warning, raw);
    assert.deepEqual(validation.structural_error_codes, [], raw);
  }
});

test("post-AI reconciliation prefers explicit raw multi-tree ornamental pear scope over one-tree draft", () => {
  const raw =
    "Michael Jones, 765-362-3619, mjones@sbcglobal.net. Service address: 4308 Washington Ave, Nashville, IN. Please remove three small ornamental pears. Quote tree removal 1650 stump grinding 850.";
  const alphaJson = normalizeToAlphaJsonV14({}, raw);
  alphaJson.normalization.field_evidence.work_scope = "Remove one small ornamental pear tree. Options include stump grinding.";
  alphaJson.job.description = "Remove one small ornamental pear tree. Options include stump grinding.";
  alphaJson.job.tree_details = {
    tree_count: "1 tree",
    tree_type: "ornamental pear",
    tree_size: "small",
    tree_count_status: "missing",
  };
  alphaJson.service_options.items = [
    { label: "Option A", title: "remove one ornamental pear tree only", description: "remove one ornamental pear tree only", price: { amount: 1650, display: "$1,650" } },
    { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 850, display: "$850" } },
  ];

  const reconciled = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
    [
      ["Option A", "remove three small ornamental pears", "$1,650"],
      ["Option B", "remove three small ornamental pears and grind stumps", "$2,500"],
    ],
  );
  assert.deepEqual(validation.structural_error_codes, []);
});

test("post-AI reconciliation computes storm cleanup with lower haul-away add-on", () => {
  const rawCases = [
    [
      "Renee Ramirez, 765-962-5554, renee.ramirez@icloud.com. Service address: 6440 Brookside Dr, Martinsville, IN. Please clear storm damage in back yard. Quote storm cleanup 1900 haul away 350.",
      "$1,900",
      "$2,250",
    ],
    [
      "William Jackson, 765-714-8427, william46@outlook.com. Service address: 505 Northview Ct, Bloomington, IN. Please clear storm damage in back yard. Quote storm cleanup 1700 haul away 200.",
      "$1,700",
      "$1,900",
    ],
    [
      "rober maybe Robert H 812 227 8614 no thats phone robert.hall@comcast.net 2584 Park Ave clear storm damage in back yard storm cleanup 1700 haul away 300 pls",
      "$1,700",
      "$2,000",
    ],
  ];

  for (const [raw, basePrice, expandedPrice] of rawCases) {
    const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw));
    const validation = validateAlphaJson(reconciled);

    assert.deepEqual(
      validation.alphaJson.service_options.items.map((option) => [option.label, option.title, option.price.display]),
      [
        ["Option A", "storm-damage cleanup in back yard", basePrice],
        ["Option B", "storm-damage cleanup in back yard with debris haul-away", expandedPrice],
      ],
      raw,
    );
    assert.equal(
      validation.alphaJson.normalization.sidecar_price_reconciliation.add_on_interpretations[0].price_role,
      INCREMENTAL_ADDON_PRICE,
      raw,
    );
    assert.deepEqual(validation.structural_error_codes, [], raw);
  }
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
  assert.match(validation.alphaJson.service_options.items[1].description, /remov(?:e|al).*stump grinding/i);
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
