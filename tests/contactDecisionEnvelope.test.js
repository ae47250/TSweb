import test from "node:test";
import assert from "node:assert/strict";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import {
  buildAddressDecisionEnvelope,
  buildContactDecisionEnvelopes,
  buildEmailDecisionEnvelope,
  buildPhoneDecisionEnvelope,
} from "../lib/contactDecisionEnvelope.js";
import { validateDecisionEnvelope } from "../lib/decisionEnvelope.js";

test("contact phone envelope preserves intake winner and records raw alternatives", () => {
  const contact = normalizeContactFields({
    rawText: "Call 812-555-9999",
    intake: { phone: "(812) 555-0134" },
  });
  const envelope = buildPhoneDecisionEnvelope(contact);
  const validation = validateDecisionEnvelope(envelope);
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.equal(envelope.field, "customer.phone");
  assert.equal(envelope.resolution.status, "selected");
  assert.equal(envelope.resolution.reasonCode, "structured_intake_preferred");
  assert.equal(envelope.resolution.resolvedBy, "contact_policy");

  const selected = envelope.candidates.find((candidate) => candidate.id === envelope.resolution.selectedCandidateId);
  assert.equal(selected?.value, contact.phone.display);
  assert.equal(selected?.source, "structured_intake");
  assert.ok(envelope.candidates.some((candidate) => candidate.source === "raw_notes" && candidate.status !== "selected"));
});

test("contact email and address envelopes match normalizer winners", () => {
  const contact = normalizeContactFields({
    rawText: "Customer email: labeled@example.com. 123 Main St Bloomington IN 47401",
    intake: {},
  });
  const email = buildEmailDecisionEnvelope(contact);
  const address = buildAddressDecisionEnvelope(contact);

  assert.equal(validateDecisionEnvelope(email).ok, true);
  assert.equal(validateDecisionEnvelope(address).ok, true);
  assert.equal(
    email.candidates.find((candidate) => candidate.status === "selected")?.value,
    contact.email.value,
  );
  assert.equal(
    address.candidates.find((candidate) => candidate.status === "selected")?.value,
    contact.address.value,
  );
  assert.equal(address.resolution.resolvedBy, "address_policy");
});

test("buildContactDecisionEnvelopes returns phone email and service_address keys", () => {
  const contact = normalizeContactFields({
    rawText: "Customer phone: 812-555-0134 email right@example.com",
  });
  const decisions = buildContactDecisionEnvelopes(contact);
  assert.ok(decisions.phone);
  assert.ok(decisions.email);
  assert.ok(decisions.service_address);
});
