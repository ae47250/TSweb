import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalShadowEstimate } from "../lib/canonicalServiceAssembler.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";
import { getBlockingOverrideStatus } from "../lib/reviewOverrides.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { buildSourceFinalFactCoverage } from "../lib/sourceFinalFactCoverage.js";

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

function validateRaw(raw) {
  return validateAlphaJson(reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, raw),
    buildOptionPriceCandidateView(raw),
  ));
}

function sourceCoverage(validation) {
  return validation.alphaJson.validation.source_final_fact_coverage;
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

test("obs_0724 canonical final model is authoritative by default", () => {
  const validation = validateAlphaJson(obs0724AlphaJson());

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.alphaJson.validation.structural_enforcement_enabled, false);
  assert.deepEqual(validation.structural_error_codes, []);
  assert.deepEqual(
    validation.alphaJson.service_options.items.map((option) => option.price.amount),
    [2500, 3250],
  );
  assert.ok(validation.alphaJson.validation.pre_canonical_diagnostic_codes.includes("DEPENDENT_ADDON_STANDALONE"));
  assert.ok(validation.alphaJson.validation.pre_canonical_diagnostic_codes.includes("MISSING_EXPANDED_CHOICE"));
});

test("structural enforcement allows obs_0724 after canonical final repair", () => {
  const validation = withStructuralEnforcement(() => validateAlphaJson(obs0724AlphaJson()));
  const overrideStatus = getBlockingOverrideStatus(
    validation,
    { missingAddress: true, missingContact: true, unclearScopeWithPrice: true },
    validation.alphaJson,
  );

  assert.equal(validation.can_generate_pdf, true);
  assert.equal(validation.structural_blocking_errors.length, 0);
  assert.equal(overrideStatus.canProceed, true);
  assert.equal(overrideStatus.remainingBlockingErrors.some((error) => error.includes("DEPENDENT_ADDON_STANDALONE")), false);
  assert.ok(validation.alphaJson.validation.pre_canonical_diagnostic_codes.includes("DEPENDENT_ADDON_STANDALONE"));
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

test("internal field text in final option scope hard-blocks PDF readiness", () => {
  const validation = validateAlphaJson({
    ...baseAlpha("John 8125551111 123 Main Madison IN option A drop 2500 option B haul brush 3950"),
    service_options: {
      items: [
        {
          label: "Option A",
          title: "Leave wood and brush",
          description: "service_options.items[0] Option B $3,950 Remove tree and haul brush",
          price: { amount: 2500, display: "$2,500" },
        },
      ],
    },
  });

  assert.equal(validation.can_generate_pdf, false);
  assert.ok(validation.structural_error_codes.includes("CONTAMINATED_OPTION_SCOPE"));
  assert.match(validation.blocking_errors.join(" "), /internal parser or field text/i);
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

test("hoho30 case 23 stays blocked when explicit tree and stump quantities conflict", () => {
  const raw = "Ronald Sanchez, 260-610-4393, ronald.sanchezodv@gmail.com, birch at 315 Oak near alley leaning bad wants done soon, option a remove 3 tree leave debris 6000, option b remove tree grind 1 stumps haul brush $8500";
  const validation = validateRaw(raw);

  assert.equal(validation.can_generate_pdf, false);
  assert.match(validation.blocking_errors.join(" "), /source option quantities conflict/i);
  assert.ok(validation.structural_error_codes.includes("SCOPE_NUMBER_AGREEMENT_MISMATCH"));
});

test("hoho30 case 26 is ready only with source-faithful brush disposition and haul wording", () => {
  const raw = "Jack, 574-595-4643, jack.morrisoaa@hotmail.com, walnut at 410 Walnut by fence tight access but wants it gone, option a: drop tree, leave brsh, 8,000, option b: tree down haul brush, $9750";
  const validation = validateRaw(raw);
  const descriptions = validation.alphaJson.service_options.items.map((option) => option.description).join(" ");
  const coverage = sourceCoverage(validation);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(coverage.blocking_codes, []);
  assert.equal(coverage.source_options[0].species, "walnut");
  assert.ok(coverage.source_options[0].target_qualifiers.includes("by fence"));
  assert.ok(coverage.source_options[0].debris_disposition.includes("leave_brush"));
  assert.ok(coverage.source_options[1].debris_disposition.includes("haul_brush"));
  assert.ok(coverage.final_options[0].target_qualifiers.includes("by fence"));
  assert.ok(coverage.final_options[1].target_qualifiers.includes("by fence"));
  assert.match(descriptions, /leave the brush on site/i);
  assert.match(descriptions, /haul away the brush/i);
  assert.match(validation.warnings.join(" "), /access qualifier/i);
  assert.deepEqual(validation.structural_error_codes, []);
});

test("hoho30 case 27 remains blocked and keeps sycamore plus all source actions in regenerated options", () => {
  const raw = "Sarah, 574-449-1358, phillips46@gmail.com, sycamore at lot 6418 behind garage close to fence wants fast, A remove tree leave debrs 6700 B tree out plus chip brush plus stump grinding plus cleanup 8250";
  const validation = validateRaw(raw);
  const optionText = validation.alphaJson.service_options.items.map((option) => `${option.title} ${option.description}`).join(" ");
  const coverage = sourceCoverage(validation);
  const targetResults = coverage.results.filter((result) => result.fact === "target_qualifiers");

  assert.equal(validation.can_generate_pdf, false);
  assert.match(optionText, /sycamore/i);
  assert.doesNotMatch(optionText, /maple/i);
  assert.match(optionText, /behind the garage/i);
  assert.match(optionText, /by the fence/i);
  assert.match(optionText, /leave the debris on site/i);
  assert.match(optionText, /grind the stump/i);
  assert.match(optionText, /chip the brush/i);
  assert.match(optionText, /clean up the work area/i);
  assert.ok(coverage.source_options[0].target_qualifiers.includes("behind garage"));
  assert.ok(coverage.source_options[0].target_qualifiers.includes("by fence"));
  assert.equal(coverage.blocking_results.some((result) => result.fact === "target_qualifiers"), false);
  assert.equal(targetResults.length, 2);
  for (const result of targetResults) {
    assert.equal(result.status, "ok");
    assert.equal(result.target_comparison.preservation, "complete");
    assert.deepEqual(result.target_comparison.missing_source_values, []);
    assert.ok(result.target_comparison.preserved_source_values.includes("behind garage"));
    assert.ok(result.target_comparison.preserved_source_values.includes("by fence"));
    assert.ok(result.target_comparison.final_values.includes("behind garage"));
    assert.ok(result.target_comparison.final_values.includes("by fence"));
  }
});

test("hoho30 case 28 is ready only with cleanup preserved in the stump option", () => {
  const raw = "Noah, 219-420-9333, edwards36@outlook.com, spruce near 22 ft drive opening limbs low and trunk split, A drop n leave debris 3050 B drop n stump grinding and cleanup 5800";
  const validation = validateRaw(raw);
  const descriptions = validation.alphaJson.service_options.items.map((option) => option.description).join(" ");
  const coverage = sourceCoverage(validation);

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(coverage.blocking_codes, []);
  assert.ok(coverage.source_options[0].target_qualifiers.includes("22 foot drive opening"));
  assert.ok(coverage.final_options[0].target_qualifiers.includes("22 foot drive opening"));
  assert.match(descriptions, /leave the debris on site/i);
  assert.match(descriptions, /22-foot drive opening/i);
  assert.match(descriptions, /grind the stump/i);
  assert.match(descriptions, /clean up the work area/i);
  assert.match(validation.warnings.join(" "), /condition/i);
  assert.deepEqual(validation.structural_error_codes, []);
});

test("hoho30 case 22 blocks non-canonical final TD2 output that drops source facts", () => {
  const raw = "Alexander, 463-241-1556, alexander.phillipsir@gmail.com, ash at 410 Walnut by fence lot messy wants tree out, opt a tree down leave debris 5400 opt b tree down stump grinding brush cleanup rake up 6400";
  const validation = validateRaw(raw);
  const coverage = sourceCoverage(validation);

  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.validation.source_final_fact_coverage_pdf_blocking_enabled, true);
  assert.equal(validation.alphaJson.service_options.items.some((option) => option.source === "canonical_final_option_model_shadow" || option.canonical_option), false);
  assert.ok(coverage.blocking_codes.includes("SOURCE_OPTION_ACTION_OMITTED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_SPECIES_CHANGED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_TARGET_QUALIFIER_OMITTED"));
  assert.match(validation.blocking_errors.join(" "), /ash/i);
  assert.match(validation.blocking_errors.join(" "), /by fence/i);
});

test("hoho30 case 30 blocks non-canonical final TD2 output that drops species location and stump count", () => {
  const raw = "Timothy L., 317-262-9640, timothy.workfb@outlook.com, locust at 410 Walnut by fence hard lean by line, option a: 4100 drop tree leave brsh, option b: 5250 remove it grind 2 stumps plus haul brush plus cleanup";
  const validation = validateRaw(raw);
  const coverage = sourceCoverage(validation);

  assert.equal(validation.can_generate_pdf, false);
  assert.equal(validation.alphaJson.validation.source_final_fact_coverage_pdf_blocking_enabled, true);
  assert.equal(validation.alphaJson.service_options.items.some((option) => option.source === "canonical_final_option_model_shadow" || option.canonical_option), false);
  assert.ok(coverage.blocking_codes.includes("SOURCE_SPECIES_CHANGED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_STUMP_QUANTITY_CHANGED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_TARGET_QUALIFIER_OMITTED"));
  assert.match(validation.blocking_errors.join(" "), /locust/i);
  assert.match(validation.blocking_errors.join(" "), /two stumps/i);
  assert.match(validation.blocking_errors.join(" "), /by fence/i);
});

test("source-final coverage blocks source species and target substitutions", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText: "Customer has sycamore by shed. Option A remove tree leave debris 1200. Option B remove tree haul debris 1800.",
    finalOptions: [
      {
        label: "Option A",
        title: "Maple tree removal",
        description: "Remove the maple tree and leave the debris on site.",
        price: { amount: 1200, display: "$1,200" },
      },
      {
        label: "Option B",
        title: "Maple tree removal with haul-away",
        description: "Remove the maple tree and haul away the debris.",
        price: { amount: 1800, display: "$1,800" },
      },
    ],
  });

  assert.ok(coverage.blocking_codes.includes("SOURCE_SPECIES_CHANGED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_TARGET_QUALIFIER_OMITTED"));
  assert.match(coverage.blocking_messages.join(" "), /sycamore/i);
  assert.match(coverage.blocking_messages.join(" "), /by shed/i);
});

test("source-final coverage accepts shared source facts preserved in TD2 job fields", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText:
      "Melinda Hughes needs Remove 4 locust trees. Option A cut and leave wood 2,100. Option B cut, haul away debris, and cleanup $2,450.",
    finalJob: {
      description: "Remove four locust trees. Options include leaving wood on site, haul away or cleanup.",
      tree_details: { tree_count: "4 trees", tree_type: "locust" },
    },
    finalOptions: [
      {
        label: "Option A",
        title: "cut and leave wood",
        description: "cut and leave wood",
        price: { amount: 2100, display: "$2,100" },
      },
      {
        label: "Option B",
        title: "cut, haul away debris, and cleanup",
        description: "cut, haul away debris, and cleanup",
        price: { amount: 2450, display: "$2,450" },
      },
    ],
  });

  assert.deepEqual(coverage.blocking_codes, []);
});

test("source-final coverage still blocks source targets missing from both options and TD2 job", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText:
      "Trim limbs over roof and remove brush pile. Option A trim only 850 Option B trim and haul brush 1250.",
    finalJob: {
      description: "Trim and haul brush.",
      tree_details: {},
    },
    finalOptions: [
      {
        label: "Option A",
        title: "trim only",
        description: "trim only",
        price: { amount: 850, display: "$850" },
      },
      {
        label: "Option B",
        title: "trim and haul brush",
        description: "trim and haul brush",
        price: { amount: 1250, display: "$1,250" },
      },
    ],
  });

  assert.ok(coverage.blocking_codes.includes("SOURCE_TARGET_QUALIFIER_OMITTED"));
  assert.match(coverage.blocking_messages.join(" "), /over roof/i);
});

test("source-final coverage does not treat a stump price as stump quantity", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText:
      "Henry Watkins large oak removal near barn. Option A remove oak and leave wood $2,400. Option B remove oak, haul debris, grind stump $3,650.",
    finalJob: {
      description: "Remove the large oak near the barn.",
      tree_details: { tree_type: "oak" },
    },
    finalOptions: [
      {
        label: "Option A",
        title: "remove oak and leave wood",
        description: "remove oak and leave wood",
        price: { amount: 2400, display: "$2,400" },
      },
      {
        label: "Option B",
        title: "remove oak, haul debris, grind stump",
        description: "remove oak, haul debris, grind stump",
        price: { amount: 3650, display: "$3,650" },
      },
    ],
  });

  assert.equal(coverage.source_options[1].stump_quantity, null);
  assert.equal(coverage.blocking_codes.includes("SOURCE_STUMP_QUANTITY_CHANGED"), false);
});

test("source-final coverage keeps shorthand D full cleanup as its own option", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText:
      "A drop only 1,900 B drop stack wood $2,200 C haul brush 3150 D full cleanup 3,900 E cleanup plus stump grind $4,350",
    finalOptions: [
      {
        label: "Option A",
        title: "drop only",
        description: "drop only",
        price: { amount: 1900, display: "$1,900" },
      },
      {
        label: "Option B",
        title: "drop stack wood",
        description: "drop stack wood",
        price: { amount: 2200, display: "$2,200" },
      },
      {
        label: "Option C",
        title: "haul brush",
        description: "haul brush",
        price: { amount: 3150, display: "$3,150" },
      },
      {
        label: "Option D",
        title: "full cleanup",
        description: "full cleanup",
        price: { amount: 3900, display: "$3,900" },
      },
    ],
  });

  assert.deepEqual(coverage.source_options.map((option) => option.price), [1900, 2200, 3150, 3900]);
  assert.equal(coverage.blocking_codes.includes("SOURCE_OPTION_PRICE_CHANGED"), false);
});

test("source-final coverage separates partial target preservation from true contradiction", () => {
  const partialCoverage = buildSourceFinalFactCoverage({
    rawText: "Customer has sycamore behind garage close to fence. A remove tree leave debris 6700 B remove tree chip brush 8250",
    finalOptions: [
      {
        label: "Option A",
        title: "Sycamore tree removal by fence",
        description: "Remove the sycamore tree by the fence and leave the debris on site.",
        price: { amount: 6700, display: "$6,700" },
      },
      {
        label: "Option B",
        title: "Sycamore tree removal with brush chipping by fence",
        description: "Remove the sycamore tree by the fence and chip the brush.",
        price: { amount: 8250, display: "$8,250" },
      },
    ],
  });
  const partialTargetResults = partialCoverage.blocking_results.filter((result) => result.fact === "target_qualifiers");

  assert.equal(partialTargetResults.length, 2);
  for (const result of partialTargetResults) {
    assert.equal(result.status, "missing");
    assert.equal(result.target_comparison.preservation, "partial");
    assert.deepEqual(result.missing_source_values, ["behind garage"]);
    assert.deepEqual(result.target_comparison.preserved_source_values, ["by fence"]);
    assert.match(result.message, /preserves "by fence" but is missing "behind garage"/i);
  }

  const contradictionCoverage = buildSourceFinalFactCoverage({
    rawText: "Customer has sycamore by shed. Option A remove tree leave debris 1200. Option B remove tree haul debris 1800.",
    finalOptions: [
      {
        label: "Option A",
        title: "Sycamore tree removal by fence",
        description: "Remove the sycamore tree by the fence and leave the debris on site.",
        price: { amount: 1200, display: "$1,200" },
      },
      {
        label: "Option B",
        title: "Sycamore tree removal with haul-away by fence",
        description: "Remove the sycamore tree by the fence and haul away the debris.",
        price: { amount: 1800, display: "$1,800" },
      },
    ],
  });
  const contradictionTargetResults = contradictionCoverage.blocking_results.filter((result) => result.fact === "target_qualifiers");

  assert.equal(contradictionTargetResults.length, 2);
  for (const result of contradictionTargetResults) {
    assert.equal(result.status, "changed");
    assert.equal(result.target_comparison.preservation, "contradiction");
    assert.deepEqual(result.missing_source_values, ["by shed"]);
    assert.deepEqual(result.target_comparison.final_values, ["by fence"]);
    assert.match(result.message, /only says "by fence"/i);
  }
});

test("source-final coverage treats flush cut and cut low as stump-cut treatment, not stump grinding", () => {
  const okCoverage = buildSourceFinalFactCoverage({
    rawText: "Customer has oak by shed. Option A remove oak 1000. Option B remove oak and flush cut stump 1300.",
    finalOptions: [
      {
        label: "Option A",
        title: "Oak tree removal",
        description: "Remove the oak tree by the shed.",
        price: { amount: 1000, display: "$1,000" },
      },
      {
        label: "Option B",
        title: "Oak tree removal with stump cut low",
        description: "Remove the oak tree by the shed and cut the stump low.",
        price: { amount: 1300, display: "$1,300" },
      },
    ],
  });
  const badCoverage = buildSourceFinalFactCoverage({
    rawText: "Customer has oak by shed. Option A remove oak 1000. Option B remove oak and flush cut stump 1300.",
    finalOptions: [
      {
        label: "Option A",
        title: "Oak tree removal",
        description: "Remove the oak tree by the shed.",
        price: { amount: 1000, display: "$1,000" },
      },
      {
        label: "Option B",
        title: "Oak tree removal with stump grinding",
        description: "Remove the oak tree by the shed and grind the stump.",
        price: { amount: 1300, display: "$1,300" },
      },
    ],
  });

  assert.deepEqual(okCoverage.blocking_codes, []);
  assert.ok(badCoverage.blocking_codes.includes("SOURCE_STUMP_TREATMENT_CHANGED"));
  assert.match(badCoverage.blocking_messages.join(" "), /cut stump low/i);
});

test("source-final coverage blocks dropped actions in multi-action Option B packages", () => {
  const coverage = buildSourceFinalFactCoverage({
    rawText: "Customer has sycamore behind garage. A remove tree leave debris 6700 B tree out plus chip brush plus stump grinding plus cleanup 8250",
    finalOptions: [
      {
        label: "Option A",
        title: "Sycamore tree removal",
        description: "Remove the sycamore tree behind the garage and leave the debris on site.",
        price: { amount: 6700, display: "$6,700" },
      },
      {
        label: "Option B",
        title: "Sycamore tree removal with stump grinding",
        description: "Remove the sycamore tree behind the garage and grind the stump.",
        price: { amount: 8250, display: "$8,250" },
      },
    ],
  });

  assert.ok(coverage.blocking_codes.includes("SOURCE_OPTION_ACTION_OMITTED"));
  assert.ok(coverage.blocking_codes.includes("SOURCE_DEBRIS_DISPOSITION_CHANGED"));
  assert.match(coverage.blocking_messages.join(" "), /chip brush/i);
  assert.match(coverage.blocking_messages.join(" "), /cleanup/i);
});
