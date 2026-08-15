import test from "node:test";
import assert from "node:assert/strict";
import { getBlockingOverrideStatus, normalizeReviewOverrides } from "../lib/reviewOverrides.js";
import { createReadinessDecision } from "../lib/readinessReview.js";

test("normalizeReviewOverrides does not expose a global readiness acknowledgement", () => {
  const normalized = normalizeReviewOverrides({ acknowledgedReadinessRisk: true });
  assert.equal("acknowledgedReadinessRisk" in normalized, false);
});

test("readiness check blocking messages require an explicit reviewer override", () => {
  const finding = {
    finding_id: "finding-price-1",
    field: "service_options.prices",
    option_id: "Option A",
    enforceable: true,
    evidence: { amount: 1800 },
  };
  const error = `Readiness check [${finding.finding_id}]: High-confidence price needs review.`;
  const validation = {
    blocking_errors: [error],
    readiness_safety: { enforced_findings: [finding] },
    readiness_safety_pdf_blocking_enabled: true,
    readiness_safety_blocking_errors: [error],
  };
  const status = getBlockingOverrideStatus(validation, {}, {});
  assert.equal(status.canProceed, false);
  assert.equal(status.needsReadinessOverride, true);
  assert.ok(status.readinessWarning);
  assert.equal(status.readinessWarning.findings[0].findingId, finding.finding_id);
});

test("a matching structured decision clears only its readiness finding", () => {
  const finding = {
    finding_id: "finding-tree-1",
    field: "job.tree_details.tree_count",
    candidate_ids: [],
    enforceable: true,
    evidence: { quote: "one tree" },
  };
  const error = `Readiness check [${finding.finding_id}]: Tree count needs review.`;
  const validation = {
    blocking_errors: [error],
    readiness_safety: { enforced_findings: [finding] },
    readiness_safety_pdf_blocking_enabled: true,
    readiness_safety_blocking_errors: [error],
  };
  const decision = createReadinessDecision({
    findingId: finding.finding_id,
    field: finding.field,
    action: "keep_original",
    value: "1 tree",
    reasonCode: "formatting",
  });
  const status = getBlockingOverrideStatus(validation, { readinessDecisions: [decision] }, {
    job: { tree_details: { tree_count: "1 tree" } },
  });
  assert.equal(status.canProceed, true);
  assert.deepEqual(status.clearedReadinessFindingIds, [finding.finding_id]);
});

test("a global acknowledgement cannot clear readiness or unrelated errors", () => {
  const finding = {
    finding_id: "finding-1",
    field: "customer.phone",
    candidate_ids: [],
    enforceable: true,
    reason: "Phone needs review.",
    evidence: { quote: "phone" },
  };
  const readinessError = `Readiness check [${finding.finding_id}]: Phone needs review.`;
  const validation = {
    blocking_errors: [
      readinessError,
      "Option A is missing a clear price.",
    ],
    readiness_safety: { enforced_findings: [finding] },
    readiness_safety_pdf_blocking_enabled: true,
    readiness_safety_blocking_errors: [readinessError],
  };
  const status = getBlockingOverrideStatus(validation, { acknowledgedReadinessRisk: true }, {});
  assert.equal(status.canProceed, false);
  assert.ok(status.remainingBlockingErrors.includes(readinessError));
  assert.ok(status.remainingBlockingErrors.includes("Option A is missing a clear price."));
});
