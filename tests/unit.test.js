import test from "node:test";
import assert from "node:assert/strict";
import { createDraftAlphaJson } from "../lib/alphaJson.js";
import { generateDocumentId } from "../lib/metadata.js";
import { buildPriceInstrumentation, extractRawPriceEvidence } from "../lib/priceInstrumentation.js";
import { checkRateLimit, resetRateLimiter } from "../lib/rateLimiter.js";
import { getBlockingOverrideStatus } from "../lib/reviewOverrides.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { easyInput } from "./fixtures/sampleInput.js";

test("draft parser preserves raw input and creates AlphaJSON shell", () => {
  const alphaJson = createDraftAlphaJson(easyInput);
  assert.equal(alphaJson.schema_info.schema_name, "AlphaJSON");
  assert.equal(alphaJson.schema_info.schema_version, "1.4");
  assert.equal(alphaJson.raw_input.customer_text, easyInput);
  assert.equal(alphaJson.company.name, "Alpha Tree Service");
});

test("validation passes complete easy input", () => {
  const result = validateAlphaJson(createDraftAlphaJson(easyInput));
  assert.equal(result.can_generate_pdf, true);
  assert.deepEqual(result.blocking_errors, []);
  assert.equal(result.alphaJson.service_options.items[0].label, "Option A");
});

test("validation blocks missing phone and priced option", () => {
  const alphaJson = createDraftAlphaJson("Remove a tree at 123 Main Street.");
  const result = validateAlphaJson(alphaJson);
  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.blocking_errors.includes("Missing customer phone or email."));
  assert.ok(result.blocking_errors.includes("Missing priced service option."));
});

test("review overrides allow only accepted address and contact blocking issues", () => {
  const alphaJsonMissingContact = { customer: { phone_display: "", phone_primary: "", email: "" } };
  const addressAndContactValidation = {
    can_generate_pdf: false,
    blocking_errors: ["Missing service address.", "Missing customer phone or email."],
  };

  assert.equal(getBlockingOverrideStatus(addressAndContactValidation, {}, alphaJsonMissingContact).canProceed, false);
  assert.equal(getBlockingOverrideStatus(addressAndContactValidation, { missingAddress: true }, alphaJsonMissingContact).canProceed, false);
  assert.equal(getBlockingOverrideStatus(addressAndContactValidation, { missingAddress: true, missingContact: true }, alphaJsonMissingContact).canProceed, true);

  const unrelatedValidation = {
    can_generate_pdf: false,
    blocking_errors: ["Missing service address.", "Missing priced service option."],
  };

  const status = getBlockingOverrideStatus(unrelatedValidation, { missingAddress: true, missingContact: true }, alphaJsonMissingContact);
  assert.equal(status.canProceed, false);
  assert.deepEqual(status.remainingBlockingErrors, ["Missing priced service option."]);
});

test("review overrides require acknowledgement for each missing send channel", () => {
  const validation = { can_generate_pdf: true, blocking_errors: [] };

  const missingPhone = getBlockingOverrideStatus(
    validation,
    {},
    { customer: { phone_display: "", phone_primary: "", email: "sam@example.com" } },
  );
  assert.equal(missingPhone.canProceed, false);
  assert.equal(missingPhone.contactWarning.message, "Customer phone number is missing, but email is given. Sending Estimate SMS will not be available.");
  assert.equal(
    getBlockingOverrideStatus(validation, { missingPhone: true }, { customer: { phone_display: "", phone_primary: "", email: "sam@example.com" } }).canProceed,
    true,
  );

  const missingEmail = getBlockingOverrideStatus(
    validation,
    {},
    { customer: { phone_display: "812-555-0199", phone_primary: "812-555-0199", email: "" } },
  );
  assert.equal(missingEmail.canProceed, false);
  assert.equal(missingEmail.contactWarning.message, "Customer email is missing, but phone number is given. Sending Estimate Email will not be available.");
  assert.equal(
    getBlockingOverrideStatus(validation, { missingEmail: true }, { customer: { phone_display: "812-555-0199", phone_primary: "812-555-0199", email: "" } }).canProceed,
    true,
  );
});

test("review overrides allow unclear scope only when a firm price is displayed", () => {
  const validation = {
    can_generate_pdf: false,
    blocking_errors: ["Property responsibility or work scope is unclear."],
  };
  const alphaJsonWithPrice = {
    customer: { phone_display: "812-555-0199", phone_primary: "812-555-0199", email: "sam@example.com" },
    service_options: {
      items: [{ price: { display: "$2,450", amount: 2450, is_unclear: false } }],
    },
  };
  const alphaJsonWithoutPrice = {
    customer: { phone_display: "812-555-0199", phone_primary: "812-555-0199", email: "sam@example.com" },
    service_options: {
      items: [{ price: { display: "", amount: null, is_unclear: false } }],
    },
  };

  const needsOverride = getBlockingOverrideStatus(validation, {}, alphaJsonWithPrice);
  assert.equal(needsOverride.canProceed, false);
  assert.equal(needsOverride.needsScopeOverride, true);

  const accepted = getBlockingOverrideStatus(validation, { unclearScopeWithPrice: true }, alphaJsonWithPrice);
  assert.equal(accepted.canProceed, true);
  assert.equal(accepted.acceptedOverrideWarnings[0].title, "Work scope unclear");

  const noPrice = getBlockingOverrideStatus(validation, { unclearScopeWithPrice: true }, alphaJsonWithoutPrice);
  assert.equal(noPrice.canProceed, false);
  assert.equal(noPrice.needsScopeOverride, false);
  assert.deepEqual(noPrice.remainingBlockingErrors, ["Property responsibility or work scope is unclear."]);
});

function pricedOptionsCase(prices) {
  return {
    raw_input: { customer_text: "Sam Price 812-555-0199 123 Oak Lane Madison IN remove one maple tree." },
    customer: { name: "Sam Price", phone_display: "812-555-0199" },
    job: {
      description: "Remove one maple tree.",
      service_address: { display: "123 Oak Lane, Madison, IN" },
      tree_details: { tree_count: "1 tree", tree_type: "maple" },
    },
    service_options: {
      items: prices.map((price, index) => ({
        label: `Input ${index + 1}`,
        title: index === 0 ? "Remove only" : "Remove and haul away",
        description: index === 0 ? "Remove only" : "Remove and haul away",
        price,
      })),
    },
  };
}

test("validation warns on 3x firm option price spread without blocking", () => {
  const result = validateAlphaJson(
    pricedOptionsCase([
      { display: "$1,250", amount: 1250 },
      { display: "$9,025", amount: 9025 },
    ]),
  );

  assert.equal(result.can_generate_pdf, true);
  assert.deepEqual(result.blocking_errors, []);
  assert.match(result.warnings.join(" "), /Large price spread.*Option B \$9,025.*3x\+.*Option A \$1,250.*Confirm price quote.*edit info/i);
});

test("validation does not warn when firm option price spread is below 3x", () => {
  const result = validateAlphaJson(
    pricedOptionsCase([
      { display: "$1,500", amount: 1500 },
      { display: "$4,400", amount: 4400 },
    ]),
  );

  assert.equal(result.can_generate_pdf, true);
  assert.doesNotMatch(result.warnings.join(" "), /price spread/i);
});

test("validation ignores unclear or missing prices for price-spread warning", () => {
  const unclear = validateAlphaJson(
    pricedOptionsCase([
      { display: "$1,000", amount: 1000 },
      { display: "$9,000", amount: 9000, is_unclear: true },
    ]),
  );
  const missing = validateAlphaJson(pricedOptionsCase([{ display: "$1,000", amount: 1000 }, { display: "", amount: null }]));

  assert.equal(unclear.can_generate_pdf, false);
  assert.equal(missing.can_generate_pdf, false);
  assert.doesNotMatch(unclear.warnings.join(" "), /price spread/i);
  assert.doesNotMatch(missing.warnings.join(" "), /price spread/i);
});

test("price instrumentation separates raw price evidence from excluded numbers", () => {
  const evidence = extractRawPriceEvidence("Call 812-555-1200. Address 1500 Maple Ave. remove oak option A 1800 option B 2400.");

  assert.deepEqual(evidence.filter((item) => item.supported && !item.excluded).map((item) => item.value), ["$1,800", "$2,400"]);
  assert.deepEqual(evidence.filter((item) => item.excluded).map((item) => item.exclusion_reason), ["phone", "address"]);
});

test("price instrumentation classifies unsupported expected labels and pipeline drop stages", () => {
  const unsupportedExpected = buildPriceInstrumentation({
    rawInput: "Remove one oak. option A 1200.",
    expectedPrices: ["$1,200", "$1,800"],
    alphaJsonAfterNormalization: {
      service_options: {
        items: [{ label: "Option A", price: { display: "$1,200", amount: 1200 } }],
      },
    },
    validation: {
      can_generate_pdf: true,
      alphaJson: {
        service_options: {
          items: [{ label: "Option A", price: { display: "$1,200", amount: 1200 } }],
        },
      },
    },
  });

  assert.equal(unsupportedExpected.expected_price_supported_by_raw_input[0].supported_by_raw_input, true);
  assert.equal(unsupportedExpected.expected_price_supported_by_raw_input[1].supported_by_raw_input, false);
  assert.equal(unsupportedExpected.price_failure_stage, "raw_expected_unsupported");

  const normalizationDropped = buildPriceInstrumentation({
    rawInput: "Remove one oak. option A 1200 option B 1800.",
    expectedPrices: ["$1,200", "$1,800"],
    alphaJsonBeforeNormalization: {
      options: [
        { label: "A", price: { display: "$1,200", amount: 1200 } },
        { label: "B", price: { display: "$1,800", amount: 1800 } },
      ],
    },
    alphaJsonAfterNormalization: {
      service_options: {
        items: [{ label: "Option A", price: { display: "$1,200", amount: 1200 } }],
      },
    },
    validation: {
      can_generate_pdf: true,
      alphaJson: {
        service_options: {
          items: [{ label: "Option A", price: { display: "$1,200", amount: 1200 } }],
        },
      },
    },
  });

  assert.ok(normalizationDropped.price_failure_stages.includes("normalization_dropped_price"));
  assert.ok(normalizationDropped.price_failure_stages.includes("raw_supported_price_missing_in_td2"));
});

test("document IDs use expected EST date format", () => {
  const id = generateDocumentId(new Date("2026-06-29T12:00:00Z"));
  assert.match(id, /^EST-20260629-\d{3}$/);
});

test("rate limiter blocks the 11th request", () => {
  resetRateLimiter();
  let result;
  for (let i = 0; i < 11; i += 1) {
    result = checkRateLimit("unit-test-ip", 1000);
  }
  assert.equal(result.allowed, false);
});
