#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const POLICY_PATH = "config/readiness-safety-release-policy.json";
const REPORT_PATH = "reports/readiness-safety-release-gate-report.json";

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readRows(path) {
  const parsed = readJson(path);
  if (Array.isArray(parsed)) return parsed;
  if (!Array.isArray(parsed?.cases)) return [];
  const drafts = new Map(asArray(parsed.frozen_drafts).map((draft) => [
    draft.case_id,
    draft.raw_draft,
  ]));
  return parsed.cases.map((row) => ({
    ...row,
    raw_draft: row.raw_draft || drafts.get(row.case_id || row.id) || null,
  }));
}

function rowId(row) {
  return asString(row?.case_id || row?.caseId || row?.id);
}

function customerText(row) {
  return [
    row?.raw_note,
    row?.raw_customer_input,
    row?.raw,
    row?.input,
    row?.text,
    row?.customer_text,
  ].map(asString).find(Boolean) || "";
}

function expectedValue(row, key) {
  return row?.expected?.[key];
}

function withBlockingFlag(value, callback) {
  const previous = process.env.ENABLE_READINESS_SAFETY_BLOCKING;
  process.env.ENABLE_READINESS_SAFETY_BLOCKING = value ? "true" : "false";
  try {
    return callback();
  } finally {
    if (previous == null) delete process.env.ENABLE_READINESS_SAFETY_BLOCKING;
    else process.env.ENABLE_READINESS_SAFETY_BLOCKING = previous;
  }
}

function validateRow(row, { includeStructuralReadiness = false } = {}) {
  const rawText = customerText(row);
  const intake = row?.intake || row?.structured_input || {};
  const contact = normalizeContactFields({ rawText, intake });
  let alphaJson = normalizeToAlphaJsonV14({}, rawText, intake);
  alphaJson = applyContactNormalizationOverlay(alphaJson, contact);
  alphaJson = reconcileSidecarPrices(
    alphaJson,
    buildOptionPriceCandidateView(rawText),
  );
  alphaJson = attachPipelineDecisionEnvelopes(alphaJson, contact, rawText);
  return validateAlphaJson(alphaJson, { includeStructuralReadiness });
}

function runCase(row, options = {}) {
  const off = withBlockingFlag(false, () => validateRow(row, options));
  const on = withBlockingFlag(true, () => validateRow(row, options));
  return {
    id: rowId(row),
    expected: row.expected || {},
    off,
    on,
    offReady: off.can_generate_pdf === true,
    onReady: on.can_generate_pdf === true,
    findings: asArray(on.readiness_safety?.findings),
  };
}

function findingInvariantFailures(results) {
  const failures = [];
  for (const result of results) {
    const offFindings = asArray(result.off?.readiness_safety?.findings);
    const onFindings = asArray(result.on?.readiness_safety?.findings);
    const offIds = offFindings.map((finding) => finding?.finding_id).filter(Boolean).sort();
    const onIds = onFindings.map((finding) => finding?.finding_id).filter(Boolean).sort();
    for (const finding of [...offFindings, ...onFindings]) {
      if (!asString(finding?.finding_id)) {
        failures.push(result.id + ": finding_id is missing");
      }
      if (finding?.enforceable !== false && !asString(finding?.field)) {
        failures.push(result.id + ": enforceable finding field is missing");
      }
      if (!finding?.evidence || typeof finding.evidence !== "object") {
        failures.push(result.id + ": finding evidence is missing");
      }
    }
    if (JSON.stringify(offIds) !== JSON.stringify(onIds)) {
      failures.push(result.id + ": flag toggle changed finding identity");
    }
  }
  return failures;
}

function uniqueIds(rows, label) {
  const ids = rows.map(rowId);
  const failures = [];
  if (ids.some((id) => !id)) failures.push(label + ": case ID is missing");
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) failures.push(label + ": duplicate case IDs: " + [...new Set(duplicates)].join(", "));
  return failures;
}

function validatePolicy(policy, regressionRows, cohortRows, baseline) {
  const failures = [];
  const thresholds = policy?.thresholds || {};
  const regression = policy?.regression_cohort || {};
  const falseReadyIds = asArray(regression.false_ready_case_ids);
  const unresolvedIds = asArray(regression.unresolved_conflict_case_ids);
  const cleanIds = asArray(regression.clean_case_ids);
  const hardIds = asArray(regression.frozen_hard_block_case_ids);
  const regressionIds = new Set(regressionRows.map(rowId));

  if (regressionRows.length !== regression.count) {
    failures.push("regression cohort count does not match policy");
  }
  failures.push(...uniqueIds(regressionRows, "regression cohort"));
  for (const [label, ids] of [
    ["false-ready", falseReadyIds],
    ["unresolved-conflict", unresolvedIds],
    ["clean", cleanIds],
    ["frozen hard-block", hardIds],
  ]) {
    for (const id of ids) {
      if (!regressionIds.has(id)) failures.push(label + " case is missing from regression fixture: " + id);
    }
  }
  if (new Set(falseReadyIds).size !== falseReadyIds.length ||
      new Set(unresolvedIds).size !== unresolvedIds.length ||
      new Set(cleanIds).size !== cleanIds.length ||
      new Set(hardIds).size !== hardIds.length) {
    failures.push("policy case ID lists must be unique");
  }
  if (falseReadyIds.some((id) => cleanIds.includes(id))) {
    failures.push("false-ready and clean case lists overlap");
  }
  for (const row of regressionRows) {
    if (typeof expectedValue(row, regression.expected_review_key) !== "boolean") {
      failures.push("regression expected label missing for " + rowId(row));
    }
  }

  const baselineRows = asArray(baseline?.per_case);
  if (baselineRows.length !== regression.count) {
    failures.push("baseline readiness report is missing the complete regression cohort");
  }
  const baselineById = new Map(baselineRows.map((row) => [row.case_id, row]));
  for (const id of falseReadyIds) {
    const row = baselineById.get(id);
    if (!row || row.factually_correct !== false || row.can_generate_pdf !== true) {
      failures.push("false-ready baseline label is missing or changed: " + id);
    }
  }
  for (const id of cleanIds) {
    const row = baselineById.get(id);
    if (!row || row.factually_correct !== true || row.can_generate_pdf !== true) {
      failures.push("clean baseline label is missing or changed: " + id);
    }
  }

  const cohorts = asArray(policy?.false_block_denominator_cohorts);
  if (cohorts.length !== 4) failures.push("false-block denominator must contain exactly four cohorts");
  const allCohortIds = [];
  for (const cohort of cohorts) {
    const rows = cohortRows.get(cohort.name) || [];
    if (rows.length !== cohort.count) {
      failures.push(cohort.name + " cohort count does not match policy");
    }
    failures.push(...uniqueIds(rows, cohort.name + " cohort"));
    for (const row of rows) {
      if (typeof expectedValue(row, cohort.expected_key) !== "boolean") {
        failures.push(cohort.name + " expected label missing for " + rowId(row));
      }
      allCohortIds.push(rowId(row));
    }
  }
  if (allCohortIds.length !== 600) failures.push("false-block denominator is not exactly 600 cases");
  if (new Set(allCohortIds).size !== allCohortIds.length) {
    failures.push("false-block denominator contains duplicate case IDs");
  }

  if (thresholds.false_ready_catch_rate?.denominator !== falseReadyIds.length ||
      thresholds.false_ready_catch_rate?.minimum_caught !== 12) {
    failures.push("false-ready threshold does not match the frozen 18-case cohort");
  }
  if (thresholds.unresolved_conflict_recall?.denominator !== unresolvedIds.length ||
      thresholds.unresolved_conflict_recall?.minimum_caught !== 10) {
    failures.push("unresolved-conflict threshold does not match the frozen 20-case cohort");
  }
  if (thresholds.full_600_false_block_rate?.denominator !== 600) {
    failures.push("false-block threshold denominator must be 600");
  }
  return failures;
}

function collectInvariantCounts(results) {
  const counts = {};
  const caseIds = {};
  for (const result of results) {
    for (const finding of result.findings) {
      const code = asString(finding?.invariant_code) || "UNKNOWN";
      counts[code] = (counts[code] || 0) + 1;
      caseIds[code] ||= [];
      if (!caseIds[code].includes(result.id)) caseIds[code].push(result.id);
    }
  }
  return { counts, case_ids: caseIds };
}

function evaluateRegression(policy, rows, results) {
  const regression = policy.regression_cohort;
  const falseReadyIds = asArray(regression.false_ready_case_ids);
  const unresolvedIds = asArray(regression.unresolved_conflict_case_ids);
  const cleanIds = asArray(regression.clean_case_ids);
  const byId = new Map(results.map((result) => [result.id, result]));
  const falseReadyCaught = falseReadyIds.filter((id) => byId.get(id)?.findings.length);
  const unresolvedCaught = unresolvedIds.filter((id) => byId.get(id)?.findings.length);
  const cleanQuiet = cleanIds.filter((id) => !byId.get(id)?.findings.length);
  const cleanNewBlocks = cleanIds.filter((id) => {
    const result = byId.get(id);
    return result?.offReady && !result?.onReady;
  });
  const allNewBlocks = results
    .filter((result) => result.offReady && !result.onReady)
    .map((result) => result.id);
  const hardIds = asArray(regression.frozen_hard_block_case_ids);
  const hardStillBlocked = hardIds.filter((id) => !byId.get(id)?.onReady);
  const missingHardBlocks = hardIds.filter((id) => byId.get(id)?.onReady);

  return {
    total: rows.length,
    false_ready: {
      caught: falseReadyCaught.length,
      total: falseReadyIds.length,
      rate: falseReadyCaught.length / falseReadyIds.length,
      caught_case_ids: falseReadyCaught,
      missed_case_ids: falseReadyIds.filter((id) => !falseReadyCaught.includes(id)),
    },
    unresolved_conflict_recall: {
      caught: unresolvedCaught.length,
      total: unresolvedIds.length,
      rate: unresolvedCaught.length / unresolvedIds.length,
      caught_case_ids: unresolvedCaught,
      missed_case_ids: unresolvedIds.filter((id) => !unresolvedCaught.includes(id)),
    },
    clean_case_quiet: {
      quiet: cleanQuiet.length,
      total: cleanIds.length,
      rate: cleanQuiet.length / cleanIds.length,
      quiet_case_ids: cleanQuiet,
      noisy_case_ids: cleanIds.filter((id) => !cleanQuiet.includes(id)),
    },
    newly_blocked_case_ids: allNewBlocks,
    newly_blocked_clean_case_ids: cleanNewBlocks,
    frozen_hard_block_case_ids: hardIds,
    hard_blocks_present: hardStillBlocked,
    missing_hard_blocks: missingHardBlocks,
  };
}

function evaluateFalseBlockCohorts(policy, cohortRows, cohortResults) {
  const byCohort = [];
  const allNewBlocks = [];
  for (const cohort of asArray(policy.false_block_denominator_cohorts)) {
    const rows = cohortRows.get(cohort.name) || [];
    const results = cohortResults.get(cohort.name) || [];
    const byId = new Map(results.map((result) => [result.id, result]));
    const newBlocks = rows
      .filter((row) => expectedValue(row, cohort.expected_key) === true)
      .map(rowId)
      .filter((id) => byId.get(id)?.offReady && !byId.get(id)?.onReady);
    allNewBlocks.push(...newBlocks);
    byCohort.push({
      name: cohort.name,
      total: rows.length,
      expected_ready: rows.filter((row) => expectedValue(row, cohort.expected_key) === true).length,
      new_false_blocks: newBlocks.length,
      new_false_block_case_ids: newBlocks,
    });
  }
  const denominator = byCohort.reduce((total, cohort) => total + cohort.total, 0);
  return {
    denominator,
    new_false_blocks: allNewBlocks.length,
    false_block_rate: allNewBlocks.length / denominator,
    new_false_block_case_ids: allNewBlocks,
    cohorts: byCohort,
  };
}

function runRatchetGate(policy) {
  const command = spawnSync(
    process.execPath,
    ["scripts/ratchet-gate.js", "--baseline", policy.ratchet.baseline],
    { encoding: "utf8" },
  );
  return {
    exit_code: command.status == null ? 1 : command.status,
    passed: command.status === 0,
    stdout: asString(command.stdout).trim(),
    stderr: asString(command.stderr).trim(),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = readJson(POLICY_PATH);
  const regressionRows = readRows(policy.regression_cohort.path);
  const cohortRows = new Map(
    asArray(policy.false_block_denominator_cohorts).map((cohort) => [
      cohort.name,
      readRows(cohort.path),
    ]),
  );
  const baseline = readJson(policy.regression_cohort.baseline_report);
  const failures = validatePolicy(policy, regressionRows, cohortRows, baseline);

  const regressionResults = regressionRows.map((row) => runCase(row, {
    includeStructuralReadiness: true,
  }));
  const cohortResults = new Map();
  for (const cohort of asArray(policy.false_block_denominator_cohorts)) {
    cohortResults.set(cohort.name, (cohortRows.get(cohort.name) || []).map((row) => runCase(row)));
  }
  const allResults = [
    ...regressionResults,
    ...[...cohortResults.values()].flat(),
  ];
  failures.push(...findingInvariantFailures(allResults));

  const regression = evaluateRegression(policy, regressionRows, regressionResults);
  const falseBlocks = evaluateFalseBlockCohorts(policy, cohortRows, cohortResults);
  const invariantReport = {
    regression: collectInvariantCounts(regressionResults),
    false_block_denominator: collectInvariantCounts(
      [...cohortResults.values()].flat(),
    ),
  };
  const ratchet = runRatchetGate(policy);
  if (!ratchet.passed) failures.push("existing ratchet gate failed");

  const thresholds = policy.thresholds;
  if (regression.false_ready.rate < thresholds.false_ready_catch_rate.minimum ||
      regression.false_ready.caught < thresholds.false_ready_catch_rate.minimum_caught) {
    failures.push("false-ready catch-rate threshold failed");
  }
  if (regression.unresolved_conflict_recall.rate < thresholds.unresolved_conflict_recall.minimum ||
      regression.unresolved_conflict_recall.caught < thresholds.unresolved_conflict_recall.minimum_caught) {
    failures.push("unresolved-conflict recall threshold failed");
  }
  if (regression.clean_case_quiet.rate < thresholds.clean_case_quiet_rate.minimum) {
    failures.push("clean-case quiet-rate threshold failed");
  }
  if (falseBlocks.denominator !== thresholds.full_600_false_block_rate.denominator ||
      falseBlocks.new_false_blocks > thresholds.full_600_false_block_rate.maximum_new_blocks ||
      falseBlocks.false_block_rate > thresholds.full_600_false_block_rate.maximum) {
    failures.push("600-case false-block threshold failed");
  }
  if (regression.newly_blocked_clean_case_ids.length > thresholds.regression_new_false_blocks.maximum) {
    failures.push("60-case regression introduced new clean false blocks");
  }
  if (regression.missing_hard_blocks.length) {
    failures.push("frozen hard-block case became ready: " + regression.missing_hard_blocks.join(", "));
  }

  const report = {
    report_version: "readiness-safety-release-gate-report-v1",
    generated_at: new Date().toISOString(),
    policy_version: policy.policy_version,
    safety_evaluator_version: policy.safety_evaluator_version,
    blocking_flag_default: process.env.ENABLE_READINESS_SAFETY_BLOCKING || "unset",
    status: failures.length ? "FAIL" : "PASS",
    thresholds,
    regression_cohort: regression,
    false_block_denominator: falseBlocks,
    invariant_counts_and_case_ids: invariantReport,
    ratchet,
    failures: [...new Set(failures)],
  };
  if (!args.check) {
    writeFileSync(resolve(REPORT_PATH), JSON.stringify(report, null, 2) + "\n");
  }

  console.log("Readiness safety release gate: " + report.status);
  console.log("  False-ready catch: " + regression.false_ready.caught + "/" + regression.false_ready.total);
  console.log("  Unresolved recall: " + regression.unresolved_conflict_recall.caught + "/" + regression.unresolved_conflict_recall.total);
  console.log("  Clean quiet: " + regression.clean_case_quiet.quiet + "/" + regression.clean_case_quiet.total);
  console.log("  600-case new false blocks: " + falseBlocks.new_false_blocks + "/" + falseBlocks.denominator);
  console.log("  Report: " + (args.check ? `${REPORT_PATH} (not written in --check mode)` : REPORT_PATH));
  if (failures.length) {
    for (const failure of [...new Set(failures)]) console.error("  FAIL: " + failure);
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error("Readiness safety release gate failed closed: " + (error?.stack || error));
  process.exitCode = 1;
}
