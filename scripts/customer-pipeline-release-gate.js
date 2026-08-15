#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const POLICY_PATH = "config/customer-pipeline-release-policy.json";
const REPORT_PATH = "reports/customer-pipeline-release-gate-report.json";

function parseArgs(argv) {
  const targetIndex = argv.indexOf("--target");
  const target = targetIndex >= 0 ? asString(argv[targetIndex + 1]).toLowerCase() : "resolution";
  if (!["resolution", "assembler"].includes(target)) {
    throw new Error("--target must be resolution or assembler");
  }
  return {
    check: argv.includes("--check"),
    target,
  };
}

function assemblerHeldOutFailures(policy) {
  const configured = policy.assembler_heldout_labels || {};
  const path = asString(configured.path);
  if (!path || !existsSync(resolve(path))) {
    return [`independently reviewed assembler labels are missing: ${path || "path not configured"}`];
  }
  const manifest = readJson(path);
  const failures = [];
  const cases = asArray(manifest.cases);
  if (manifest.status !== "frozen") failures.push("assembler held-out labels are not frozen");
  if (cases.length < Number(configured.minimum_cases || 0)) failures.push("assembler held-out label count is below policy minimum");
  if (new Set(cases.map(caseId)).size !== cases.length || cases.some((row) => !caseId(row))) {
    failures.push("assembler held-out labels have missing or duplicate case IDs");
  }
  for (const row of cases) {
    const reviews = asArray(row.reviews);
    const reviewerIds = new Set(reviews.map((review) => asString(review.reviewer_id)).filter(Boolean));
    if (reviewerIds.size < Number(configured.required_reviewers || 2)) {
      failures.push(`${caseId(row)} lacks independent Reviewer A and Reviewer B labels`);
    }
    if (configured.require_adjudication && !row.adjudication?.reviewer_id) {
      failures.push(`${caseId(row)} lacks adjudication`);
    }
  }
  if (configured.require_frozen_checksum && !/^[a-f0-9]{64}$/i.test(asString(manifest.frozen_sha256))) {
    failures.push("assembler held-out labels lack a frozen SHA-256 checksum");
  }
  return failures;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return value == null ? "" : String(value).trim();
}

function caseId(row) {
  return asString(row?.case_id || row?.caseId || row?.id);
}

function lockedBaselineFailures(policy) {
  const failures = [];
  const configured = policy.locked_baseline || {};
  const source = readJson(configured.path);
  const rows = Array.isArray(source) ? source : asArray(source?.cases);
  const ids = rows.map(caseId);
  const expectedIds = readJson(configured.case_ids_path);
  const expectedIdList = Array.isArray(expectedIds) ? expectedIds.map(asString) : [];
  const actualIdSet = new Set(ids);
  const expectedIdSet = new Set(expectedIdList);
  if (rows.length !== configured.count) {
    failures.push(`locked baseline count is ${rows.length}, expected ${configured.count}`);
  }
  if (ids.some((id) => !id)) failures.push("locked baseline contains a missing case ID");
  if (new Set(ids).size !== ids.length) failures.push("locked baseline contains duplicate case IDs");
  if (expectedIdList.length !== configured.count) {
    failures.push(`locked case-ID manifest count is ${expectedIdList.length}, expected ${configured.count}`);
  }
  if (new Set(expectedIdList).size !== expectedIdList.length) {
    failures.push("locked case-ID manifest contains duplicate case IDs");
  }
  const missingIds = expectedIdList.filter((id) => !actualIdSet.has(id));
  const addedIds = ids.filter((id) => !expectedIdSet.has(id));
  if (missingIds.length || addedIds.length) {
    failures.push(`locked baseline case IDs changed; missing: ${missingIds.join(", ") || "none"}; added: ${addedIds.join(", ") || "none"}`);
  }
  return failures;
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return {
    passed: result.status === 0,
    exit_code: result.status == null ? 1 : result.status,
    stdout: asString(result.stdout),
    stderr: asString(result.stderr),
  };
}

function preflightStage() {
  const stage = asString(process.env.TSWEB_DEPLOYMENT_STAGE).toLowerCase();
  return stage === "production" || stage === "staging" ? stage : "local";
}

function assemblerGateFailures(policy, report) {
  const failures = [];
  if (report?.all_gates_pass !== true) failures.push("assembler report does not declare all gates passed");
  if (/INSUFFICIENT|BLOCKED/i.test(asString(report?.blocked_status))) {
    failures.push(`assembler held-out status is blocked: ${report.blocked_status}`);
  }
  const gates = new Map(asArray(report?.gates).map((gate) => [asString(gate?.name), gate]));
  for (const name of asArray(policy.required_assembler_gates)) {
    const gate = gates.get(name);
    if (!gate) failures.push(`required assembler gate is missing: ${name}`);
    else if (gate.pass !== true) failures.push(`required assembler gate failed: ${name}`);
  }
  const violations = report?.pdf_ready_violation_counts || {};
  for (const [name, value] of Object.entries(violations)) {
    if (Number(value) !== 0) failures.push(`PDF-ready violation count is non-zero for ${name}`);
  }
  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = readJson(POLICY_PATH);
  const failures = lockedBaselineFailures(policy);
  const assemblerReport = args.target === "assembler" ? readJson(policy.reports.assembler) : null;
  const assemblerFailures = args.target === "assembler"
    ? [...assemblerGateFailures(policy, assemblerReport), ...assemblerHeldOutFailures(policy)]
    : [];
  failures.push(...assemblerFailures);

  const ratchet = runNode(["scripts/ratchet-gate.js", "--baseline", policy.reports.ratchet]);
  if (!ratchet.passed) failures.push("seven-metric ratchet gate failed");

  const readiness = runNode(["scripts/readiness-safety-release-gate.js", "--check"]);
  if (!readiness.passed) failures.push("readiness-safety release gate failed");

  const stress = runNode(["scripts/stress-release-gate.js", "--check"]);
  if (!stress.passed) failures.push("seven-cohort stress regression gate failed");

  const preflight = runNode([
    "scripts/production-readiness-preflight.js",
    "--stage",
    preflightStage(),
    "--check",
  ]);
  if (!preflight.passed) failures.push("production readiness preflight failed");

  const report = {
    report_version: "customer-pipeline-release-gate-report-v2",
    generated_at: new Date().toISOString(),
    policy_version: policy.policy_version,
    target: args.target,
    status: failures.length ? "FAIL" : "PASS",
    customer_rollout_default: policy.customer_rollout_default,
    locked_baseline: policy.locked_baseline,
    historical_suite: policy.historical_suite,
    assembler: {
      evaluated: args.target === "assembler",
      all_gates_pass: assemblerReport?.all_gates_pass === true,
      blocked_status: assemblerReport?.blocked_status || "",
      failures: assemblerFailures,
    },
    ratchet,
    readiness,
    stress,
    preflight,
    failures: [...new Set(failures)],
  };

  if (!args.check) writeFileSync(resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Customer pipeline ${args.target} release gate: ${report.status}`);
  console.log(`  Locked baseline: ${policy.locked_baseline.count} case IDs`);
  console.log(`  Report: ${args.check ? `${REPORT_PATH} (not written in --check mode)` : REPORT_PATH}`);
  for (const failure of report.failures) console.error(`  FAIL: ${failure}`);
  if (report.failures.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Customer pipeline release gate failed closed: ${error?.stack || error}`);
  process.exitCode = 1;
}
