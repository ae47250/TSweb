import test from "node:test";
import assert from "node:assert/strict";
import { SIGNATURE_MAX_LENGTH, SIGNATURE_MIN_LENGTH } from "../config/constants.js";
import { createDraftAlphaJson } from "../lib/alphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function canSubmit(selectedOption, signature) {
  return Boolean(
    selectedOption &&
      signature.trim().length >= SIGNATURE_MIN_LENGTH &&
      signature.trim().length <= SIGNATURE_MAX_LENGTH,
  );
}

test("buttons stay disabled until option and valid signature exist", () => {
  assert.equal(canSubmit("", ""), false);
  assert.equal(canSubmit("Option A", ""), false);
  assert.equal(canSubmit("", "John Smith"), false);
  assert.equal(canSubmit("Option A", "J"), false);
  assert.equal(canSubmit("Option A", "John Smith"), true);
});

test("clearing option or signature re-disables submit", () => {
  let selectedOption = "Option A";
  let signature = "John Smith";
  assert.equal(canSubmit(selectedOption, signature), true);
  selectedOption = "";
  assert.equal(canSubmit(selectedOption, signature), false);
  selectedOption = "Option B";
  signature = "";
  assert.equal(canSubmit(selectedOption, signature), false);
});

test("signature over maximum length is invalid", () => {
  assert.equal(canSubmit("Option A", "x".repeat(SIGNATURE_MAX_LENGTH + 1)), false);
});

test("2, 3, and 4 option jobs relabel by price", () => {
  const base = "Jane 555-123-4567 123 Main Street remove 2 trees. ";
  for (const optionText of [
    "basic $1000; premium $2000",
    "basic $1000; better $2000; best $3000",
    "a $1000; b $2000; c $3000; d $4000",
  ]) {
    const result = validateAlphaJson(createDraftAlphaJson(base + optionText));
    assert.equal(result.can_generate_pdf, true);
    assert.equal(result.alphaJson.service_options.items[0].label, "Option A");
  }
});
