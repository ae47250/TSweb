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
