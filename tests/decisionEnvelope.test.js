import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_POLICY_VERSION,
  createCandidate,
  createEnvelope,
  selectCandidate,
  validateDecisionEnvelope,
} from "../lib/decisionEnvelope.js";

test("createEnvelope and createCandidate produce a valid shared shape", () => {
  const candidate = createCandidate({
    id: "phone_1",
    value: "812-555-0134",
    source: "structured_intake",
    support: "normalized_explicit",
    evidence: [{ quote: "(812) 555-0134", start: 0, end: 14 }],
    status: "eligible",
    reasonCodes: ["source_intake"],
  });
  const envelope = createEnvelope({
    field: "customer.phone",
    candidates: selectCandidate([candidate], "phone_1"),
    resolution: {
      status: "selected",
      selectedCandidateId: "phone_1",
      reasonCode: "structured_intake_preferred",
      policyVersion: CONTACT_POLICY_VERSION,
      resolvedBy: "contact_policy",
    },
  });

  const validation = validateDecisionEnvelope(envelope);
  assert.equal(validation.ok, true, validation.errors.join("; "));
  assert.equal(envelope.candidates[0].status, "selected");
  assert.equal(envelope.resolution.policyVersion, "contact_policy@1");
});

test("validateDecisionEnvelope rejects invalid resolution codes", () => {
  const envelope = createEnvelope({
    field: "customer.phone",
    candidates: [],
    resolution: {
      status: "picked",
      reasonCode: "not_a_code",
      policyVersion: CONTACT_POLICY_VERSION,
      resolvedBy: "contact_policy",
    },
  });
  const validation = validateDecisionEnvelope(envelope);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /resolution.status/.test(error)));
  assert.ok(validation.errors.some((error) => /reasonCode/.test(error)));
});
