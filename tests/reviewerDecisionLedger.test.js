import test from "node:test";
import assert from "node:assert/strict";
import { createDraftAlphaJson } from "../lib/alphaJson.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import {
  REVIEWER_LEDGER_POLICY_VERSION,
  appendReviewerDecision,
  classifyTextEditAction,
  classifyValueEditAction,
  createReviewerDecision,
} from "../lib/reviewerDecisionLedger.js";

test("createReviewerDecision stamps id and timestamp and rejects unknown actions", () => {
  const decision = createReviewerDecision({
    estimateId: "EST-1",
    field: "job.description",
    action: "correct_extraction",
    before: "two",
    after: "one",
    actorId: "business_user",
    extractionVersion: "1.4",
    resolutionPolicyVersion: REVIEWER_LEDGER_POLICY_VERSION,
  });

  assert.equal(typeof decision.id, "string");
  assert.ok(decision.id.length > 0);
  assert.equal(typeof decision.timestamp, "string");
  assert.ok(decision.timestamp.includes("T"));
  assert.equal(decision.action, "correct_extraction");
  assert.equal(decision.estimateId, "EST-1");
  assert.equal(decision.actorId, "business_user");

  assert.throws(
    () => createReviewerDecision({ field: "x", action: "not_a_real_action" }),
    /Invalid reviewer decision action/,
  );
});

test("appendReviewerDecision is append-only and never mutates prior entries", () => {
  const first = createReviewerDecision({
    estimateId: "EST-1",
    field: "customer.phone_display",
    action: "override_missing",
    before: "",
    after: "812-555-0100",
  });
  const second = createReviewerDecision({
    estimateId: "EST-1",
    field: "job.description",
    action: "business_scope_change",
    before: "Remove the oak",
    after: "Remove the oak and grind the stump",
  });

  const base = { document: { number: "EST-1" }, reviewer_decisions: [first] };
  const next = appendReviewerDecision(base, second);

  assert.equal(base.reviewer_decisions.length, 1);
  assert.equal(base.reviewer_decisions[0], first);
  assert.equal(next.reviewer_decisions.length, 2);
  assert.equal(next.reviewer_decisions[0], first);
  assert.equal(next.reviewer_decisions[1], second);
  assert.notEqual(next.reviewer_decisions, base.reviewer_decisions);
});

test("classifyTextEditAction distinguishes scope add, correction, and formatting", () => {
  assert.equal(
    classifyTextEditAction({
      before: "Remove the oak",
      after: "Remove the oak and grind the stump",
    }),
    "business_scope_change",
  );
  assert.equal(
    classifyTextEditAction({ before: "two", after: "one" }),
    "correct_extraction",
  );
  assert.equal(
    classifyTextEditAction({
      before: "Remove the oak.",
      after: "Remove the oak",
    }),
    "formatting_change",
  );
  assert.equal(
    classifyTextEditAction({
      before: "Remove  the oak",
      after: "Remove the oak",
    }),
    "formatting_change",
  );
});

test("classifyValueEditAction handles missing, formatting, and correction", () => {
  assert.equal(
    classifyValueEditAction({ before: "", after: "812-555-0100" }),
    "override_missing",
  );
  assert.equal(
    classifyValueEditAction({
      before: { amount: 1200, display: "$1,200" },
      after: { amount: 1200, display: "$1200" },
    }),
    "formatting_change",
  );
  assert.equal(
    classifyValueEditAction({
      before: { amount: 1200, display: "$1,200" },
      after: { amount: 1500, display: "$1,500" },
    }),
    "correct_extraction",
  );
  assert.equal(
    classifyValueEditAction({
      before: { amount: null, display: "" },
      after: { amount: 900, display: "$900" },
      wasUnclear: true,
    }),
    "override_missing",
  );
});

test("createDraftAlphaJson includes empty reviewer_decisions", () => {
  const draft = createDraftAlphaJson("Remove one oak tree. $900");
  assert.deepEqual(draft.reviewer_decisions, []);
});

test("normalizeToAlphaJsonV14 preserves reviewer_decisions across round trip", () => {
  const decision = createReviewerDecision({
    estimateId: "EST-ROUNDTRIP",
    field: "job.tree_details.tree_count",
    action: "correct_extraction",
    before: "2",
    after: "1",
    extractionVersion: "1.4",
    resolutionPolicyVersion: "tree_scope_policy@1",
  });
  const input = {
    ...createDraftAlphaJson("Remove one oak. Call 812-555-0199. 100 Main St."),
    document: { number: "EST-ROUNDTRIP" },
    reviewer_decisions: [decision],
  };

  const normalized = normalizeToAlphaJsonV14(input, input.raw_input.customer_text, {});
  assert.equal(normalized.reviewer_decisions.length, 1);
  assert.deepEqual(normalized.reviewer_decisions[0], decision);
});
