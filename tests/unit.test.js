import test from "node:test";
import assert from "node:assert/strict";
import { createDraftAlphaJson } from "../lib/alphaJson.js";
import { generateDocumentId } from "../lib/metadata.js";
import { checkRateLimit, resetRateLimiter } from "../lib/rateLimiter.js";
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
