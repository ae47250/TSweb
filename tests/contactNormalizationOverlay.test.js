import test from "node:test";
import assert from "node:assert/strict";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";

function baseAlphaJson(customer = {}) {
  return {
    customer: {
      phone_primary: "",
      phone_display: "",
      email: "",
      ...customer,
    },
    normalization: {
      corrections_made: [],
      uncertainties: [],
      low_confidence_spans: [],
      field_evidence: {},
    },
  };
}

test("contact overlay fills missing phone and email from one high-confidence labeled candidate", () => {
  const contact = normalizeContactFields({
    rawText: "Customer phone: 812-555-0134. Customer email: Sam.Tree@example.com.",
  });
  const result = applyContactNormalizationOverlay(baseAlphaJson(), contact);

  assert.equal(result.customer.phone_display, "812-555-0134");
  assert.equal(result.customer.phone_primary, "812-555-0134");
  assert.equal(result.customer.email, "sam.tree@example.com");
  assert.equal(result.normalization.field_evidence.phone, "812-555-0134");
  assert.equal(result.normalization.field_evidence.email, "sam.tree@example.com");
  assert.equal(result.normalization.field_evidence.contact_normalizer_phone, "812-555-0134");
  assert.equal(result.normalization.field_evidence.contact_normalizer_email, "sam.tree@example.com");
  assert.equal(result.normalization.corrections_made.length, 2);
  assert.equal(result.normalization.uncertainties.length, 0);
});

test("contact overlay keeps parsed contact values when contact metadata conflicts", () => {
  const contact = normalizeContactFields({
    rawText: "Customer phone: 812-555-0134. Customer email: correct@example.com.",
  });
  const result = applyContactNormalizationOverlay(
    baseAlphaJson({ phone_primary: "812-555-9999", phone_display: "812-555-9999", email: "parsed@example.com" }),
    contact,
  );

  assert.equal(result.customer.phone_display, "812-555-9999");
  assert.equal(result.customer.email, "parsed@example.com");
  assert.equal(result.normalization.uncertainties.filter((item) => item.field === "customer.phone").length, 1);
  assert.equal(result.normalization.uncertainties.filter((item) => item.field === "customer.email").length, 1);
  assert.equal(result.normalization.low_confidence_spans.filter((item) => item.field === "customer.phone").length, 1);
  assert.equal(result.normalization.low_confidence_spans.filter((item) => item.field === "customer.email").length, 1);
});

test("contact overlay does not fill from multiple valid contact candidates", () => {
  const contact = normalizeContactFields({
    rawText: "Customer phone: 812-555-0134 or 812-555-9999. Email first@example.com or second@example.com.",
  });
  const result = applyContactNormalizationOverlay(baseAlphaJson(), contact);

  assert.equal(result.customer.phone_display, "");
  assert.equal(result.customer.email, "");
  assert.equal(result.normalization.field_evidence.phone || "", "");
  assert.equal(result.normalization.field_evidence.email || "", "");
  assert.equal(result.normalization.corrections_made.length, 0);
});

test("contact overlay does not fill from unlabeled medium-confidence contact candidates", () => {
  const contact = normalizeContactFields({
    rawText: "sam@example.com remove maple tree 812-555-0134",
  });
  const result = applyContactNormalizationOverlay(baseAlphaJson(), contact);

  assert.equal(result.customer.phone_display, "");
  assert.equal(result.customer.email, "");
  assert.equal(result.normalization.corrections_made.length, 0);
});
