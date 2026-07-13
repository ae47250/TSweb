#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const DEFAULT_FIXTURE = path.join("tests", "fixtures", "source-final-regression-hoho30.json");
const DEFAULT_REPORT = path.join("reports", "source-final-audit-latest.json");
const DEFAULT_MARKDOWN = path.join("reports", "source-final-audit-latest.md");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function readFixture(filePath) {
  const fixture = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(fixture.cases)) {
    throw new Error(`Fixture must contain a cases array: ${filePath}`);
  }
  return fixture;
}

function validateRaw(raw) {
  return validateAlphaJson(reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, raw),
    buildOptionPriceCandidateView(raw),
  ));
}

function optionSummary(option = {}) {
  const label = option.label || "";
  const title = option.title || "";
  const price = option.price?.display || "";
  const description = option.description || "";
  return [label, title, price, description].filter(Boolean).join(" | ");
}

function coverageFor(validation = {}) {
  return validation.alphaJson?.validation?.source_final_fact_coverage || {};
}

function changedFacts(coverage = {}) {
  return (coverage.blocking_results || []).map((result) => ({
    option: `Option ${result.option_label}`,
    code: result.code,
    fact: result.fact,
    source_value: result.source_value,
    final_value: result.final_value,
    missing_source_values: result.missing_source_values || [],
    status: result.status,
    message: result.message,
  }));
}

function sourceCoverageApplicable(validation = {}) {
  return Boolean(validation.alphaJson?.validation?.source_final_fact_coverage_pdf_blocking_enabled);
}

function blockerCodes(validation = {}) {
  const coverage = coverageFor(validation);
  return [...new Set([
    ...(coverage.blocking_codes || []),
    ...(validation.structural_error_codes || []),
  ])].sort();
}

function expectedRequiresBlock(expectedVerdict = "") {
  return expectedVerdict.startsWith("intended_block")
    || expectedVerdict.startsWith("blocked_with_actionable");
}

function expectedAllowsReady(expectedVerdict = "") {
  return expectedVerdict.startsWith("intended_ready")
    || expectedVerdict.startsWith("ready");
}

function auditCase(testCase) {
  const validation = validateRaw(testCase.raw);
  const coverage = coverageFor(validation);
  const ready = Boolean(validation.can_generate_pdf);
  const codes = blockerCodes(validation);
  const expectedVerdict = testCase.expected_verdict || "ready_needs_human_spot_check";
  return {
    case: testCase.case,
    cohort: testCase.cohort || "",
    raw: testCase.raw,
    ready,
    status: ready ? "pdf-ready" : "blocked",
    expected_verdict: expectedVerdict,
    final_options: (validation.alphaJson?.service_options?.items || []).map(optionSummary),
    blocker_codes: codes,
    source_coverage_applicable: sourceCoverageApplicable(validation),
    missing_or_changed_facts: changedFacts(coverage),
    blocking_errors: validation.blocking_errors || [],
    warnings: validation.warnings || [],
  };
}

function metrics(rows = []) {
  const unsafeReady = rows.filter((row) => row.ready && expectedRequiresBlock(row.expected_verdict));
  const correctButBlocked = rows.filter((row) => !row.ready && expectedAllowsReady(row.expected_verdict));
  const applicable = rows.filter((row) => row.source_coverage_applicable);
  const actionableBlocked = rows.filter((row) => !row.ready && row.blocker_codes.length);
  return {
    total: rows.length,
    ready: rows.filter((row) => row.ready).length,
    blocked: rows.filter((row) => !row.ready).length,
    unsafe_ready_count: unsafeReady.length,
    unsafe_ready_cases: unsafeReady.map((row) => row.case),
    correct_but_blocked_count: correctButBlocked.length,
    correct_but_blocked_cases: correctButBlocked.map((row) => row.case),
    source_coverage_applicable_count: applicable.length,
    source_coverage_applicability_rate: rows.length ? applicable.length / rows.length : 0,
    actionable_blocker_count: actionableBlocked.length,
    actionable_blocker_rate: rows.length ? actionableBlocked.length / rows.length : 0,
  };
}

function factSummary(row) {
  if (!row.missing_or_changed_facts.length) return "none";
  return row.missing_or_changed_facts
    .map((fact) => `${fact.option} ${fact.code} ${fact.fact}: source=${fact.source_value || fact.missing_source_values.join(", ") || "not found"}; final=${fact.final_value || "not found"}`)
    .join("<br>");
}

function markdown(report) {
  const lines = [
    `# ${report.fixture.name} Source-Final Audit`,
    "",
    `- Fixture: ${report.fixture.path}`,
    `- Fixture version: ${report.fixture.version}`,
    `- Total cases: ${report.metrics.total}`,
    `- PDF-ready: ${report.metrics.ready}`,
    `- Blocked: ${report.metrics.blocked}`,
    `- Unsafe-ready cases: ${report.metrics.unsafe_ready_count} (${report.metrics.unsafe_ready_cases.join(", ") || "none"})`,
    `- Correct-but-blocked cases: ${report.metrics.correct_but_blocked_count} (${report.metrics.correct_but_blocked_cases.join(", ") || "none"})`,
    `- Source-coverage applicable: ${report.metrics.source_coverage_applicable_count}/${report.metrics.total}`,
    `- Actionable blocker rate: ${report.metrics.actionable_blocker_count}/${report.metrics.total}`,
    "",
    "| Case | Final options | Blocker codes | Missing/changed fact | Expected verdict |",
    "|---:|---|---|---|---|",
  ];
  for (const row of report.rows) {
    lines.push([
      row.case,
      row.final_options.join("<br>") || "none",
      row.blocker_codes.join("<br>") || "none",
      factSummary(row),
      row.expected_verdict,
    ].map((value) => String(value).replace(/\|/g, "\\|")).join(" | "));
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const fixturePath = argValue("--fixture", DEFAULT_FIXTURE);
const jsonPath = argValue("--json", DEFAULT_REPORT);
const mdPath = argValue("--md", DEFAULT_MARKDOWN);
const fixture = readFixture(fixturePath);
const rows = fixture.cases.map(auditCase);
const report = {
  report_version: "source-final-audit-v2",
  generated_at: new Date().toISOString(),
  fixture: {
    path: fixturePath,
    name: fixture.name || path.basename(fixturePath, path.extname(fixturePath)),
    version: fixture.version || "unversioned",
    description: fixture.description || "",
  },
  metric_definitions: {
    unsafe_ready: "A case was PDF-ready even though the independent expected verdict says it should block.",
    correct_but_blocked: "A case was blocked even though the independent expected verdict says it should be ready.",
    applicable: "The validator enabled source-final fact coverage for the case.",
    actionable: "A blocked case emitted at least one structural or source-final blocker code.",
  },
  metrics: metrics(rows),
  rows,
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, markdown(report));
console.log(JSON.stringify({
  wrote: { json: jsonPath, md: mdPath },
  metrics: report.metrics,
}, null, 2));
