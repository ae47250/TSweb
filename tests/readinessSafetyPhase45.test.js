import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateReadinessSafety,
} from "../lib/readinessSafety.js";
import {
  canonicalReadinessField,
  createReadinessDecision,
  readinessOverrideStatus,
  readinessSafetyBlockingEnabled,
  validateReadinessDecisions,
} from "../lib/readinessReview.js";

function phoneAlphaJson() {
  return {
    customer: { phone_primary: "317-555-0100" },
    service_options: {
      items: [{ id: "option-a", label: "Option A", price: { amount: 1800, display: "$1,800" } }],
    },
    normalization: {
      decisions: {
        phone: {
          candidates: [{
            id: "phone-candidate-b",
            value: "812-555-0100",
            status: "eligible",
            support: "explicit",
          }],
        },
      },
    },
  };
}

function phoneFinding() {
  return {
    finding_id: "finding-phone-conflict",
    field: "customer.phone",
    candidate_ids: ["phone-candidate-b"],
    enforceable: true,
    evidence: { quote: "Also call 812-555-0100." },
  };
}

test("blocking is an environment decision and finding IDs remain stable", () => {
  assert.equal(readinessSafetyBlockingEnabled({}), false);
  assert.equal(readinessSafetyBlockingEnabled({ ENABLE_READINESS_SAFETY_BLOCKING: "false" }), false);
  assert.equal(readinessSafetyBlockingEnabled({ ENABLE_READINESS_SAFETY_BLOCKING: "true" }), true);

  const alphaJson = {
    raw_input: { customer_text: "Remove one maple. Price $1,000." },
    normalization: {
      sidecar_price_reconciliation: {
        sidecar_prices: [{
          amount: 500,
          amount_confidence: "high",
          candidate_status: "eligible",
          reason_code: "needs_review_addon_ambiguity",
        }],
      },
    },
  };
  const off = evaluateReadinessSafety({ alphaJson });
  const on = evaluateReadinessSafety({ alphaJson });
  assert.deepEqual(
    on.findings.map((finding) => finding.finding_id),
    off.findings.map((finding) => finding.finding_id),
  );
  assert.ok(on.enforced_findings.every((finding) => finding.field && finding.evidence));
});

test("field-level decisions accept verified candidates and reject forged context", () => {
  const alphaJson = phoneAlphaJson();
  const finding = phoneFinding();
  const valid = createReadinessDecision({
    findingId: finding.finding_id,
    field: "customer.phone",
    action: "selected_candidate",
    candidateId: "phone-candidate-b",
    value: "812-555-0100",
    reasonCode: "app_wrong",
    note: "The later phone number is the customer correction.",
  });
  const accepted = validateReadinessDecisions([finding], [valid], alphaJson);
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.accepted[0].findingId, finding.finding_id);

  const forgedCandidate = {
    ...valid,
    decisionId: "forged-candidate",
    candidateId: "phone-candidate-forged",
    value: "999-555-0199",
  };
  const forged = validateReadinessDecisions([finding], [forgedCandidate], alphaJson);
  assert.equal(forged.accepted.length, 0);
  assert.equal(forged.errors[0].code, "INVALID_FINDING_DECISION");

  const wrongField = {
    ...valid,
    decisionId: "wrong-field",
    field: "job.tree_details.tree_count",
  };
  const mismatched = validateReadinessDecisions([finding], [wrongField], alphaJson);
  assert.equal(mismatched.accepted.length, 0);
  assert.equal(mismatched.errors[0].code, "INVALID_FINDING_DECISION");

  const missingBusinessValue = createReadinessDecision({
    findingId: finding.finding_id,
    field: "customer.phone",
    action: "marked_business_change",
    reasonCode: "customer_update",
  });
  const invalidBusinessChange = validateReadinessDecisions([finding], [missingBusinessValue], alphaJson);
  assert.equal(invalidBusinessChange.accepted.length, 0);
  assert.equal(invalidBusinessChange.errors[0].code, "INVALID_FINDING_DECISION");
});

test("one reviewer decision cannot clear a second finding on the same field", () => {
  const alphaJson = {
    normalization: {
      sidecar_price_reconciliation: {
        sidecar_prices: [
          {
            amount: 500,
            amount_confidence: "high",
            candidate_status: "eligible",
            reason_code: "needs_review_addon_ambiguity",
            price_id: "price-one",
          },
          {
            amount: 700,
            amount_confidence: "high",
            candidate_status: "eligible",
            reason_code: "needs_review_addon_ambiguity",
            price_id: "price-two",
          },
        ],
      },
    },
  };
  const before = evaluateReadinessSafety({ alphaJson });
  assert.ok(before.findings.length >= 2);
  const cleared = before.findings[0];
  const reviewedAlphaJson = {
    ...alphaJson,
    review: {
      readiness_decisions: [{
        decisionId: "decision-one",
        findingId: cleared.finding_id,
        field: cleared.field,
        action: "keep_original",
        reasonCode: "app_wrong",
      }],
    },
  };
  const after = evaluateReadinessSafety({
    alphaJson: reviewedAlphaJson,
  });
  assert.equal(after.findings.some((finding) => finding.finding_id === cleared.finding_id), true);
  const status = readinessOverrideStatus({
    readiness_safety: after,
    readiness_safety_blocking_errors: after.enforced_findings.map(
      (finding) => `Readiness check [${finding.finding_id}]: ${finding.reason}`,
    ),
    blocking_errors: after.enforced_findings.map(
      (finding) => `Readiness check [${finding.finding_id}]: ${finding.reason}`,
    ),
  }, {}, reviewedAlphaJson);
  assert.deepEqual(status.clearedFindingIds, [cleared.finding_id]);
  assert.ok(after.findings.length >= 1);
});

test("staging review decisions clear stable findings without clearing unrelated generated findings", async () => {
  const previous = process.env.ENABLE_READINESS_SAFETY_BLOCKING;
  process.env.ENABLE_READINESS_SAFETY_BLOCKING = "true";
  try {
    const { normalizeToAlphaJsonV14 } = await import("../lib/normalizeAlphaJson.js");
    const { validateAlphaJsonRoutePayload } = await import("../lib/validateRoutePayload.js");
    const raw = "Jane Doe 317-555-0100 jane@example.com 42 Oak Street Madison IN. Remove one oak. Quote $1800 or $2200 separately.";
    const baseline = validateAlphaJsonRoutePayload({
      alphaJson: normalizeToAlphaJsonV14({}, raw, {}),
      customer_text: raw,
    });
    const baselineFindings = baseline.alphaJson.validation.readiness_safety.enforced_findings;
    assert.ok(baselineFindings.length >= 2);
    assert.equal(baseline.can_generate_pdf, false);

    const decisions = baselineFindings.map((finding, index) => ({
      decisionId: `staging-review-${index}`,
      findingId: finding.finding_id,
      field: finding.field,
      action: "entered_new_value",
      value: 1800,
      reasonCode: "app_wrong",
    }));
    const reviewed = validateAlphaJsonRoutePayload({
      alphaJson: normalizeToAlphaJsonV14({}, raw, {}),
      customer_text: raw,
      decisionLog: decisions,
    });

    assert.equal(reviewed.alphaJson.validation.readiness_decision_errors.length, 0);
    assert.equal(reviewed.can_generate_pdf, true);
    assert.deepEqual(
      reviewed.alphaJson.validation.readiness_override_status.cleared_finding_ids.sort(),
      baselineFindings
        .map((finding) => finding.finding_id)
        .filter((findingId) => reviewed.alphaJson.validation.readiness_safety.enforced_findings
          .some((finding) => finding.finding_id === findingId))
        .sort(),
    );
    assert.deepEqual(
      reviewed.alphaJson.validation.readiness_override_status.decision_ids.sort(),
      decisions.map((decision) => decision.decisionId).sort(),
    );
    assert.deepEqual(reviewed.alphaJson.validation.readiness_override_status.remaining_finding_ids, []);
    assert.deepEqual(reviewed.alphaJson.validation.readiness_safety_blocking_errors, []);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_READINESS_SAFETY_BLOCKING;
    else process.env.ENABLE_READINESS_SAFETY_BLOCKING = previous;
  }
});

test("only the matching finding is cleared and unrelated errors remain", () => {
  const alphaJson = phoneAlphaJson();
  const phone = phoneFinding();
  const price = {
    finding_id: "finding-price-conflict",
    field: "service_options.prices",
    option_id: "Option A",
    enforceable: true,
    evidence: { amount: 1800, option_label: "Option A" },
  };
  const decision = createReadinessDecision({
    findingId: phone.finding_id,
    field: "customer.phone",
    action: "keep_original",
    value: "317-555-0100",
    reasonCode: "formatting",
  });
  const phoneError = `Readiness check [${phone.finding_id}]: phone conflict`;
  const priceError = `Readiness check [${price.finding_id}]: price conflict`;
  const status = readinessOverrideStatus({
    readiness_safety: { enforced_findings: [phone, price] },
    readiness_safety_blocking_errors: [phoneError, priceError],
    blocking_errors: [phoneError, priceError, "Option A is missing a clear price."],
  }, { readinessDecisions: [decision] }, alphaJson);

  assert.deepEqual(status.clearedFindingIds, [phone.finding_id]);
  assert.ok(status.remainingReadinessFindings.some((finding) => finding.finding_id === price.finding_id));
  assert.ok(status.remainingBlockingErrors.includes(priceError));
  assert.ok(status.remainingBlockingErrors.includes("Option A is missing a clear price."));
  assert.equal(status.remainingBlockingErrors.includes(phoneError), false);
  assert.equal(status.canProceed, false);
});

test("targetless diagnostics stay shadow-only and policy cohorts are frozen", () => {
  const shadow = evaluateReadinessSafety({
    alphaJson: {},
    sourceFinalCoverage: {
      results: [{
        fact: "work_actions",
        status: "missing",
        source_value: "haul debris",
        missing_source_values: ["haul debris"],
        message: "Source work action was omitted.",
      }],
    },
  });
  assert.equal(shadow.enforced_findings.length, 0);
  assert.ok(shadow.shadow_findings.length >= 1);
  assert.ok(shadow.shadow_findings.every((finding) => finding.enforceable === false));

  assert.equal(canonicalReadinessField("phone"), "customer.phone");
  assert.equal(canonicalReadinessField("price"), "");

  const policy = JSON.parse(readFileSync("config/readiness-safety-release-policy.json", "utf8"));
  assert.equal(policy.thresholds.false_ready_catch_rate.minimum_caught, 12);
  assert.equal(policy.thresholds.unresolved_conflict_recall.minimum_caught, 10);
  assert.equal(policy.thresholds.full_600_false_block_rate.denominator, 600);
  assert.equal(policy.regression_cohort.false_ready_case_ids.length, 18);
  assert.equal(policy.regression_cohort.unresolved_conflict_case_ids.length, 20);
  assert.equal(policy.regression_cohort.frozen_hard_block_case_ids.length, 16);
  assert.equal(policy.false_block_denominator_cohorts.length, 4);
  assert.deepEqual(
    policy.false_block_denominator_cohorts.map((cohort) => cohort.count),
    [150, 150, 150, 150],
  );
});

test("release regression mode surfaces unresolved final price structure as a readiness finding", () => {
  const safety = evaluateReadinessSafety({
    alphaJson: {
      raw_input: { customer_text: "Option A remove oak $900. Option B cleanup $300." },
    },
    options: [
      { label: "Option A", price: { amount: 900 } },
      { label: "Option B", price: { amount: 300 } },
    ],
    structuralValidation: {
      structural_errors: [{
        code: "DEPENDENT_ADDON_STANDALONE",
        message: "A dependent add-on is displayed as a standalone customer choice.",
        evidence_ids: ["add_on_price_1_price_2"],
      }],
    },
  });

  const finding = safety.findings.find((item) => item.invariant_code === "HIGH_CONFIDENCE_PRICE_UNRESOLVED");
  assert.ok(finding);
  assert.equal(finding.field, "service_options.prices");
  assert.deepEqual(finding.candidate_ids, ["add_on_price_1_price_2"]);
});
