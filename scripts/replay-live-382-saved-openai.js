import fs from "node:fs";
import path from "node:path";
import { parseOpenAiDraft } from "../lib/openaiDraftSchema.js";
import { openAiDraftToNormalizerInput } from "../lib/openaiDraftAdapter.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import {
  buildEvidenceBackedTextCleanupResult,
  buildPreNormalizerParserInput,
  textCleanupNormalizer,
} from "../lib/textCleanupNormalizer.js";

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const DEFAULT_INPUT = path.join(REPORT_DIR, "live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl");
const INPUT_PATH = cliArgValue("--input") || DEFAULT_INPUT;
const STAMP = cliArgValue("--stamp") || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_PATH = path.join(REPORT_DIR, `live-382-production-replay-${STAMP}.jsonl`);
const SUMMARY_PATH = path.join(REPORT_DIR, `live-382-production-replay-${STAMP}.md`);
const LIMIT = cliArgNumber("--limit", 0);
const IDS = new Set((cliArgValue("--ids") || "").split(",").map((item) => item.trim()).filter(Boolean));
const BUCKETS = ["easy", "medium", "hard", "uber_messy", "unknown"];
const FOCUSED_IDS = ["obs_0907", "obs_0839", "obs_0909"];

function cliArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function cliArgNumber(name, fallback) {
  const value = Number(cliArgValue(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing input JSONL: ${filePath}`);
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, records) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compactText(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function pctNumber(numerator, denominator) {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function pctText(numerator, denominator) {
  const value = pctNumber(numerator, denominator);
  return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

function amountFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = asString(value).replace(/,/g, "").trim();
  const direct = text.match(/^\$?(\d+(?:\.\d+)?)$/);
  if (direct) return Math.round(Number(direct[1]));
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Math.round(Number(digits)) : null;
}

function displayForAmount(amount) {
  return Number.isFinite(Number(amount)) && Number(amount) > 0
    ? `$${Math.round(Number(amount)).toLocaleString("en-US")}`
    : "";
}

function amountFromOption(option = {}) {
  return amountFromValue(option.price?.amount ?? option.price?.min_amount ?? option.price_display ?? option.price?.display);
}

function countByAmount(items) {
  const counts = new Map();
  for (const item of items || []) {
    const amount = typeof item === "number" ? item : item?.amount;
    if (!amount) continue;
    counts.set(amount, (counts.get(amount) || 0) + 1);
  }
  return counts;
}

function matchedAmountCount(expected, actual) {
  const expectedCounts = countByAmount(expected);
  const actualCounts = countByAmount(actual);
  let matches = 0;
  for (const [amount, count] of expectedCounts.entries()) {
    matches += Math.min(count, actualCounts.get(amount) || 0);
  }
  return matches;
}

function exactAmountSet(expected, actual) {
  const left = [...countByAmount(expected).entries()].sort((a, b) => a[0] - b[0]);
  const right = [...countByAmount(actual).entries()].sort((a, b) => a[0] - b[0]);
  return JSON.stringify(left) === JSON.stringify(right);
}

function expectedPairs(row = {}) {
  return (row.expected || row.expected_pairs || [])
    .map((item, index) => ({
      expected_id: item.expected_id || `expected_${index + 1}`,
      kind: asString(item.kind),
      amount: amountFromValue(item.amount ?? item.price ?? item.display),
      display: asString(item.display) || displayForAmount(amountFromValue(item.amount ?? item.price)),
    }))
    .filter((item) => item.amount);
}

function rawInput(row = {}) {
  return compactText(row.input || row.raw_input || row.raw_input?.customer_text || row.input?.messy_input || "");
}

function buildWorkflowInput(inputText) {
  const literalTextCleanup = textCleanupNormalizer(inputText);
  const contact = normalizeContactFields({ rawText: inputText });
  const optionPriceCandidateView = buildOptionPriceCandidateView(inputText);
  const textCleanup = buildEvidenceBackedTextCleanupResult({
    textCleanupResult: literalTextCleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView,
  });
  const parserInput = buildPreNormalizerParserInput({
    textCleanupResult: textCleanup,
    contactNormalizationResult: contact,
    optionPriceCandidateView,
  });
  return {
    contact,
    optionPriceCandidateView,
    parserInput,
    intake: {
      name: contact.name?.value || "",
      phone: contact.phone?.display || contact.phone?.value || "",
      email: contact.email?.value || "",
      address: contact.address?.value || "",
    },
  };
}

function compactValidation(validation = {}) {
  return {
    can_generate_pdf: Boolean(validation.can_generate_pdf),
    blocking_errors: Array.isArray(validation.blocking_errors) ? validation.blocking_errors : [],
    follow_ups: Array.isArray(validation.follow_ups) ? validation.follow_ups : [],
    warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
  };
}

function finalPrices(alphaJson = {}) {
  return (alphaJson.service_options?.items || [])
    .map((option, index) => {
      const amount = amountFromOption(option);
      return {
        option_id: `replay_final_${index + 1}`,
        label: asString(option.label),
        title: asString(option.title || option.description),
        amount,
        display: asString(option.price?.display || displayForAmount(amount)),
        is_unclear: Boolean(option.price?.is_unclear),
      };
    })
    .filter((item) => item.amount);
}

function sidecarCandidates(optionPriceCandidateView = {}) {
  return (optionPriceCandidateView.pre_ai_option_price_candidate_clues?.money_like_numbers || []).map((candidate) => ({
    amount: Number(candidate.price_value) || null,
    display: candidate.price_display || "",
    amount_confidence: candidate.amount_confidence || candidate.confidence || "low",
    pairing_confidence: candidate.pairing_confidence || "unpaired",
    context: candidate.context || "",
  })).filter((item) => item.amount);
}

function sidecarPairings(optionPriceCandidateView = {}) {
  return (optionPriceCandidateView.pre_ai_option_price_candidate_clues?.option_price_pairings || []).map((pairing) => ({
    amount: Number(pairing.price_value) || null,
    label: pairing.label || "",
    description: pairing.description_raw || pairing.description || "",
    amount_confidence: pairing.amount_confidence || pairing.confidence || "low",
    pairing_confidence: pairing.pairing_confidence || pairing.confidence || "low",
  })).filter((item) => item.amount);
}

function rowMetrics(expected, prices, validation) {
  const matched = matchedAmountCount(expected, prices);
  const exact = exactAmountSet(expected, prices);
  const ready = Boolean(validation.can_generate_pdf);
  return {
    exact_expected_prices: exact,
    can_generate_pdf: ready,
    ready_and_correct: ready && exact,
    ready_but_wrong: ready && !exact,
    correct_but_blocked: !ready && exact,
    blocked_and_wrong: !ready && !exact,
    expected_price_count: expected.length,
    actual_price_count: prices.length,
    expected_match_count: matched,
    expected_amounts: expected.map((item) => item.amount),
    actual_amounts: prices.map((item) => item.amount),
    recall_pct: pctNumber(matched, expected.length),
    precision_pct: pctNumber(matched, prices.length),
  };
}

function replayRow(savedRow) {
  const inputText = rawInput(savedRow);
  const workflow = buildWorkflowInput(inputText);
  const parsed = parseOpenAiDraft(savedRow.current?.raw_openai_draft_json || {});
  const normalizerInput = openAiDraftToNormalizerInput(parsed.draft, {
    rawInput: inputText,
    intake: workflow.intake,
  });
  const alphaJson = reconcileSidecarPrices(
    applyContactNormalizationOverlay(
      normalizeToAlphaJsonV14(normalizerInput, inputText, workflow.intake),
      workflow.contact,
    ),
    workflow.optionPriceCandidateView,
  );
  const validation = validateAlphaJson(alphaJson);
  const prices = finalPrices(validation.alphaJson || alphaJson);
  const expected = expectedPairs(savedRow);
  const replayMetrics = rowMetrics(expected, prices, validation);
  const savedCurrentPrices = (savedRow.current?.final_td2_prices || []).map((price, index) => ({
    option_id: price.option_id || `saved_final_${index + 1}`,
    label: asString(price.label),
    title: asString(price.title),
    amount: amountFromValue(price.amount ?? price.display),
    display: asString(price.display) || displayForAmount(amountFromValue(price.amount)),
    is_unclear: Boolean(price.is_unclear),
  })).filter((item) => item.amount);
  const savedValidation = savedRow.current?.validation || {};
  const savedMetrics = rowMetrics(expected, savedCurrentPrices, savedValidation);

  return {
    id: savedRow.id || "",
    difficulty: savedRow.difficulty || "unknown",
    input: inputText,
    expected,
    saved_live_model_output: {
      source_path: INPUT_PATH,
      draft_model: savedRow.current?.draft_model || "",
      requested_model: savedRow.current?.draft_requested_model || "",
      openai_response_id: savedRow.current?.openai_response_id || "",
      parsed_draft_warnings: parsed.warnings || [],
    },
    saved_current_before_replay: {
      final_td2_prices: savedCurrentPrices,
      validation: compactValidation(savedValidation),
      metrics: savedMetrics,
    },
    replay_after_implementation: {
      alphaJson_after_normalization: validation.alphaJson || alphaJson,
      final_td2_prices: prices,
      validation: compactValidation(validation),
      metrics: replayMetrics,
      sidecar_price_candidates: sidecarCandidates(workflow.optionPriceCandidateView),
      sidecar_pairings: sidecarPairings(workflow.optionPriceCandidateView),
    },
    comparison: {
      exact_changed: savedMetrics.exact_expected_prices !== replayMetrics.exact_expected_prices,
      readiness_changed: savedMetrics.can_generate_pdf !== replayMetrics.can_generate_pdf,
      prices_changed: JSON.stringify(savedMetrics.actual_amounts) !== JSON.stringify(replayMetrics.actual_amounts),
      ready_wrong_fixed: savedMetrics.ready_but_wrong && !replayMetrics.ready_but_wrong,
      correct_blocked_fixed: savedMetrics.correct_but_blocked && replayMetrics.ready_and_correct,
      new_ready_wrong_regression: !savedMetrics.ready_but_wrong && replayMetrics.ready_but_wrong,
      new_correct_blocked_regression: savedMetrics.ready_and_correct && replayMetrics.correct_but_blocked,
    },
  };
}

function aggregate(rows, selector) {
  const totals = {
    rows: rows.length,
    expected_count: 0,
    expected_match_count: 0,
    actual_price_count: 0,
    exact_rows: 0,
    ready_rows: 0,
    ready_and_correct: 0,
    ready_but_wrong: 0,
    correct_but_blocked: 0,
    blocked_and_wrong: 0,
    blocking_rows: 0,
  };

  for (const row of rows) {
    const item = selector(row);
    const metrics = item.metrics;
    totals.expected_count += metrics.expected_price_count;
    totals.expected_match_count += metrics.expected_match_count;
    totals.actual_price_count += metrics.actual_price_count;
    totals.exact_rows += metrics.exact_expected_prices ? 1 : 0;
    totals.ready_rows += metrics.can_generate_pdf ? 1 : 0;
    totals.ready_and_correct += metrics.ready_and_correct ? 1 : 0;
    totals.ready_but_wrong += metrics.ready_but_wrong ? 1 : 0;
    totals.correct_but_blocked += metrics.correct_but_blocked ? 1 : 0;
    totals.blocked_and_wrong += metrics.blocked_and_wrong ? 1 : 0;
    totals.blocking_rows += item.validation.blocking_errors.length ? 1 : 0;
  }

  return {
    ...totals,
    exact_pct: pctNumber(totals.exact_rows, totals.rows),
    ready_pct: pctNumber(totals.ready_rows, totals.rows),
    recall_pct: pctNumber(totals.expected_match_count, totals.expected_count),
    precision_pct: pctNumber(totals.expected_match_count, totals.actual_price_count),
    ready_wrong_pct: pctNumber(totals.ready_but_wrong, totals.rows),
    correct_blocked_pct: pctNumber(totals.correct_but_blocked, totals.rows),
    blocking_pct: pctNumber(totals.blocking_rows, totals.rows),
  };
}

function bucketRows(rows) {
  return BUCKETS.map((bucket) => rows.filter((row) => (row.difficulty || "unknown") === bucket))
    .filter((rowsInBucket) => rowsInBucket.length);
}

function markdownTable(rows, headers) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function summaryLines(rows) {
  const saved = aggregate(rows, (row) => row.saved_current_before_replay);
  const replay = aggregate(rows, (row) => row.replay_after_implementation);
  const focusedRows = FOCUSED_IDS.map((id) => rows.find((row) => row.id === id)).filter(Boolean);

  const lines = [
    "# Production Replay From Saved 382 Live Outputs",
    "",
    `Saved live input: ${INPUT_PATH}`,
    `Rows replayed: ${rows.length}`,
    "",
    "## Overall",
    "",
    markdownTable([
      ["Exact expected prices", `${saved.exact_rows}/${saved.rows} (${pctText(saved.exact_rows, saved.rows)})`, `${replay.exact_rows}/${replay.rows} (${pctText(replay.exact_rows, replay.rows)})`],
      ["Expected-price recall", `${saved.expected_match_count}/${saved.expected_count} (${pctText(saved.expected_match_count, saved.expected_count)})`, `${replay.expected_match_count}/${replay.expected_count} (${pctText(replay.expected_match_count, replay.expected_count)})`],
      ["Final price precision", `${saved.expected_match_count}/${saved.actual_price_count} (${pctText(saved.expected_match_count, saved.actual_price_count)})`, `${replay.expected_match_count}/${replay.actual_price_count} (${pctText(replay.expected_match_count, replay.actual_price_count)})`],
      ["PDF ready", `${saved.ready_rows}/${saved.rows} (${pctText(saved.ready_rows, saved.rows)})`, `${replay.ready_rows}/${replay.rows} (${pctText(replay.ready_rows, replay.rows)})`],
      ["Ready but wrong", `${saved.ready_but_wrong}/${saved.rows} (${pctText(saved.ready_but_wrong, saved.rows)})`, `${replay.ready_but_wrong}/${replay.rows} (${pctText(replay.ready_but_wrong, replay.rows)})`],
      ["Correct but blocked", `${saved.correct_but_blocked}/${saved.rows} (${pctText(saved.correct_but_blocked, saved.rows)})`, `${replay.correct_but_blocked}/${replay.rows} (${pctText(replay.correct_but_blocked, replay.rows)})`],
      ["Blocked and wrong", `${saved.blocked_and_wrong}/${saved.rows} (${pctText(saved.blocked_and_wrong, saved.rows)})`, `${replay.blocked_and_wrong}/${replay.rows} (${pctText(replay.blocked_and_wrong, replay.rows)})`],
      ["Blocking rows", `${saved.blocking_rows}/${saved.rows} (${pctText(saved.blocking_rows, saved.rows)})`, `${replay.blocking_rows}/${replay.rows} (${pctText(replay.blocking_rows, replay.rows)})`],
    ], ["Metric", "Saved current run", "Replay after implementation"]),
    "",
    "## Change Counts",
    "",
    markdownTable([
      ["Ready-wrong fixed", rows.filter((row) => row.comparison.ready_wrong_fixed).length],
      ["Correct-blocked fixed", rows.filter((row) => row.comparison.correct_blocked_fixed).length],
      ["New ready-wrong regressions", rows.filter((row) => row.comparison.new_ready_wrong_regression).length],
      ["New correct-blocked regressions", rows.filter((row) => row.comparison.new_correct_blocked_regression).length],
      ["Rows with changed final price list", rows.filter((row) => row.comparison.prices_changed).length],
      ["Rows with changed readiness", rows.filter((row) => row.comparison.readiness_changed).length],
    ], ["Change", "Rows"]),
    "",
    "## Focused Observations",
    "",
    markdownTable(focusedRows.map((row) => {
      const before = row.saved_current_before_replay.metrics;
      const after = row.replay_after_implementation.metrics;
      return [
        row.id,
        before.actual_amounts.join(", ") || "none",
        after.actual_amounts.join(", ") || "none",
        before.can_generate_pdf ? "ready" : "blocked",
        after.can_generate_pdf ? "ready" : "blocked",
        after.exact_expected_prices ? "correct" : "wrong",
        row.replay_after_implementation.validation.blocking_errors.join("; ") || "none",
      ];
    }), ["Case", "Before prices", "After prices", "Before", "After", "After correctness", "After blockers"]),
    "",
    "## Buckets",
    "",
    markdownTable(bucketRows(rows).map((rowsInBucket) => {
      const bucket = rowsInBucket[0].difficulty || "unknown";
      const before = aggregate(rowsInBucket, (row) => row.saved_current_before_replay);
      const after = aggregate(rowsInBucket, (row) => row.replay_after_implementation);
      return [
        bucket,
        rowsInBucket.length,
        `${before.exact_rows} -> ${after.exact_rows}`,
        `${before.ready_rows} -> ${after.ready_rows}`,
        `${before.ready_but_wrong} -> ${after.ready_but_wrong}`,
        `${before.correct_but_blocked} -> ${after.correct_but_blocked}`,
        `${before.blocking_rows} -> ${after.blocking_rows}`,
      ];
    }), ["Bucket", "Rows", "Exact", "PDF ready", "Ready wrong", "Correct blocked", "Blocking rows"]),
    "",
    `Detail JSONL: ${OUT_PATH}`,
  ];
  return lines.join("\n");
}

function main() {
  let rows = readJsonl(INPUT_PATH);
  if (IDS.size) rows = rows.filter((row) => IDS.has(row.id));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  const replayed = rows.map(replayRow);
  writeJsonl(OUT_PATH, replayed);
  fs.writeFileSync(SUMMARY_PATH, `${summaryLines(replayed)}\n`, "utf8");
  console.log(JSON.stringify({ input: INPUT_PATH, output: OUT_PATH, summary: SUMMARY_PATH, rows: replayed.length }, null, 2));
}

main();
