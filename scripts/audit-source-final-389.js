#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { attachPipelineDecisionEnvelopes } from "../lib/attachPipelineDecisionEnvelopes.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const DEFAULT_INPUT = "tests/fixtures/tree-dude-service-classification-60.json";
const DEFAULT_JSON = "reports/source-final-fact-389-audit.json";
const DEFAULT_MARKDOWN = "reports/source-final-fact-389-audit.md";
const DEFAULT_EXPECTED_STATEMENTS = 389;

const AUDITED_FACTS = new Set([
  "option_label",
  "price",
  "work_actions",
  "species",
  "tree_quantity",
  "stump_quantity",
  "stump_treatment",
  "debris_disposition",
  "target_qualifiers",
  "customer_phone",
  "customer_email",
  "service_address",
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) args[key] = true;
    else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function readRows(inputPath) {
  const raw = readFileSync(resolve(inputPath), "utf8").trim();
  if (!raw) return [];
  if (/\.json$/i.test(inputPath) || raw.startsWith("[") || raw.startsWith("{")) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.cases)) return parsed.cases;
    return [parsed];
  }
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function rowText(row) {
  return firstText(
    row.raw_note,
    row.raw_customer_input,
    row.raw,
    row.input,
    row.text,
    row.customer_text,
  );
}

function rowId(row, index) {
  return firstText(row.case_id, row.caseId, row.id) || String(index + 1);
}

function validateRow(row) {
  const rawText = rowText(row);
  const intake = row.intake || row.structured_input || {};
  const contact = normalizeContactFields({ rawText, intake });
  let alphaJson = normalizeToAlphaJsonV14({}, rawText, intake);
  alphaJson = applyContactNormalizationOverlay(alphaJson, contact);
  alphaJson = reconcileSidecarPrices(alphaJson, buildOptionPriceCandidateView(rawText));
  alphaJson = attachPipelineDecisionEnvelopes(alphaJson, contact, rawText);
  return validateAlphaJson(alphaJson);
}

function sourceFinalCoverage(validation) {
  return validation.alphaJson?.validation?.source_final_fact_coverage || {};
}

function statementRows(caseId, pdfReady, coverage) {
  return asArray(coverage.results)
    .filter((result) => AUDITED_FACTS.has(result?.fact) && result?.source_value)
    .map((result) => ({
      case_id: caseId,
      option_label: asString(result.option_label),
      fact: asString(result.fact),
      fact_label: asString(result.fact_label),
      source_value: result.source_value,
      final_value: result.final_value,
      missing_source_values: asArray(result.missing_source_values),
      status: asString(result.status),
      code: asString(result.code),
      blocks_pdf: Boolean(result.blocks_pdf),
      warning_only: Boolean(result.warning_only),
      override_recorded: Boolean(result.override_recorded),
      pdf_ready: pdfReady,
    }));
}

function incrementCount(counts, key) {
  if (key) counts[key] = (counts[key] || 0) + 1;
}

function markdown(report) {
  const lines = [
    "# Source-versus-final fact audit",
    "",
    `- Input: ${report.input}`,
    `- Cases: ${report.case_count}`,
    `- Statements checked: ${report.statement_count}/${report.expected_statement_count}`,
    `- Unsupported statements: ${report.unsupported_statement_count}`,
    `- Unsupported PDF-ready statements: ${report.unsupported_pdf_ready_count}`,
    `- Unsupported statements blocked from PDF: ${report.unsupported_blocked_statement_count}`,
    `- Audit status: ${report.status}`,
    "",
    "A passing audit status means no unsupported audited fact remained PDF-ready. " +
      "It does not approve safety thresholds, staging integrations, rollout, or production delivery.",
    "",
    "## Unsupported statements",
    "",
    "| Case | Option | Fact | Source value | Final value | Code | Blocks PDF | PDF-ready |",
    "|---|---|---|---|---|---|---:|---:|",
  ];
  for (const row of report.unsupported_statements) {
    lines.push([
      row.case_id,
      row.option_label || "job",
      row.fact_label || row.fact,
      row.source_value || row.missing_source_values.join(", "),
      row.final_value || "not found",
      row.code,
      row.blocks_pdf ? "yes" : "no",
      row.pdf_ready ? "yes" : "no",
    ].map((value) => String(value).replaceAll("|", "\\|")).join(" | "));
  }
  if (!report.unsupported_statements.length) lines.push("| none |  |  |  |  |  |  |  |");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = asString(args.input) || DEFAULT_INPUT;
  const jsonPath = asString(args.json) || DEFAULT_JSON;
  const markdownPath = asString(args.md) || DEFAULT_MARKDOWN;
  const expectedStatements = Number(args["expected-statements"] || DEFAULT_EXPECTED_STATEMENTS);
  if (!Number.isInteger(expectedStatements) || expectedStatements < 1) {
    throw new Error("--expected-statements must be a positive integer");
  }

  const rows = readRows(input);
  const statements = [];
  const caseSummaries = [];
  for (const [index, row] of rows.entries()) {
    const id = rowId(row, index);
    const validation = validateRow(row);
    const coverage = sourceFinalCoverage(validation);
    const findings = statementRows(id, validation.can_generate_pdf === true, coverage);
    statements.push(...findings);
    caseSummaries.push({
      case_id: id,
      pdf_ready: validation.can_generate_pdf === true,
      blocking_codes: [...new Set(asArray(coverage.blocking_codes).map(asString).filter(Boolean))].sort(),
      audited_statement_count: findings.length,
      unsupported_statement_count: findings.filter((statement) =>
        ["missing", "changed"].includes(statement.status) && !statement.override_recorded,
      ).length,
    });
  }

  const unsupported = statements.filter((statement) =>
    ["missing", "changed"].includes(statement.status) && !statement.override_recorded,
  );
  const unsupportedPdfReady = unsupported.filter((statement) => statement.pdf_ready);
  const unsupportedBlocked = unsupported.filter((statement) => statement.blocks_pdf);
  const codeCounts = {};
  for (const statement of unsupported) incrementCount(codeCounts, statement.code);
  const report = {
    report_version: "source-final-fact-389-audit-v1",
    generated_at: new Date().toISOString(),
    input,
    expected_statement_count: expectedStatements,
    case_count: rows.length,
    statement_count: statements.length,
    unsupported_statement_count: unsupported.length,
    unsupported_pdf_ready_count: unsupportedPdfReady.length,
    unsupported_blocked_statement_count: unsupportedBlocked.length,
    affected_case_ids: [...new Set(unsupported.map((statement) => statement.case_id))],
    unsupported_code_counts: Object.fromEntries(Object.entries(codeCounts).sort()),
    status: statements.length === expectedStatements && unsupportedPdfReady.length === 0 ? "PASS" : "FAIL",
    case_summaries: caseSummaries,
    unsupported_statements: unsupported,
    statements,
  };

  writeFileSync(resolve(jsonPath), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(markdownPath), markdown(report));
  console.log(JSON.stringify({
    status: report.status,
    cases: report.case_count,
    statements: `${report.statement_count}/${report.expected_statement_count}`,
    unsupported: report.unsupported_statement_count,
    unsupported_pdf_ready: report.unsupported_pdf_ready_count,
    unsupported_blocked: report.unsupported_blocked_statement_count,
    json: jsonPath,
    markdown: markdownPath,
  }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Source-final fact audit failed closed: ${error?.stack || error}`);
  process.exitCode = 1;
}
