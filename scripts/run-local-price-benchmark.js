import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildPriceInstrumentation } from "../lib/priceInstrumentation.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const REPORT_DIR = path.join(process.cwd(), "reports");

function latestMatching(prefix, suffix) {
  const matches = fs
    .readdirSync(REPORT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort();
  if (!matches.length) return path.join("reports", `${prefix}${suffix}`);
  return path.join("reports", matches[matches.length - 1]);
}

const LOCAL_SOURCES = [
  {
    dataset_name: "alpha-hard-knownfail-price-slice",
    source_file: "tests/fixtures/alpha-hard-knownfail-150-initial-100pct-2026-06-30-cases.json",
    mode: "fixture",
    include: (item) => hasFailure(item, "parser_price_options") || hasPriceSignal(item),
  },
  {
    dataset_name: "alpha-uber-messy-price-slice",
    source_file: "tests/fixtures/alpha-uber-messy-150-initial-16pct-2026-06-30-cases.json",
    mode: "fixture",
    include: (item) => hasFailure(item, "parser_price_options") || hasMissingPriceSignal(item) || hasUnclearPriceSignal(item),
  },
  {
    dataset_name: "alpha-uber-plus-messy-price-slice",
    source_file: "tests/fixtures/alpha-uber-plus-messy-150-initial-39pct-2026-06-30-cases.json",
    mode: "fixture",
    include: (item) => hasFailure(item, "parser_price_options") || hasMissingPriceSignal(item) || hasUnclearPriceSignal(item),
  },
  {
    dataset_name: "alpha-very-messy-price-slice",
    source_file: "tests/fixtures/alpha-very-messy-150-initial-11pct-2026-06-30-cases.json",
    mode: "fixture",
    include: (item) => hasFailure(item, "parser_price_options"),
  },
  {
    dataset_name: "stable-700-replay-current-local",
    source_file: "reports/replay-messy-inputs-2026-07-01_19-43-fresh-700-v2b.jsonl",
    mode: "jsonl-input",
    include: (item) => item.category === "large_price_spread" || hasPriceSignal(item),
  },
  {
    dataset_name: "latest-800-tracking-current-local",
    source_file: latestMatching("internal-100-each-tracking-", ".jsonl"),
    mode: "jsonl-input",
    include: (item) =>
      item.category === "large_price_spread" ||
      item.category === "prior_regression_failures" ||
      hasFinding(item, "price_missing") ||
      hasPriceSignal(item),
  },
];

const SAVED_LIVE_SOURCE = {
  dataset_name: "live-option-price-parsing-v1-saved",
  source_file: latestMatching("live-option-price-parsing-results-", ".jsonl"),
  mode: "saved-live-jsonl",
};

const UNCLEAR_PRICE_PATTERN =
  /\b(?:around|about|approx(?:\.|imately)?|maybe|roughly|estimate|placeholder|not\s+sure|depends|if\s+(?:simple|needed|crane)|price\s+depends|confirm(?:ed)?|firm\s+price|not\s+firm|tbd|to\s+be\s+determined)\b/i;
const MISSING_PRICE_PATTERN =
  /\b(?:no\s+(?:price|prices)|missing\s+price|price\s+(?:later|from\s+yesterday|unknown|tbd)|call\s+customer(?:\s+with\s+price)?|use\s+(?:prior|old|last)\s+price|need\s+(?:price|pricing)|without\s+(?:a\s+)?price)\b/i;
const MONEY_PATTERN = /\$?\b\d{3,6}\b/g;

function timestampParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    now,
    stamp: `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`,
    eastern: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now),
    utc: now.toISOString(),
  };
}

function gitValue(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), "utf8"));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(path.join(process.cwd(), filePath), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sourceRecords(source) {
  if (source.mode === "fixture") return readJson(source.source_file).cases || [];
  if (source.mode === "jsonl-input") return readJsonl(source.source_file);
  throw new Error(`Unsupported source mode: ${source.mode}`);
}

function expectedPrices(item) {
  return [
    ...(item.expected?.service_option_prices || []),
    ...(item.expected?.prices || []),
    ...(item.expected?.should_extract_prices || []),
  ].filter(Boolean);
}

function rawInput(item) {
  return item.raw_customer_input || item.raw_input || "";
}

function caseId(item, fallbackIndex) {
  return item.id || item.case_id || `case-${String(fallbackIndex + 1).padStart(4, "0")}`;
}

function hasFailure(item, code) {
  return (item.current_failure_categories || []).includes(code);
}

function hasFinding(item, code) {
  return (item.findings || []).some((finding) => finding.code === code);
}

function hasUnclearPriceSignal(item) {
  return UNCLEAR_PRICE_PATTERN.test(rawInput(item)) || UNCLEAR_PRICE_PATTERN.test(JSON.stringify(item.expected || {}));
}

function hasMissingPriceSignal(item) {
  return MISSING_PRICE_PATTERN.test(rawInput(item)) || MISSING_PRICE_PATTERN.test(JSON.stringify(item.expected || {}));
}

function hasPriceSignal(item) {
  return expectedPrices(item).length > 0 || hasUnclearPriceSignal(item) || hasMissingPriceSignal(item);
}

function normalizeMoney(value) {
  const numeric = String(value || "").replace(/[^\d]/g, "");
  if (!numeric) return "";
  return `$${Number(numeric).toLocaleString("en-US")}`;
}

function optionPrices(alphaJson = {}) {
  return (alphaJson.service_options?.items || [])
    .map((option, index) => ({
      label: option.label || `Option ${String.fromCharCode(65 + index)}`,
      display: option.price?.display || "",
      amount: option.price?.amount ?? null,
      is_unclear: Boolean(option.price?.is_unclear),
    }))
    .filter((item) => item.display || item.amount != null || item.is_unclear);
}

function renderedPriceText(prices) {
  return prices.map((price) => `${price.label} ${price.display || "Price missing"}`).join("; ");
}

function followUps(validation = {}) {
  return [
    ...(validation.follow_ups || []),
    ...(validation.alphaJson?.validation?.tree_dude_follow_ups || []),
    ...((validation.alphaJson?.validation?.structured_follow_ups || []).map((item) => item.question).filter(Boolean)),
  ];
}

function priceRelatedText(validation = {}) {
  return [
    ...(validation.blocking_errors || []),
    ...(validation.warnings || []),
    ...followUps(validation),
    ...(validation.alphaJson?.validation?.unclear_prices || []),
    ...(validation.alphaJson?.validation?.missing_required_fields || []),
  ].join(" | ");
}

function readinessStatus(validation = {}) {
  return validation.can_generate_pdf ? "ready" : "needs_more_info";
}

function dropdownActivationState(validation = {}) {
  const text = priceRelatedText(validation);
  const active = /\b(price|priced|cost|amount|firm)\b/i.test(text);
  return {
    price_dropdown_active: active,
    reason: active ? "price follow-up/blocking text present" : "none",
    confirm_quote_enabled: Boolean(validation.can_generate_pdf),
  };
}

function numberCandidates(text) {
  return [...String(text || "").matchAll(MONEY_PATTERN)].map((match) => normalizeMoney(match[0])).filter(Boolean);
}

function phoneOrAddressMistakenForPrice(item, actualPrices) {
  const input = rawInput(item);
  const actual = new Set(actualPrices.map((price) => normalizeMoney(price.display || price.amount)).filter(Boolean));
  if (!actual.size) return false;

  const phoneChunks = [...input.matchAll(/\b(?:\d{3})[-.\s](?:\d{3})[-.\s](\d{4})\b/g)]
    .map((match) => normalizeMoney(match[1]))
    .filter(Boolean);
  const addressNumbers = [...input.matchAll(/\b\d{1,5}\s+[A-Z][A-Za-z0-9.]+\s+(?:St|Street|Road|Rd|Ave|Avenue|Lane|Ln|Drive|Dr|Court|Ct|Way|Pike|Trail|Trl|Highway|Hwy)\b/gi)]
    .map((match) => normalizeMoney(match[0].match(/\d{1,5}/)?.[0]))
    .filter(Boolean);

  return [...phoneChunks, ...addressNumbers].some((candidate) => actual.has(candidate));
}

function priceBucket(item, validation, actualPrices) {
  const expected = expectedPrices(item).map(normalizeMoney).filter(Boolean);
  const actual = actualPrices.map((price) => normalizeMoney(price.display || price.amount)).filter(Boolean);
  const actualSet = new Set(actual);

  if (phoneOrAddressMistakenForPrice(item, actualPrices)) return "phone_or_address_number_mistaken_for_price";

  if (expected.length) {
    const allExpectedPresent = expected.every((price) => actualSet.has(price));
    if (allExpectedPresent && actual.length >= expected.length) return "firm_price_correct";
    if (!actual.length || actualPrices.every((price) => price.is_unclear || !price.display)) return "firm_price_missing";
    return "firm_price_wrong";
  }

  if (hasUnclearPriceSignal(item)) {
    return actual.length && validation.can_generate_pdf ? "unclear_price_treated_as_firm" : "unclear_price_correctly_blocked";
  }

  return actual.length && validation.can_generate_pdf ? "no_price_invented" : "no_price_correctly_blocked";
}

function failureFlags(item, validation, actualPrices, bucket) {
  const flags = [];
  if (bucket.includes("missing") || bucket.includes("wrong") || bucket.includes("invented") || bucket.includes("mistaken") || bucket.includes("treated_as_firm")) {
    flags.push(bucket);
  }
  if (expectedPrices(item).length && actualPrices.some((price) => price.is_unclear)) flags.push("firm_price_marked_unclear");
  if (!validation.can_generate_pdf && !followUps(validation).length) flags.push("blocked_without_follow_up");
  return [...new Set(flags)];
}

function runLocalCase(item, source, index) {
  let alphaJson = null;
  let validation = null;
  let error = "";
  const rawDraft = item.alphaJson_before_normalization || item.raw_openai_draft_json || item.model_output_raw || null;

  try {
    alphaJson = normalizeToAlphaJsonV14({}, rawInput(item), item.intake || {});
    validation = validateAlphaJson(alphaJson);
  } catch (caught) {
    error = caught?.stack || String(caught);
    validation = { can_generate_pdf: false, blocking_errors: [error], warnings: [], follow_ups: [], alphaJson: alphaJson || {} };
  }

  const actualPrices = optionPrices(validation.alphaJson || alphaJson || {});
  const bucket = priceBucket(item, validation, actualPrices);
  const dropdown = dropdownActivationState(validation);
  const finalAlphaJson = validation.alphaJson || alphaJson || {};
  const instrumentation = buildPriceInstrumentation({
    rawInput: rawInput(item),
    expectedPrices: expectedPrices(item),
    alphaJsonBeforeNormalization: rawDraft,
    alphaJsonAfterNormalization: finalAlphaJson,
    validation,
    dropdownActivationState: dropdown,
  });

  return {
    case_id: caseId(item, index),
    dataset_name: source.dataset_name,
    source_file: source.source_file,
    source_mode: "current_local_parser",
    source_category: item.category || item.group || "",
    selection_reason: selectionReason(item),
    raw_input: rawInput(item),
    expected_prices: expectedPrices(item),
    expected_price_supported_by_raw_input: instrumentation.expected_price_supported_by_raw_input,
    actual_td2_prices: actualPrices,
    td2_displayed_options: instrumentation.td2_displayed_options,
    model_quote_options: instrumentation.model_quote_options,
    normalized_quote_options: instrumentation.normalized_quote_options,
    price_status: bucketToStatus(bucket),
    price_bucket: bucket,
    price_failure_stage: instrumentation.price_failure_stage,
    price_failure_stages: instrumentation.price_failure_stages,
    readiness_status: readinessStatus(validation),
    follow_up_questions: followUps(validation),
    dropdown_activation_state: dropdown,
    failure_flags: failureFlags(item, validation, actualPrices, bucket),
    validation_blocking_errors: validation.blocking_errors || [],
    validation_warnings: validation.warnings || [],
    price_candidates_in_input: numberCandidates(rawInput(item)),
    price_candidates_detected: instrumentation.price_candidates_detected,
    excluded_numbers: instrumentation.excluded_numbers,
    price_evidence_spans: instrumentation.price_evidence_spans,
    alphaJson_before_normalization: instrumentation.alphaJson_before_normalization,
    alphaJson_after_normalization: instrumentation.alphaJson_after_normalization,
    pipeline_error: error,
  };
}

function selectionReason(item) {
  const reasons = [];
  if (hasFailure(item, "parser_price_options")) reasons.push("parser_price_options");
  if (hasFinding(item, "price_missing")) reasons.push("price_missing finding");
  if (item.category === "large_price_spread") reasons.push("large_price_spread");
  if (hasMissingPriceSignal(item)) reasons.push("missing-price language");
  if (hasUnclearPriceSignal(item)) reasons.push("unclear-price language");
  if (expectedPrices(item).length) reasons.push("expected price values");
  return reasons.join("; ") || "price benchmark source";
}

function bucketToStatus(bucket) {
  if (bucket.endsWith("_correct") || bucket.endsWith("_correctly_blocked")) return "pass";
  return "fail";
}

function liveRecordToRow(record) {
  const bucket = record.price_bucket || remapSavedLiveBucket(record);
  const td2Options = record.td2_displayed_options || [];
  const dropdown = record.dropdown_activation_state || {};
  const instrumentation = buildPriceInstrumentation({
    rawInput: record.raw_input || "",
    expectedPrices: record.expected?.should_extract_prices || [],
    alphaJsonBeforeNormalization: record.alphaJson_before_normalization || record.raw_openai_draft_json || record.model_output_raw || null,
    alphaJsonAfterNormalization: record.alphaJson_after_normalization || record.cleaned_canonical_alphaJson || null,
    validation: record.validation_result || {},
    dropdownActivationState: dropdown,
    td2DisplayedOptions: td2Options,
  });
  return {
    case_id: record.case_id,
    dataset_name: SAVED_LIVE_SOURCE.dataset_name,
    source_file: SAVED_LIVE_SOURCE.source_file,
    source_mode: "saved_live_result_no_rerun",
    source_category: record.group || "",
    selection_reason: "saved dedicated live price smoke benchmark",
    raw_input: record.raw_input || "",
    expected_prices: record.expected?.should_extract_prices || [],
    expected_price_supported_by_raw_input: instrumentation.expected_price_supported_by_raw_input,
    actual_td2_prices: record.td2_displayed_options || [],
    td2_displayed_options: instrumentation.td2_displayed_options,
    model_quote_options: instrumentation.model_quote_options,
    normalized_quote_options: instrumentation.normalized_quote_options,
    price_status: bucketToStatus(bucket),
    price_bucket: bucket,
    price_failure_stage: instrumentation.price_failure_stage,
    price_failure_stages: instrumentation.price_failure_stages,
    readiness_status: record.readiness_status || "",
    follow_up_questions: record.follow_up_questions || [],
    dropdown_activation_state: dropdown,
    failure_flags: record.failure_flags || [],
    validation_blocking_errors: record.validation_result?.blocking_errors || [],
    validation_warnings: record.validation_result?.warnings || [],
    price_candidates_in_input: (record.price_candidates_detected || []).map((item) => item.value),
    price_candidates_detected: instrumentation.price_candidates_detected,
    excluded_numbers: instrumentation.excluded_numbers,
    price_evidence_spans: instrumentation.price_evidence_spans,
    alphaJson_before_normalization: instrumentation.alphaJson_before_normalization,
    alphaJson_after_normalization: instrumentation.alphaJson_after_normalization,
    pipeline_error: record.production_error || "",
  };
}

function remapSavedLiveBucket(record) {
  const group = record.group || "";
  const prices = record.td2_displayed_options || [];
  const hasFinalPrice = prices.some((price) => normalizeMoney(price.price_display));
  if (group === "price_present_but_not_firm") {
    return hasFinalPrice && record.readiness_status === "ready" ? "unclear_price_treated_as_firm" : "unclear_price_correctly_blocked";
  }
  if (group === "no_usable_price_in_input") {
    return hasFinalPrice && record.readiness_status === "ready" ? "no_price_invented" : "no_price_correctly_blocked";
  }
  if (group === "phone_number_not_price") {
    return (record.failure_flags || []).length ? "phone_or_address_number_mistaken_for_price" : "firm_price_correct";
  }
  return (record.failure_flags || []).length ? "firm_price_wrong" : "firm_price_correct";
}

function rowFailureStages(row) {
  const stages = Array.isArray(row.price_failure_stages) ? row.price_failure_stages : [];
  if (stages.length) return stages.filter(Boolean);
  return row.price_failure_stage ? [row.price_failure_stage] : [];
}

function adjustedPriceStatus(row) {
  if (row.price_status !== "fail") return row.price_status;
  const stages = rowFailureStages(row);
  const trueFailureStages = stages.filter((stage) => stage !== "raw_expected_unsupported");
  return stages.includes("raw_expected_unsupported") && trueFailureStages.length === 0
    ? "unsupported_expected"
    : "fail";
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    raw_price_status: { pass: 0, fail: 0 },
    adjusted_price_status: { pass: 0, fail: 0, unsupported_expected: 0 },
    by_bucket: {},
    by_failure_stage: {},
    by_dataset: {},
    by_axis: {
      firm_price_extraction: { pass: 0, fail: 0 },
      missing_price_handling: { pass: 0, fail: 0 },
      unclear_price_handling: { pass: 0, fail: 0 },
      invented_price_prevention: { pass: 0, fail: 0 },
      phone_address_number_exclusion: { pass: 0, fail: 0 },
      readiness_follow_up_dropdown: { pass: 0, fail: 0 },
    },
  };

  for (const row of rows) {
    const adjustedStatus = adjustedPriceStatus(row);
    summary.raw_price_status[row.price_status] += 1;
    summary.adjusted_price_status[adjustedStatus] += 1;
    summary.by_bucket[row.price_bucket] = (summary.by_bucket[row.price_bucket] || 0) + 1;
    summary.by_failure_stage[row.price_failure_stage] = (summary.by_failure_stage[row.price_failure_stage] || 0) + 1;
    summary.by_dataset[row.dataset_name] ||= { total: 0, pass: 0, fail: 0, unsupported_expected: 0 };
    summary.by_dataset[row.dataset_name].total += 1;
    summary.by_dataset[row.dataset_name][adjustedStatus] += 1;

    if (adjustedStatus === "unsupported_expected") continue;
    const status = adjustedStatus === "pass" ? "pass" : "fail";
    if (row.price_bucket.startsWith("firm_price")) summary.by_axis.firm_price_extraction[status] += 1;
    if (row.price_bucket.startsWith("no_price")) summary.by_axis.missing_price_handling[status] += 1;
    if (row.price_bucket.startsWith("unclear_price")) summary.by_axis.unclear_price_handling[status] += 1;
    if (row.price_bucket === "no_price_invented") summary.by_axis.invented_price_prevention.fail += 1;
    if (row.price_bucket === "no_price_correctly_blocked") summary.by_axis.invented_price_prevention.pass += 1;
    if (row.price_bucket === "phone_or_address_number_mistaken_for_price") summary.by_axis.phone_address_number_exclusion.fail += 1;
    if (row.source_category === "phone_number_not_price") summary.by_axis.phone_address_number_exclusion.pass += adjustedStatus === "pass" ? 1 : 0;

    const needsFollowUp = /blocked|missing|unclear|invented|treated_as_firm/i.test(row.price_bucket);
    const hasFollowUp = (row.follow_up_questions || []).length > 0;
    const dropdownActive = Boolean(row.dropdown_activation_state?.price_dropdown_active);
    if (needsFollowUp) {
      summary.by_axis.readiness_follow_up_dropdown[!row.dropdown_activation_state?.confirm_quote_enabled && (hasFollowUp || dropdownActive) ? "pass" : "fail"] += 1;
    }
  }

  return summary;
}

function csvEscape(value) {
  const text = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function renderCsv(rows) {
  const fields = [
    "case_id",
    "dataset_name",
    "source_file",
    "source_mode",
    "source_category",
    "selection_reason",
    "raw_input",
    "expected_prices",
    "expected_price_supported_by_raw_input",
    "actual_td2_prices",
    "td2_displayed_options",
    "model_quote_options",
    "normalized_quote_options",
    "price_status",
    "adjusted_price_status",
    "price_bucket",
    "price_failure_stage",
    "price_failure_stages",
    "readiness_status",
    "follow_up_questions",
    "dropdown_activation_state",
    "failure_flags",
    "price_candidates_detected",
    "excluded_numbers",
    "price_evidence_spans",
  ];
  const rowsWithAdjustedStatus = rows.map((row) => ({ ...row, adjusted_price_status: adjustedPriceStatus(row) }));
  return `${fields.join(",")}\n${rowsWithAdjustedStatus.map((row) => fields.map((field) => csvEscape(row[field])).join(",")).join("\n")}\n`;
}

function renderMarkdown(rows, summary, meta, paths) {
  const lines = [
    `# Local Price Benchmark ${meta.stamp}`,
    "",
    "Scope: local parser/helper benchmark only. No live deployment calls and no OpenAI API calls were made by this script.",
    "",
    `Generated Eastern: ${meta.eastern}`,
    `Generated UTC: ${meta.utc}`,
    `Commit: ${meta.commit}`,
    `Branch: ${meta.branch}`,
    `Dirty files: ${meta.dirtyFiles}`,
    "",
    "## Output Files",
    "",
    `- Full row table CSV: \`${paths.csvPath}\``,
    `- Full row JSONL: \`${paths.jsonlPath}\``,
    `- Summary JSON: \`${paths.summaryPath}\``,
    "",
    "## Summary",
    "",
    `- Total rows: ${summary.total}`,
    `- Raw passing price rows: ${summary.raw_price_status.pass}`,
    `- Raw failing price rows: ${summary.raw_price_status.fail}`,
    `- Adjusted passing price rows: ${summary.adjusted_price_status.pass}`,
    `- Adjusted failing price rows: ${summary.adjusted_price_status.fail}`,
    `- Unsupported expected labels separated from parser misses: ${summary.adjusted_price_status.unsupported_expected}`,
    "",
    "## Buckets",
    "",
    "| Price bucket | Count |",
    "|---|---:|",
  ];

  for (const [bucket, count] of Object.entries(summary.by_bucket).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| ${bucket} | ${count} |`);
  }

  lines.push("", "## Failure Stage Split", "", "| Failure stage | Count |", "|---|---:|");
  for (const [stage, count] of Object.entries(summary.by_failure_stage).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| ${stage} | ${count} |`);
  }

  lines.push("", "## Dataset Results", "", "| Dataset | Total | Adjusted pass | Adjusted fail | Unsupported expected |", "|---|---:|---:|---:|---:|");
  for (const [dataset, item] of Object.entries(summary.by_dataset)) {
    lines.push(`| ${dataset} | ${item.total} | ${item.pass} | ${item.fail} | ${item.unsupported_expected} |`);
  }

  lines.push("", "## Required Reporting Axes", "", "| Axis | Pass | Fail |", "|---|---:|---:|");
  for (const [axis, item] of Object.entries(summary.by_axis)) {
    lines.push(`| ${axis} | ${item.pass} | ${item.fail} |`);
  }

  lines.push("", "## First 75 Adjusted Failing Rows", "", "| Case | Dataset | Bucket | Stage | Expected | Actual | Follow-up |", "|---|---|---|---|---|---|---|");
  for (const row of rows.filter((item) => adjustedPriceStatus(item) === "fail").slice(0, 75)) {
    lines.push(
      [
        row.case_id,
        row.dataset_name,
        row.price_bucket,
        row.price_failure_stage,
        (row.expected_prices || []).join("; "),
        renderedPriceText(row.actual_td2_prices || []),
        (row.follow_up_questions || []).join("; "),
      ]
        .map((value) => String(value || "").replace(/\|/g, "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Fixture and replay files created before the latest app commit are used as inputs only.",
    "- Saved live rows are included from the existing July 2 file for comparison, but they were not rerun.",
    "- The CSV is the one-row-per-case benchmark table requested in the prompt.",
    "",
  );

  return lines.join("\n");
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const meta = timestampParts();
meta.commit = gitValue(["rev-parse", "HEAD"]);
meta.branch = gitValue(["branch", "--show-current"]);
meta.dirtyFiles = gitValue(["status", "--short"], "").split(/\r?\n/).filter(Boolean).length;

const rows = [];
for (const source of LOCAL_SOURCES) {
  const records = sourceRecords(source).filter(source.include);
  records.forEach((item, index) => rows.push(runLocalCase(item, source, index)));
}

if (fs.existsSync(path.join(process.cwd(), SAVED_LIVE_SOURCE.source_file))) {
  readJsonl(SAVED_LIVE_SOURCE.source_file).forEach((record) => rows.push(liveRecordToRow(record)));
}

const summary = summarize(rows);
const baseName = `local-price-benchmark-${meta.stamp}`;
const jsonlPath = path.join("reports", `${baseName}.jsonl`);
const csvPath = path.join("reports", `${baseName}.csv`);
const summaryPath = path.join("reports", `${baseName}-summary.json`);
const mdPath = path.join("reports", `${baseName}.md`);

fs.writeFileSync(path.join(process.cwd(), jsonlPath), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
fs.writeFileSync(path.join(process.cwd(), csvPath), renderCsv(rows));
fs.writeFileSync(path.join(process.cwd(), summaryPath), JSON.stringify({ meta, summary }, null, 2));
fs.writeFileSync(path.join(process.cwd(), mdPath), renderMarkdown(rows, summary, meta, { jsonlPath, csvPath, summaryPath }));

console.log(`Wrote ${mdPath}`);
console.log(`Wrote ${csvPath}`);
console.log(`Rows: ${rows.length}`);
console.log(`Failures: ${rows.filter((row) => row.price_status === "fail").length}`);
