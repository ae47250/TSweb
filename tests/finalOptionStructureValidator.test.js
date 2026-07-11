import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalShadowEstimate } from "../lib/canonicalServiceAssembler.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";
import { getBlockingOverrideStatus } from "../lib/reviewOverrides.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";

function withStructuralEnforcement(callback) {
  const previous = process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT;
  process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT = "true";
  try {
    return callback();
  } finally {
    if (previous == null) delete process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT;
    else process.env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT = previous;
  }
}

function baseAlpha(raw = "John 8125551111 123 Main Madison IN remove oak tree removal 1000 stump grinding 400 total 1400") {
  return {
    raw_input: { customer_text: raw },
    customer: {
      name: "John",
      phone_primary: "8125551111",
      phone_display: "812-555-1111",
      email: "john@example.com",
    },
    job: {
      service_address: { display: "123 Main St Madison IN" },
      description: "Remove one oak tree.",
      tree_details: { tree_count: "1 tree", tree_type: "oak" },
    },
    service_options: { items: [] },
  };
}

function priceRecord({
  price_id,
  amount,
  description,
  reason_code = "accepted_component_of_total",
  pairing_confidence = "high",
}) {
  return {
    price_id,
    amount,
    display: `$${amount.toLocaleString("en-US")}`,
    amount_confidence: "high",
    pairing_confidence,
    description,
    source: "test_sidecar",
    candidate_status: "accepted",
    reason_code,
  };
}

function alphaWithRelationship({
  prices,
  relationship,
  raw = "John 8125551111 123 Main Madison IN remove oak tree removal 1000 stump grinding 400 total 1400",
}) {
  const pricedOptions = prices
    .filter((price) => price.reason_code !== "accepted_total_component_relationship")
    .map((price, index) => ({
      label: `Option ${String.fromCharCode(65 + index)}`,
      title: price.description,
      description: price.description,
      price: {
        amount: price.amount,
        display: price.display,
      },
    }));
  return {
    ...baseAlpha(raw),
    service_options: { items: pricedOptions },
    normalization: {
      sidecar_price_reconciliation: {
        sidecar_prices: prices,
        monetary_relationships: [relationship],
        add_on_interpretations: [],
      },
    },
  };
}

function standardRelationship(overrides = {}) {
  return {
    relationship_id: "total_price_1_of_price_2_price_3",
    type: "total_of",
    total_price_id: "price_1",
    total_amount: 1400,
    total_display: "$1,400",
    component_price_ids: ["price_2", "price_3"],
    component_amounts: [1000, 400],
    component_displays: ["$1,000", "$400"],
    confidence: "high",
    reason: "Total/estimate wording plus exact arithmetic ties this amount to component prices.",
    source: "test",
    accepted: true,
    ...overrides,
  };
}

function obs0724AlphaJson() {
  return {
    ...baseAlpha("TEST DATA ONLY. Take down dead ash tree by shed for 2500. Stump grinding 750. Total with stump grinding 3250."),
    job: {
      service_address: { display: "123 Test St Madison IN" },
      description: "Take down the dead ash tree by the shed.",
      tree_details: { tree_count: "1 tree", tree_type: "ash" },
    },
    service_options: {
      items: [
        {
          label: "Option A",
          title: "none",
          description: "none",
          price: { amount: 2500, display: "$2,500" },
        },
        {
          label: "Option C",
          title: "Stump grinding",
          description: "Grind the stump",
          price: { amount: 750, display: "$750" },
        },
      ],
    },
    normalization: {
      sidecar_price_reconciliation: {
        sidecar_prices: [
          priceRecord({
            price_id: "price_1",
            amount: 3250,
            description: "total for remove dead ash tree by shed and stump grinding",
            reason_code: "accepted_total_component_relationship",
            pairing_confidence: "low",
          }),
          priceRecord({
            price_id: "price_2",
            amount: 2500,
            description: "remove dead ash tree by shed",
          }),
          priceRecord({
            price_id: "price_3",
            amount: 750,
            description: "grind stump by shed",
          }),
        ],
        monetary_relationships: [
          {
            relationship_id: "total_price_1_of_price_2_price_3",
            type: "total_of",
            total_price_id: "price_1",
            total_amount: 3250,
            total_display: "$3,250",
            component_price_ids: ["price_2", "price_3"],
            component_amounts: [2500, 750],
            component_displays: ["$2,500", "$750"],
            confidence: "high",
            reason: "Total/estimate wording plus exact arithmetic ties this amount to component prices.",
            source: "test",
            accepted: true,
          },
        ],
        add_on_interpretations: [],
      },
    },
  };
}

test("obs_0724 shadow builder constructs base plus cumulative stump option", () => {
  const shadow = buildCanonicalShadowEstimate(obs0724AlphaJson());
  const finalOptions = shadow.finalOptionModel.final_options;

  assert.equal(shadow.finalOptionModel.status, "constructed");
  assert.deepEqual(finalOptions.map((option) => option.price.amount), [2500, 3250]);
  assert.deepEqual(finalOptions.map((option) => option.label), ["Option A", "Option B"]);
  assert.match(finalOptions[0].description, /remove/i);
  assert.match(finalOptions[1].description, /grind the stump/i);
  assert.equal(finalOptions.some((option) => option.price.amount === 750), false);
});

test("obs_0724 structural validator is shadow-only by default", () => {
  const validation = validateAlphaJson(obs0724AlphaJson());

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.validation.structural_enforcement_enabled, false);
  assert.ok(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"));
  assert.ok(validation.structural_error_codes.includes("MISSING_EXPANDED_CHOICE"));
});

test("structural enforcement blocks obs_0724 and cannot be cleared by generic overrides", () => {
  const validation = withStructuralEnforcement(() => validateAlphaJson(obs0724AlphaJson()));
  const overrideStatus = getBlockingOverrideStatus(
    validation,
    { missingAddress: true, missingContact: true, unclearScopeWithPrice: true },
    validation.alphaJson,
  );

  assert.equal(validation.can_generate_pdf, false);
  assert.ok(validation.blocking_errors.some((error) => error.includes("DEPENDENT_ADDON_STANDALONE")));
  assert.equal(overrideStatus.canProceed, false);
  assert.ok(overrideStatus.remainingBlockingErrors.some((error) => error.includes("DEPENDENT_ADDON_STANDALONE")));
});

test("validate route payload recomputes sidecar evidence for structural parity", () => {
  const alphaJson = obs0724AlphaJson();
  const validation = withStructuralEnforcement(() => validateAlphaJsonRoutePayload({
    alphaJson,
    customer_text: alphaJson.raw_input.customer_text,
  }));

  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.normalization.route_validation_evidence.trusted, true);
  assert.ok(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"));
});

test("clear no-total dependent add-on computes cumulative price with complete active scope", () => {
  const raw = "Test Customer 812-555-0100 test@example.invalid 1256 Mill St Madison IN tree removal 1000 stump grinding 400";
  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw));
  const defaultValidation = validateAlphaJson(reconciled);
  const enforcedValidation = withStructuralEnforcement(() => validateAlphaJson(reconciled));

  assert.equal(defaultValidation.can_generate_pdf, true);
  assert.deepEqual(defaultValidation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,000", "$1,400"]);
  assert.equal(defaultValidation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"), false);
  assert.equal(defaultValidation.structural_error_codes.includes("MISSING_EXPANDED_CHOICE"), false);
  assert.equal(defaultValidation.structural_error_codes.includes("EXPANDED_PRICE_MISMATCH"), false);
  assert.equal(defaultValidation.structural_error_codes.includes("EXPANDED_SCOPE_INCOMPLETE"), false);
  assert.equal(enforcedValidation.can_generate_pdf, true);
});

test("explicit additive wording with cumulative active output has no structural error", () => {
  const raw = "Test Customer 812-555-0100 test@example.invalid 1256 Mill St Madison IN tree removal 1000 + stump grinding 400";
  const reconciled = reconcileSidecarPrices(normalizeToAlphaJsonV14({}, raw), buildOptionPriceCandidateView(raw));
  const validation = validateAlphaJson(reconciled);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(validation.alphaJson.service_options.items.map((option) => option.price.display), ["$1,000", "$1,400"]);
  assert.equal(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"), false);
});

test("target binding blocks different-target dependent add-on construction", () => {
  const alphaJson = alphaWithRelationship({
    prices: [
      priceRecord({ price_id: "price_1", amount: 1400, description: "total", reason_code: "accepted_total_component_relationship", pairing_confidence: "low" }),
      priceRecord({ price_id: "price_2", amount: 1000, description: "remove oak near driveway tree removal" }),
      priceRecord({ price_id: "price_3", amount: 400, description: "stump grinding by shed" }),
    ],
    relationship: standardRelationship(),
  });
  const shadow = buildCanonicalShadowEstimate(alphaJson);

  assert.equal(shadow.finalOptionModel.status, "blocked");
  assert.ok(shadow.finalOptionModel.structural_error_codes.includes("TARGET_BINDING_UNRESOLVED"));
});

test("multi-add-on totals are detected but not auto-expanded", () => {
  const alphaJson = alphaWithRelationship({
    prices: [
      priceRecord({ price_id: "price_1", amount: 1500, description: "total", reason_code: "accepted_total_component_relationship", pairing_confidence: "low" }),
      priceRecord({ price_id: "price_2", amount: 1000, description: "tree removal oak" }),
      priceRecord({ price_id: "price_3", amount: 300, description: "stump grinding" }),
      priceRecord({ price_id: "price_4", amount: 200, description: "haul away" }),
    ],
    relationship: standardRelationship({
      total_amount: 1500,
      total_display: "$1,500",
      component_price_ids: ["price_2", "price_3", "price_4"],
      component_amounts: [1000, 300, 200],
      component_displays: ["$1,000", "$300", "$200"],
    }),
  });
  const shadow = buildCanonicalShadowEstimate(alphaJson);

  assert.equal(shadow.finalOptionModel.status, "blocked");
  assert.ok(shadow.finalOptionModel.structural_error_codes.includes("MULTI_ADDON_COMBINATION_UNSUPPORTED"));
});

test("package, discount, per-unit, and conditional wording do not auto-build cumulative options", () => {
  const cases = [
    {
      reason: "package all-in total",
      code: "CONFLICTING_PACKAGE_TOTAL",
    },
    {
      reason: "discounted negotiated total",
      code: "CONFLICTING_PACKAGE_TOTAL",
    },
    {
      reason: "per stump total",
      code: "UNSUPPORTED_RELATIONSHIP_ARITHMETIC",
      addOnDescription: "stump grinding per stump",
    },
    {
      reason: "optional if wanted",
      code: "AMBIGUOUS_OPTION_RELATIONSHIP",
    },
  ];

  for (const item of cases) {
    const alphaJson = alphaWithRelationship({
      prices: [
        priceRecord({ price_id: "price_1", amount: 1400, description: "total", reason_code: "accepted_total_component_relationship", pairing_confidence: "low" }),
        priceRecord({ price_id: "price_2", amount: 1000, description: "tree removal oak" }),
        priceRecord({ price_id: "price_3", amount: 400, description: item.addOnDescription || "stump grinding" }),
      ],
      relationship: standardRelationship({ reason: item.reason }),
    });
    const shadow = buildCanonicalShadowEstimate(alphaJson);
    assert.ok(shadow.finalOptionModel.structural_error_codes.includes(item.code), item.reason);
  }
});

test("independent alternatives are not merged without total/add-on evidence", () => {
  const validation = validateAlphaJson({
    ...baseAlpha("John 8125551111 123 Main Madison IN option A tree removal 900 option B stump grinding 900"),
    service_options: {
      items: [
        { label: "Option A", title: "tree removal", description: "tree removal", price: { amount: 900, display: "$900" } },
        { label: "Option B", title: "stump grinding", description: "stump grinding", price: { amount: 900, display: "$900" } },
      ],
    },
  });

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.structural_error_codes.includes("DEPENDENT_ADDON_STANDALONE"), false);
});

test("safety/access wording stays as a TD warning, not a structural PDF blocker", () => {
  const validation = withStructuralEnforcement(() => validateAlphaJson({
    ...baseAlpha("John 8125551111 123 Main Madison IN trim branches touching service line 1100"),
    job: {
      service_address: { display: "123 Main St Madison IN" },
      description: "Trim branches touching service line.",
      tree_details: { tree_count: "1 tree", tree_type: "tree" },
    },
    service_options: {
      items: [
        {
          label: "Option A",
          title: "tree trim",
          description: "trim branches touching service line",
          price: { amount: 1100, display: "$1,100" },
        },
      ],
    },
  }));

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.structural_error_codes.includes("SAFETY_TEXT_IN_CUSTOMER_SCOPE"), false);
  assert.equal(validation.structural_blocking_errors.length, 0);
  assert.match(validation.warnings.join(" "), /Safety\/access note: Option A includes safety or access wording/i);
});
