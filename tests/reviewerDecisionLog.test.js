import test from "node:test";
import assert from "node:assert/strict";
import {
  REVIEWER_DECISION_ACTIONS,
  createReviewerDecisionAction,
  normalizeReviewerDecisionLog,
} from "../lib/reviewerDecisionLog.js";

test("createReviewerDecisionAction builds selected_candidate entries", () => {
  const entry = createReviewerDecisionAction({
    field: "service_options.prices",
    action: "selected_candidate",
    candidateId: "price-1800",
    value: "$1,800",
    note: "Reviewer selected candidate price-1800",
  });
  assert.equal(entry.field, "service_options.prices");
  assert.equal(entry.action, "selected_candidate");
  assert.equal(entry.candidateId, "price-1800");
  assert.equal(entry.value, "$1,800");
  assert.match(entry.at, /^\d{4}-\d{2}-\d{2}T/);
});

test("createReviewerDecisionAction supports review outcome actions", () => {
  assert.deepEqual(
    REVIEWER_DECISION_ACTIONS,
    [
      "selected_candidate",
      "rejected_candidate",
      "entered_new_value",
      "keep_original",
      "marked_business_change",
    ],
  );

  const rejected = createReviewerDecisionAction({
    field: "job.tree_details.tree_count",
    action: "rejected_candidate",
    candidateId: "scope-tree-2",
    value: "2 trees",
  });
  assert.equal(rejected.action, "rejected_candidate");

  const entered = createReviewerDecisionAction({
    field: "job.tree_details.tree_count",
    action: "entered_new_value",
    value: "Remove rear oak only",
    note: "Reviewer entered a new value",
  });
  assert.equal(entered.action, "entered_new_value");
  assert.equal(entered.value, "Remove rear oak only");

  const kept = createReviewerDecisionAction({
    field: "job.service_address",
    action: "keep_original",
    value: "1256 Mill Street, Madison, Indiana",
  });
  assert.equal(kept.action, "keep_original");
  assert.equal(kept.value, "1256 Mill Street, Madison, Indiana");

  const business = createReviewerDecisionAction({
    field: "job.tree_details.tree_count",
    action: "marked_business_change",
  });
  assert.equal(business.action, "marked_business_change");
  assert.equal(business.candidateId, undefined);
});

test("createReviewerDecisionAction rejects unknown actions", () => {
  assert.throws(
    () => createReviewerDecisionAction({ field: "customer.phone", action: "approve_all" }),
    /Invalid reviewer decision action/,
  );
});

test("normalizeReviewerDecisionLog drops invalid entries", () => {
  const normalized = normalizeReviewerDecisionLog([
    {
      field: "service_options.prices",
      action: "selected_candidate",
      candidateId: "price-1800",
      value: "$1,800",
      at: "2026-07-29T12:00:00.000Z",
    },
    { field: "x", action: "not_real" },
    null,
    { action: "selected_candidate" },
    "bad",
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].candidateId, "price-1800");
});
