import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { buildPriceInstrumentation } from "../lib/priceInstrumentation.js";

const reportsDir = path.join(process.cwd(), "reports");
const outputPath = path.join(reportsDir, "price-parsing-prehuman-review-cases.jsonl");

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function listMatchingReports(pattern) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => path.join(reportsDir, name));
}

function latestMatchingReport(pattern) {
  const matches = listMatchingReports(pattern);
  return matches.length ? [matches[matches.length - 1]] : [];
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

function gitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function runIdFromFile(filePath) {
  return path.basename(filePath, ".jsonl");
}

function compactOption(option) {
  if (!option || typeof option !== "object") return option;
  return {
    label: option.label ?? option.raw_label ?? null,
    title: option.title ?? null,
    description: option.description ?? option.raw_text ?? null,
    scope: option.scope ?? null,
    price: option.price ?? null,
    price_display: option.price_display ?? option.display ?? option.price_raw ?? option.price?.display ?? null,
    price_amount: option.price_amount ?? option.amount ?? option.price?.amount ?? null,
    price_status: option.price_status ?? null,
    price_is_unclear: option.price_is_unclear ?? option.is_unclear ?? option.price?.is_unclear ?? null,
    evidence: option.evidence ?? null
  };
}

function modelOptions(row) {
  const direct = row.model_quote_options;
  if (Array.isArray(direct)) return direct.map(compactOption);
  const draftOptions = row.raw_openai_draft_json?.options;
  if (Array.isArray(draftOptions)) return draftOptions.map(compactOption);
  const modelRawOptions = row.model_output_raw?.options;
  if (Array.isArray(modelRawOptions)) return modelRawOptions.map(compactOption);
  return [];
}

function normalizedOptions(row) {
  const direct = row.normalized_quote_options;
  if (Array.isArray(direct)) return direct.map(compactOption);
  const alphaItems =
    row.alphaJson_after_normalization?.service_options?.items ??
    row.cleaned_canonical_alphaJson?.service_options?.items ??
    row.extraction_fields?.service_options?.items;
  if (Array.isArray(alphaItems)) return alphaItems.map(compactOption);
  const actualPrices = row.actual_td2_prices;
  if (Array.isArray(actualPrices)) return actualPrices.map(compactOption);
  return [];
}

function td2Options(row) {
  const direct = row.td2_displayed_options;
  if (Array.isArray(direct)) return direct.map(compactOption);
  const rendered = row.td2_rendered_fields?.quote_options;
  if (Array.isArray(rendered)) return rendered.map(compactOption);
  const actualPrices = row.actual_td2_prices;
  if (Array.isArray(actualPrices)) return actualPrices.map(compactOption);
  return [];
}

function validationResult(row) {
  return row.validation_result ?? row.validation ?? row.cleaned_canonical_alphaJson?.validation ?? null;
}

function readinessStatus(row) {
  if (row.readiness_status) return row.readiness_status;
  const validation = validationResult(row);
  if (validation?.can_generate_pdf === true) return "ready";
  if (validation?.can_generate_pdf === false) return "needs_more_info";
  if (row.expected?.ready === true) return "expected_ready";
  if (row.expected?.ready === false) return "expected_needs_more_info";
  return null;
}

function followUps(row) {
  if (Array.isArray(row.follow_up_questions)) return row.follow_up_questions;
  const validation = validationResult(row);
  if (Array.isArray(validation?.follow_ups)) return validation.follow_ups;
  if (Array.isArray(validation?.tree_dude_follow_ups)) return validation.tree_dude_follow_ups;
  if (Array.isArray(row.td2_rendered_fields?.needs_more_info)) return row.td2_rendered_fields.needs_more_info;
  return [];
}

function warnings(row) {
  if (Array.isArray(row.price_warnings)) return row.price_warnings;
  const validation = validationResult(row);
  const validationWarnings = Array.isArray(validation?.warnings) ? validation.warnings : [];
  const renderedWarnings = Array.isArray(row.td2_rendered_fields?.warnings) ? row.td2_rendered_fields.warnings : [];
  return [...validationWarnings, ...renderedWarnings];
}

function priceCandidates(row) {
  if (Array.isArray(row.price_candidates_detected)) return row.price_candidates_detected;
  if (Array.isArray(row.price_candidates_in_input)) {
    return row.price_candidates_in_input.map((value) => ({ value, source: "price_candidates_in_input" }));
  }
  return [];
}

function priceEvidenceSpans(row) {
  const spans = [];
  for (const option of modelOptions(row)) {
    if (option.evidence || option.price_display) {
      spans.push({
        option_label: option.label,
        price: option.price_display,
        evidence: option.evidence
      });
    }
  }
  const evidencePrices =
    row.cleaned_canonical_alphaJson?.normalization?.field_evidence?.price ??
    row.alphaJson_after_normalization?.normalization?.field_evidence?.price ??
    row.extraction_fields?.normalization?.field_evidence?.price;
  if (Array.isArray(evidencePrices)) {
    for (const value of evidencePrices) spans.push({ option_label: null, price: value, evidence: value });
  } else if (typeof evidencePrices === "string" && evidencePrices) {
    spans.push({ option_label: null, price: null, evidence: evidencePrices });
  }
  return spans;
}

function uncertaintyFlags(row) {
  const flags = new Set();
  for (const flag of row.failure_flags ?? []) flags.add(flag);
  if (row.price_missing_bucket && row.price_missing_bucket !== "price_ok_or_not_missing") flags.add(row.price_missing_bucket);
  if (row.price_bucket) flags.add(row.price_bucket);
  for (const option of normalizedOptions(row)) {
    if (option.price_is_unclear === true) flags.add("unclear_price");
    if (!option.price_display && option.price_amount == null) flags.add("missing_option_price");
  }
  return [...flags];
}

function dropdownState(row) {
  if (row.dropdown_activation_state) return row.dropdown_activation_state;
  return null;
}

function rowFromSource(row, source) {
  if (row.production_error || row.api_error) {
    return null;
  }

  const alphaJsonAfter =
    row.alphaJson_after_normalization ??
    row.cleaned_canonical_alphaJson ??
    null;

  const dropdown = dropdownState(row);
  const normalized = normalizedOptions(row);
  const td2 = td2Options(row);
  const expectedPrices = row.expected?.prices ?? row.expected_prices ?? row.expected?.should_extract_prices ?? [];
  const rawText = row.raw_input ?? row.normalized_input ?? alphaJsonAfter?.raw_input?.customer_text ?? "";
  const instrumentation = buildPriceInstrumentation({
    rawInput: rawText,
    expectedPrices: Array.isArray(expectedPrices) ? expectedPrices : [],
    alphaJsonBeforeNormalization: row.alphaJson_before_normalization ?? row.raw_openai_draft_json ?? row.model_output_raw ?? null,
    alphaJsonAfterNormalization: alphaJsonAfter,
    validation: validationResult(row) || {},
    dropdownActivationState: dropdown,
    td2DisplayedOptions: td2,
  });

  return {
    case_id: row.case_id ?? row.source_case_id ?? null,
    dataset_name: row.dataset_name ?? source.datasetName ?? row.category ?? null,
    run_id: source.runId,
    parser_version: source.gitCommit,
    prompt_version: row.raw_openai_draft_json?.draft_version ?? row.model_output_raw?.draft_version ?? null,
    model: row.model ?? null,
    temperature: row.temperature ?? null,
    run_mode: source.runMode,
    raw_input: rawText || null,
    model_output_raw: row.model_output_raw ?? row.raw_openai_draft_json ?? null,
    alphaJson_before_normalization: row.alphaJson_before_normalization ?? instrumentation.alphaJson_before_normalization,
    alphaJson_after_normalization: alphaJsonAfter,
    model_quote_options: modelOptions(row).length ? modelOptions(row) : instrumentation.model_quote_options,
    normalized_quote_options: normalized.length ? normalized : instrumentation.normalized_quote_options,
    td2_displayed_options: td2.length ? td2 : instrumentation.td2_displayed_options,
    price_candidates_detected: instrumentation.price_candidates_detected.length ? instrumentation.price_candidates_detected : priceCandidates(row),
    excluded_numbers: Array.isArray(row.excluded_numbers) && row.excluded_numbers.length ? row.excluded_numbers : instrumentation.excluded_numbers,
    price_evidence_spans: instrumentation.price_evidence_spans.length ? instrumentation.price_evidence_spans : priceEvidenceSpans(row),
    expected_price_supported_by_raw_input: instrumentation.expected_price_supported_by_raw_input,
    price_failure_stage: row.price_failure_stage ?? instrumentation.price_failure_stage,
    price_failure_stages: row.price_failure_stages ?? instrumentation.price_failure_stages,
    price_uncertainty_flags: uncertaintyFlags(row),
    price_warnings: warnings(row),
    validation_result: validationResult(row),
    readiness_status: readinessStatus(row),
    follow_up_questions: followUps(row),
    dropdown_activation_state: dropdown,
    price_dropdown_activated: dropdown?.price_dropdown_active ?? null,
    price_dropdown_reason: dropdown?.reason ?? null,
    failure_flags: row.failure_flags ?? row.findings ?? [],
    source_file: path.relative(process.cwd(), source.filePath),
    source_case_id: row.source_case_id ?? null,
    expected: row.expected ?? {
      prices: row.expected_prices ?? null
    }
  };
}

function fieldCoverage(rows) {
  const requestedFields = [
    "case_id",
    "dataset_name",
    "run_id",
    "parser_version",
    "prompt_version",
    "model",
    "temperature",
    "run_mode",
    "raw_input",
    "model_output_raw",
    "alphaJson_before_normalization",
    "alphaJson_after_normalization",
    "model_quote_options",
    "normalized_quote_options",
    "td2_displayed_options",
    "price_candidates_detected",
    "excluded_numbers",
    "price_evidence_spans",
    "expected_price_supported_by_raw_input",
    "price_failure_stage",
    "price_failure_stages",
    "price_uncertainty_flags",
    "price_warnings",
    "validation_result",
    "readiness_status",
    "follow_up_questions",
    "dropdown_activation_state",
    "price_dropdown_activated",
    "price_dropdown_reason",
    "failure_flags"
  ];

  const counts = Object.fromEntries(requestedFields.map((field) => [field, 0]));
  for (const row of rows) {
    for (const field of requestedFields) {
      const value = row[field];
      const hasValue =
        value !== null &&
        value !== undefined &&
        (!(Array.isArray(value)) || value.length > 0) &&
        (!(typeof value === "string") || value.length > 0);
      if (hasValue) counts[field] += 1;
    }
  }

  const total = rows.length;
  return {
    fullyAvailable: requestedFields.filter((field) => counts[field] === total),
    partiallyAvailable: requestedFields.filter((field) => counts[field] > 0 && counts[field] < total),
    missing: requestedFields.filter((field) => counts[field] === 0),
    counts
  };
}

const commit = gitCommit();
const sourceFiles = [
  ...latestMatchingReport(/^live-option-price-parsing-results-.*\.jsonl$/),
  ...latestMatchingReport(/^local-price-benchmark-.*\.jsonl$/),
  ...latestMatchingReport(/^internal-100-each-tracking-.*\.jsonl$/),
  ...listMatchingReports(/^LIVEapi-results-.*-50cases\.jsonl$/)
].filter(fileExists);

const rows = [];
const sourceSummaries = [];

for (const filePath of sourceFiles) {
  const fileRows = readJsonl(filePath);
  const baseName = path.basename(filePath);
  let runMode = "local";
  let datasetName = "unknown";
  if (baseName.startsWith("live-option-price-parsing-results-")) {
    runMode = "live_api";
    datasetName = "live-option-price-parsing";
  } else if (baseName.startsWith("local-price-benchmark-")) {
    runMode = "local";
    datasetName = "local-price-benchmark";
  } else if (baseName.startsWith("internal-100-each-tracking-")) {
    runMode = "local";
    datasetName = "internal-100-each";
  } else if (baseName.startsWith("LIVEapi-results-")) {
    runMode = "live_api";
    datasetName = "LIVEapi-results-50cases";
  }

  const source = {
    filePath,
    runId: runIdFromFile(filePath),
    runMode,
    datasetName,
    gitCommit: commit
  };

  const beforeCount = rows.length;
  for (const row of fileRows) {
    const normalizedRow = rowFromSource(row, source);
    if (normalizedRow?.raw_input) rows.push(normalizedRow);
  }
  sourceSummaries.push({
    file: path.relative(process.cwd(), filePath),
    input_rows: fileRows.length,
    exported_rows: rows.length - beforeCount
  });
}

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(outputPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);

const coverage = fieldCoverage(rows);
const summary = {
  output_file: path.relative(process.cwd(), outputPath),
  total_cases_exported: rows.length,
  nonempty_raw_input_cases: rows.filter((row) => row.raw_input).length,
  cases_with_td2_displayed_options: rows.filter((row) => row.td2_displayed_options.length > 0).length,
  cases_with_normalized_quote_options: rows.filter((row) => row.normalized_quote_options.length > 0).length,
  cases_with_validation_or_readiness_data: rows.filter((row) => row.validation_result || row.readiness_status).length,
  cases_with_dropdown_data: rows.filter((row) => row.dropdown_activation_state).length,
  fully_available_fields: coverage.fullyAvailable,
  partially_available_fields: coverage.partiallyAvailable,
  missing_fields: coverage.missing,
  field_nonempty_counts: coverage.counts,
  source_files: sourceSummaries
};

console.log(JSON.stringify(summary, null, 2));
