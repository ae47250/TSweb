import test from "node:test";
import assert from "node:assert/strict";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "../lib/reviewOverrides.js";

// This suite proves the readiness-safety hard-block/override plumbing works in
// isolation. Enforcement itself stays behind `readinessSafetyPdfBlockingEnabled`
// (lib/validateJson.js) until invariants are retuned against the broader test
// corpus (see the TODO there); this locks in the override contract so flipping
// that flag later only requires deleting the flag, not rebuilding this path.

test("normalizeReviewOverrides recognizes acknowledgedReadinessRisk", () => {
  const normalized = normalizeReviewOverrides({ acknowledgedReadinessRisk: true });
  assert.equal(normalized.acknowledgedReadinessRisk, true);
  assert.equal(normalizeReviewOverrides({}).acknowledgedReadinessRisk, false);
});

test("readiness check blocking messages require an explicit reviewer override", () => {
  const validation = {
    blocking_errors: ["Readiness check: High-confidence price $1,800 has not been accepted, rejected, or explicitly reviewed."],
  };
  const status = getBlockingOverrideStatus(validation, {}, {});
  assert.equal(status.canProceed, false);
  assert.equal(status.needsReadinessOverride, true);
  assert.ok(status.readinessWarning);
  assert.deepEqual(status.readinessWarning.findings, [
    "High-confidence price $1,800 has not been accepted, rejected, or explicitly reviewed.",
  ]);
});

test("accepting the readiness override clears the readiness blocking message", () => {
  const validation = {
    blocking_errors: ["Readiness check: Two or more supported candidates conflict on critical field job.tree_details.tree_count."],
  };
  const status = getBlockingOverrideStatus(validation, { acknowledgedReadinessRisk: true }, {});
  assert.equal(status.canProceed, true);
  assert.equal(status.remainingBlockingErrors.length, 0);
  assert.equal(status.acceptedOverrideWarnings.some((warning) => warning.key === "acknowledgedReadinessRisk"), true);
});

test("readiness override does not accidentally clear unrelated blocking errors", () => {
  const validation = {
    blocking_errors: [
      "Readiness check: Some readiness finding.",
      "Option A is missing a clear price.",
    ],
  };
  const status = getBlockingOverrideStatus(validation, { acknowledgedReadinessRisk: true }, {});
  assert.equal(status.canProceed, false);
  assert.deepEqual(status.remainingBlockingErrors, ["Option A is missing a clear price."]);
});
