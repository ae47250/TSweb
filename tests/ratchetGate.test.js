import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runGate(args, cwd) {
  try {
    const stdout = execFileSync("node", [join(process.cwd(), "scripts/ratchet-gate.js"), ...args], {
      cwd,
      encoding: "utf8",
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: error.stdout?.toString() || "", stderr: error.stderr?.toString() || "" };
  }
}

function writeFixture(dir, accuracyRate, incorrectButReadyCaseIds) {
  writeFileSync(
    join(dir, "accuracy.json"),
    JSON.stringify({ accuracy: { exact_option_count: { rate: accuracyRate } } }),
  );
  writeFileSync(
    join(dir, "readiness.json"),
    JSON.stringify({
      metrics: {
        incorrect_but_ready: { count: incorrectButReadyCaseIds.length, case_ids: incorrectButReadyCaseIds },
      },
    }),
  );
}

function writeBaseline(dir, { accuracyFloor = 0.7, incorrectButReadyCeiling = 2, knownCaseIds = ["case-1", "case-2"] } = {}) {
  writeFileSync(
    join(dir, "baseline.json"),
    JSON.stringify({
      source_reports: { accuracy: "accuracy.json", readiness: "readiness.json" },
      metrics: {
        exact_option_count_rate: {
          category: "ratchet",
          direction: "higher_is_better",
          path: ["accuracy", "accuracy", "exact_option_count", "rate"],
          floor: accuracyFloor,
        },
        incorrect_but_ready_count: {
          category: "safety",
          direction: "lower_is_better",
          path: ["readiness", "metrics", "incorrect_but_ready", "count"],
          ceiling: incorrectButReadyCeiling,
          case_id_path: ["readiness", "metrics", "incorrect_but_ready", "case_ids"],
          known_case_ids: knownCaseIds,
        },
      },
    }),
  );
}

test("ratchet gate passes when metrics meet baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-"));
  try {
    writeFixture(dir, 0.75, ["case-1"]);
    writeBaseline(dir);
    const result = runGate(["--baseline", "baseline.json"], dir);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /All ratchet and safety gates passed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ratchet gate fails on a rate regression below the floor", () => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-"));
  try {
    writeFixture(dir, 0.5, ["case-1"]);
    writeBaseline(dir);
    const result = runGate(["--baseline", "baseline.json"], dir);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /gate\(s\) failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ratchet gate fails as a safety violation when a new incorrect-but-ready case appears, even if count does not increase", () => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-"));
  try {
    // Same count (1) as would be allowed, but the case id is new/unknown.
    writeFixture(dir, 0.75, ["case-99"]);
    writeBaseline(dir, { incorrectButReadyCeiling: 2, knownCaseIds: ["case-1", "case-2"] });
    const result = runGate(["--baseline", "baseline.json"], dir);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /SAFETY FAILURE: new incorrect-but-ready case\(s\): case-99/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ratchet gate --update tightens the baseline on improvement", () => {
  const dir = mkdtempSync(join(tmpdir(), "ratchet-"));
  try {
    writeFixture(dir, 0.9, []);
    writeBaseline(dir, { accuracyFloor: 0.7, incorrectButReadyCeiling: 2 });
    const result = runGate(["--baseline", "baseline.json", "--update"], dir);
    assert.equal(result.code, 0);
    const updated = JSON.parse(readFileSync(join(dir, "baseline.json"), "utf8"));
    assert.equal(updated.metrics.exact_option_count_rate.floor, 0.9);
    assert.equal(updated.metrics.incorrect_but_ready_count.ceiling, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
