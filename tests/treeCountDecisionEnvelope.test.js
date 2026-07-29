import test from "node:test";
import assert from "node:assert/strict";
import { validateDecisionEnvelope } from "../lib/decisionEnvelope.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import {
  buildTreeCountDecisionEnvelope,
  collectRawTreeCountClaimQuotes,
} from "../lib/treeCountDecisionEnvelope.js";

const CORRECTION_NOTES = [
  "Remove two oaks by the garage.",
  "Actually, only remove the rear oak.",
  "Quote $1,800 without stump grinding or $2,200 with stump grinding.",
].join("\n");

test("collectRawTreeCountClaimQuotes preserves count and correction claims", () => {
  const claims = collectRawTreeCountClaimQuotes(CORRECTION_NOTES);
  assert.ok(claims.length >= 2);
  assert.ok(claims.some((claim) => /two oaks/i.test(claim.quote)));
  assert.ok(claims.some((claim) => /only remove the rear oak/i.test(claim.quote)));
  assert.ok(claims.some((claim) => claim.value === "1 tree"));
});

test("tree count envelope keeps current winner while preserving competing claims", () => {
  const alphaJson = normalizeToAlphaJsonV14({}, CORRECTION_NOTES, {});
  assert.equal(alphaJson.job.tree_details.tree_count, "2 trees");

  const envelope = alphaJson.normalization.decisions.tree_count;
  assert.ok(envelope);
  assert.equal(validateDecisionEnvelope(envelope).ok, true, validateDecisionEnvelope(envelope).errors.join("; "));
  assert.equal(envelope.field, "job.tree_details.tree_count");
  assert.ok(envelope.candidates.length >= 2);

  const selected = envelope.candidates.find((candidate) => candidate.id === envelope.resolution.selectedCandidateId);
  assert.equal(selected?.value, "2 trees");
  assert.ok(envelope.candidates.some((candidate) =>
    candidate.status !== "selected" &&
    (/rear oak/i.test(candidate.evidence?.[0]?.quote || "") || candidate.value === "1 tree"),
  ));
});

test("tree count override is marked as reviewer resolution", () => {
  const envelope = buildTreeCountDecisionEnvelope({
    selectedValue: "1 tree",
    rawInput: "Remove two oaks. Actually only remove the rear oak.",
    treeCountOverride: "1 tree",
    rawExtracted: "2 trees",
  });
  assert.equal(envelope.resolution.resolvedBy, "reviewer");
  assert.equal(envelope.resolution.status, "selected");
  assert.equal(
    envelope.candidates.find((candidate) => candidate.status === "selected")?.value,
    "1 tree",
  );
});
