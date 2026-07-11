import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const MANIFEST_PATH = "reports/human-review-34-readiness-reconciliation-manifest.jsonl";

function manifestRecords() {
  return fs.readFileSync(MANIFEST_PATH, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test("human-review manifest preserves authoritative 34 plus obs_0730 extra regression", () => {
  const records = manifestRecords();
  const authoritative = records.filter((record) => record.cohort_membership === "authoritative_34");
  const extra = records.filter((record) => record.extra_regression);

  assert.equal(authoritative.length, 34);
  assert.equal(authoritative[0].observation_id, "obs_0724");
  assert.equal(extra.length, 1);
  assert.equal(extra[0].observation_id, "obs_0730");
  assert.equal(authoritative.some((record) => record.observation_id === "obs_0730"), false);
  assert.equal(extra[0].cohort_membership, "extra_regression");
});

test("human-review manifest is privacy-safe and has structured expected options", () => {
  const manifestText = fs.readFileSync(MANIFEST_PATH, "utf8");
  const records = manifestRecords();

  assert.doesNotMatch(manifestText, /"raw_text"\s*:/);
  assert.doesNotMatch(manifestText, /(?:phone_primary|phone_display|customer_name|email|cell)\b/i);
  assert.doesNotMatch(manifestText, /@(?:gmail|yahoo|icloud|aol|hotmail|outlook|sbcglobal|att|comcast)\b/i);
  for (const record of records) {
    assert.match(record.raw_text_sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.expected_final_options.length, 2);
    for (const option of record.expected_final_options) {
      assert.equal(option.currency, "USD");
      assert.equal(Number.isInteger(option.amount_cents), true);
      assert.ok(option.structured_scope_facts.service_kind);
      assert.ok(option.service_role);
      assert.ok(option.price_relationship);
      assert.ok(option.selectability);
    }
  }
});

test("human-review manifest verifier passes against current source replay", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/generate-human-review-readiness-manifest.js", "--verify-existing"],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output);

  assert.equal(result.ok, true);
  assert.equal(result.authoritative_count, 34);
  assert.equal(result.extra_regression_count, 1);
  assert.equal(result.authoritative_position_1, "obs_0724");
  assert.equal(result.extra_regression_id, "obs_0730");
});
