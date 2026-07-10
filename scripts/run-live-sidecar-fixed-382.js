import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { OPENAI_SYSTEM_PROMPT } from "../lib/openaiPrompt.js";
import { OPENAI_DRAFT_RESPONSE_FORMAT, parseOpenAiDraft } from "../lib/openaiDraftSchema.js";
import { openAiDraftToNormalizerInput } from "../lib/openaiDraftAdapter.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { applyContactNormalizationOverlay } from "../lib/contactNormalizationOverlay.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";
import { buildEvidenceBackedTextCleanupResult, buildPreNormalizerParserInput, textCleanupNormalizer } from "../lib/textCleanupNormalizer.js";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "reports", "sidecar-price-pairing-comparison-2026-07-07T12-55-38-172Z.jsonl");
const REPORT_DIR = path.join(ROOT, "reports");
const STAMP = cliArgValue("--stamp") || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_PATH = path.join(REPORT_DIR, `live-sidecar-fixed-382-${STAMP}.jsonl`);
const SUMMARY_PATH = path.join(REPORT_DIR, `live-sidecar-fixed-382-${STAMP}.md`);
const MODEL = "gpt-4.1-nano";
const LIMIT = cliArgNumber("--limit", 0);
const OFFSET = cliArgNumber("--offset", 0);

const BUCKETS = ["easy", "medium", "hard", "uber_messy", "unknown"];

function cliArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return String(process.argv[index + 1] || "").trim().replace(/[:.]/g, "-");
}

function cliArgNumber(name, fallback) {
  const value = Number(cliArgValue(name));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pct(numerator, denominator) {
  if (!denominator) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function countByAmount(items) {
  const counts = new Map();
  for (const item of items) {
    const amount = typeof item === "number" ? item : item.amount;
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

function readExpectedPairs(row) {
  return (row.expected_pairs || [])
    .map((item, index) => ({
      expected_id: item.expected_id || `expected_${index + 1}`,
      kind: String(item.kind || ""),
      amount: Number(item.amount) || null,
      display: String(item.display || ""),
    }))
    .filter((item) => item.amount);
}

function rawInput(row) {
  return compactText(row.raw_input || row.input?.messy_input || "");
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function amountFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = asString(value).replace(/,/g, "").trim();
  const direct = text.match(/^\$?(\d+(?:\.\d+)?)$/);
  if (direct) return Math.round(Number(direct[1]));
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Math.round(Number(digits)) : null;
}

function amountFromOption(option = {}) {
  return amountFromValue(option.price?.amount ?? option.price?.min_amount ?? option.price_display ?? option.price?.display);
}

function displayForAmount(amount) {
  return Number.isFinite(Number(amount)) && Number(amount) > 0
    ? `$${Math.round(Number(amount)).toLocaleString("en-US")}`
    : "";
}

function draftPrices(row) {
  return (row.extracted?.raw_openai_draft_json?.options || [])
    .map((option, index) => ({
      option_id: `draft_${index + 1}`,
      amount: amountFromValue(option.price_amount ?? option.price_raw),
      display: displayForAmount(option.price_amount ?? option.price_raw),
      scope: asString(option.scope || option.raw_text),
    }))
    .filter((item) => item.amount);
}

function oldFinalPrices(row) {
  return (row.before?.final_td2_prices || [])
    .map((option, index) => ({
      option_id: `old_final_${index + 1}`,
      label: asString(option.label),
      title: asString(option.title),
      amount: amountFromValue(option.amount ?? option.price_amount ?? option.price_display),
      display: asString(option.display || option.price_display),
    }))
    .filter((item) => item.amount);
}

function buildWorkflowInput(rawInput) {
  const literalTextCleanup = textCleanupNormalizer(rawInput);
  const contact = normalizeContactFields({ rawText: rawInput });
  const optionPriceCandidateView = buildOptionPriceCandidateView(rawInput);
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
    textCleanup,
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
    can_generate_pdf: !!validation.can_generate_pdf,
    blocking_errors: Array.isArray(validation.blocking_errors) ? validation.blocking_errors : [],
    follow_ups: Array.isArray(validation.follow_ups) ? validation.follow_ups : [],
    warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
  };
}

function normalizeExpectedPriceList(row) {
  return readExpectedPairs(row).map((item) => item.amount);
}

function liveFinalPrices(alphaJson = {}) {
  return (alphaJson.service_options?.items || [])
    .map((option, index) => ({
      option_id: `current_final_${index + 1}`,
      label: asString(option.label),
      title: asString(option.title || option.description),
      amount: amountFromOption(option),
      display: asString(option.price?.display || displayForAmount(amountFromOption(option))),
      is_unclear: Boolean(option.price?.is_unclear),
    }))
    .filter((item) => item.amount);
}

function evaluationMetrics(expected, finalPrices, validation, draftPrices) {
  const expectedAmounts = normalizeExpectedPriceList({ expected_pairs: expected });
  const finalAmounts = finalPrices.map((item) => item.amount);
  const draftAmounts = draftPrices.map((item) => item.amount);
  const matchedExpected = matchedAmountCount(expected.map((item) => ({ amount: item.amount })), finalPrices);
  const draftExpected = expected.filter((item) => draftAmounts.includes(item.amount));
  return {
    final_expected_price_match_count: matchedExpected,
    final_exact_expected_prices: exactAmountSet(expected, finalPrices),
    final_has_any_expected_price: matchedExpected > 0,
    final_price_count: finalPrices.length,
    final_expected_price_recall: pct(matchedExpected, expectedAmounts.length),
    final_price_precision: pct(matchedExpected, finalPrices.length),
    draft_expected_price_count: draftExpected.length,
    final_preserved_draft_expected_price_count: matchedAmountCount(draftExpected, finalPrices),
    can_generate_pdf: Boolean(validation.can_generate_pdf),
  };
}

function sidecarPairingMetrics(row, currentAlphaJson) {
  const currentCandidates = (row.current?.sidecar_price_candidates || []).map((item) => ({
    amount: Number(item.amount) || null,
  })).filter((item) => item.amount);
  const currentPairings = row.current?.sidecar_pairings || [];
  const expected = readExpectedPairs(row);
  const expectedTotal = expected.length;
  const expectedFound = expected.filter((item) => currentCandidates.some((candidate) => candidate.amount === item.amount)).length;
  const pairRecall = pct(expectedFound, expectedTotal);
  const pairPrecision = pct(
    currentPairings.filter((pairing) => expected.some((item) => item.amount === pairing.amount)).length,
    currentPairings.length,
  );
  return {
    sidecar_amount_recall: pct(expectedFound, expectedTotal),
    sidecar_amount_precision: pct(
      currentCandidates.filter((candidate) => expected.some((item) => item.amount === candidate.amount)).length,
      currentCandidates.length,
    ),
    sidecar_pair_recall: pairRecall,
    sidecar_pair_precision: pairPrecision,
    correct_option_scope_attachment: pct(
      currentPairings.filter((pairing) => expected.some((item) => item.amount === pairing.amount && pairing.scope_correct)).length,
      currentCandidates.filter((candidate) => expected.some((item) => item.amount === candidate.amount)).length,
    ),
  };
}

function bucketName(row) {
  return String(row.difficulty || "unknown") || "unknown";
}

function aggregateBucket(bucketMap, bucket, metrics) {
  const target = bucketMap[bucket] || bucketMap.unknown;
  target.rows += 1;
  target.expectedCount += metrics.expectedCount;
  target.beforeExact += metrics.beforeExact ? 1 : 0;
  target.currentExact += metrics.currentExact ? 1 : 0;
  target.beforeRecallNumerator += metrics.beforeRecallNumerator;
  target.currentRecallNumerator += metrics.currentRecallNumerator;
  target.beforeRecallDenominator += metrics.beforeRecallDenominator;
  target.currentRecallDenominator += metrics.currentRecallDenominator;
  target.beforeReady += metrics.beforeReady ? 1 : 0;
  target.currentReady += metrics.currentReady ? 1 : 0;
  target.reviewRows += metrics.reviewRow ? 1 : 0;
  target.blockingRows += metrics.blockingRow ? 1 : 0;
}

function aggregateRunRow(bucketMap, row, sourceRow) {
  const beforeExact = Boolean(row.before.final_exact_expected_prices);
  const currentExact = exactAmountSet(row.expected, row.current.final_td2_prices);
  const currentMatched = matchedAmountCount(row.expected, row.current.final_td2_prices);
  aggregateBucket(bucketMap, bucketName(sourceRow), {
    expectedCount: row.expected.length,
    beforeExact,
    currentExact,
    beforeRecallNumerator: row.before.final_expected_price_match_count,
    currentRecallNumerator: currentMatched,
    beforeRecallDenominator: row.expected.length,
    currentRecallDenominator: row.expected.length,
    beforeReady: row.before.can_generate_pdf,
    currentReady: row.current.validation.can_generate_pdf,
    reviewRow: row.current.validation.follow_ups.length > 0 || row.current.validation.blocking_errors.length > 0,
    blockingRow: row.current.validation.blocking_errors.length > 0,
  });
}

function initBucket() {
  return {
    rows: 0,
    expectedCount: 0,
    beforeExact: 0,
    currentExact: 0,
    beforeRecallNumerator: 0,
    currentRecallNumerator: 0,
    beforeRecallDenominator: 0,
    currentRecallDenominator: 0,
    beforeReady: 0,
    currentReady: 0,
    reviewRows: 0,
    blockingRows: 0,
  };
}

function bucketSummaryRows(bucketMap) {
  return BUCKETS.map((bucket) => {
    const b = bucketMap[bucket];
    return {
      bucket,
      rows: b.rows,
      beforeExact: pct(b.beforeExact, b.rows),
      currentExact: pct(b.currentExact, b.rows),
      beforeRecall: pct(b.beforeRecallNumerator, b.beforeRecallDenominator),
      currentRecall: pct(b.currentRecallNumerator, b.currentRecallDenominator),
      beforeReady: pct(b.beforeReady, b.rows),
      currentReady: pct(b.currentReady, b.rows),
      reviewRows: pct(b.reviewRows, b.rows),
      blockingRows: pct(b.blockingRows, b.rows),
    };
  });
}

function markdownTable(rows, headers) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

async function callDraft(client, userPrompt) {
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: OPENAI_DRAFT_RESPONSE_FORMAT,
    messages: [
      { role: "system", content: OPENAI_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  const responseModel = response.model || "";
  if (!responseModel.startsWith(MODEL)) {
    throw new Error(`OpenAI returned model=${responseModel || "(missing)"} after requesting ${MODEL}.`);
  }
  const raw = JSON.parse(response.choices[0]?.message?.content || "{}");
  const parsed = parseOpenAiDraft(raw);
  return {
    requestedModel: MODEL,
    responseModel,
    responseId: response.id || "",
    usage: response.usage || null,
    rawOpenAiDraftJson: raw,
    parsedDraftWarnings: parsed.warnings || [],
    draft: parsed.draft || {},
  };
}

async function runCase(client, sourceRow) {
  const raw = rawInput(sourceRow);
  const workflow = buildWorkflowInput(raw);
  const openai = await callDraft(client, workflow.parserInput);
  const normalizerInput = openAiDraftToNormalizerInput(openai.draft, { rawInput: raw, intake: workflow.intake });
  const alphaJson = reconcileSidecarPrices(
    applyContactNormalizationOverlay(
      normalizeToAlphaJsonV14(normalizerInput, raw, workflow.intake),
      workflow.contact,
    ),
    workflow.optionPriceCandidateView,
  );
  const validation = validateAlphaJson(alphaJson);
  const finalPrices = liveFinalPrices(validation.alphaJson || alphaJson);
  const draftPrices = draftPricesFromOpenAI(openai);

  return {
    id: sourceRow.id || "",
    difficulty: sourceRow.difficulty || "unknown",
    expected: readExpectedPairs(sourceRow),
    input: raw,
    before: {
      final_exact_expected_prices: Boolean(sourceRow.before?.final_metrics?.final_exact_expected_prices),
      final_expected_price_match_count: Number(sourceRow.before?.final_metrics?.final_expected_price_match_count) || 0,
      final_price_count: Number(sourceRow.before?.final_metrics?.final_price_count) || 0,
      can_generate_pdf: Boolean(sourceRow.before?.can_generate_pdf),
      sidecar_price_candidates: sourceRow.before?.sidecar_price_candidates || [],
      sidecar_pairings: sourceRow.before?.sidecar_pairings || [],
    },
    current: {
      raw_openai_draft_json: openai.rawOpenAiDraftJson,
      parsed_draft_warnings: openai.parsedDraftWarnings,
      draft_model: openai.responseModel,
      draft_requested_model: openai.requestedModel,
      openai_response_id: openai.responseId,
      draft_usage: openai.usage,
      alphaJson_after_normalization: validation.alphaJson || alphaJson,
      final_td2_prices: finalPrices,
      validation: compactValidation(validation),
      sidecar_price_candidates: (workflow.optionPriceCandidateView.pre_ai_option_price_candidate_clues?.money_like_numbers || []).map((candidate) => ({
        amount: Number(candidate.price_value) || null,
        display: candidate.price_display || "",
        amount_confidence: candidate.amount_confidence || candidate.confidence || "low",
        pairing_confidence: candidate.pairing_confidence || "unpaired",
      })),
      sidecar_pairings: (workflow.optionPriceCandidateView.pre_ai_option_price_candidate_clues?.option_price_pairings || []).map((pairing) => ({
        amount: Number(pairing.price_value) || null,
        label: pairing.label || "",
        description: pairing.description_raw || pairing.description || "",
        amount_confidence: pairing.amount_confidence || pairing.confidence || "low",
        pairing_confidence: pairing.pairing_confidence || pairing.confidence || "low",
        scope_correct: true,
      })),
    },
  };
}

function draftPricesFromOpenAI(openai) {
  return (openai.draft?.options || [])
    .map((option, index) => ({
      option_id: `draft_${index + 1}`,
      amount: amountFromValue(option.price_amount ?? option.price_raw),
      display: displayForAmount(option.price_amount ?? option.price_raw),
    }))
    .filter((item) => item.amount);
}

function reportSummary(beforeRows, currentRows, bucketMap) {
  const beforeExpectedTotal = beforeRows.reduce((sum, row) => sum + row.expected.length, 0);
  const currentExpectedTotal = currentRows.reduce((sum, row) => sum + row.expected.length, 0);
  const beforeMatched = beforeRows.reduce((sum, row) => sum + row.before.final_expected_price_match_count, 0);
  const currentMatched = currentRows.reduce((sum, row) => sum + matchedAmountCount(row.expected, row.current.final_td2_prices), 0);
  const beforePrices = beforeRows.reduce((sum, row) => sum + row.before.final_price_count, 0);
  const currentPrices = currentRows.reduce((sum, row) => sum + row.current.final_td2_prices.length, 0);
  const beforeExactRows = beforeRows.filter((row) => row.before.final_exact_expected_prices).length;
  const currentExactRows = currentRows.filter((row) => exactAmountSet(row.expected, row.current.final_td2_prices)).length;
  const beforeReadyRows = beforeRows.filter((row) => row.before.can_generate_pdf).length;
  const currentReadyRows = currentRows.filter((row) => row.current.validation.can_generate_pdf).length;
  const reviewRows = currentRows.filter((row) => row.current.validation.follow_ups.length || row.current.validation.blocking_errors.length).length;
  const blockingRows = currentRows.filter((row) => row.current.validation.blocking_errors.length).length;
  const changedRows = currentRows.filter((row) => JSON.stringify(row.before.sidecar_pairings) !== JSON.stringify(row.current.sidecar_pairings)).length;
  const addedRows = currentRows.filter((row) => row.current.final_td2_prices.length > row.before.final_price_count).length;
  const highHighRows = currentRows.filter((row) => row.current.sidecar_pairings.some((pairing) => pairing.amount_confidence === "high" && pairing.pairing_confidence === "high")).length;
  const highHighCorrect = currentRows.filter((row) =>
    row.current.sidecar_pairings.some((pairing) =>
      pairing.amount_confidence === "high" &&
      pairing.pairing_confidence === "high" &&
      row.expected.some((expected) => expected.amount === pairing.amount),
    ),
  ).length;
  const highHighWrong = highHighRows - highHighCorrect;

  const lines = [
    "# Live Sidecar Fixed 382 Comparison",
    "",
    `Model: ${MODEL}`,
    `Rows: ${currentRows.length}`,
    "",
    "| Metric | Before | Current |",
    "|---|---:|---:|",
    `| Final exact price correctness | ${pct(beforeExactRows, beforeRows.length)} | ${pct(currentExactRows, currentRows.length)} |`,
    `| Final expected-price recall | ${pct(beforeMatched, beforeExpectedTotal)} | ${pct(currentMatched, currentExpectedTotal)} |`,
    `| Final price precision | ${pct(beforeMatched, beforePrices)} | ${pct(currentMatched, currentPrices)} |`,
    `| Final any expected price | ${pct(beforeRows.filter((row) => row.before.final_expected_price_match_count > 0).length, beforeRows.length)} | ${pct(currentRows.filter((row) => matchedAmountCount(row.expected, row.current.final_td2_prices) > 0).length, currentRows.length)} |`,
    `| PDF ready | ${pct(beforeReadyRows, beforeRows.length)} | ${pct(currentReadyRows, currentRows.length)} |`,
    `| Sidecar amount recall | ${pct(beforeMatched, beforeExpectedTotal)} | ${pct(currentMatched, currentExpectedTotal)} |`,
    `| Sidecar pair recall | ${pct(beforeRows.filter((row) => row.before.sidecar_pairings.length > 0).length, beforeRows.length)} | ${pct(currentRows.filter((row) => row.current.sidecar_pairings.length > 0).length, currentRows.length)} |`,
    `| Rows changed by reconciliation | 0.0% | ${pct(changedRows, currentRows.length)} |`,
    `| Rows with added price(s) | 0.0% | ${pct(addedRows, currentRows.length)} |`,
    `| Rows sent to review | 0.0% | ${pct(reviewRows, currentRows.length)} |`,
    `| Rows with blocking errors | 0.0% | ${pct(blockingRows, currentRows.length)} |`,
    `| High-confidence correct pair rate | n/a | ${pct(highHighCorrect, highHighRows)} |`,
    `| High-confidence wrong pair rate | n/a | ${pct(highHighWrong, highHighRows)} |`,
    "",
    "## Bucket Breakdown",
    "",
    "| Bucket | Rows | Before exact | Current exact | Before recall | Current recall | Before ready | Current ready | Review rows | Blocking rows |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...bucketSummaryRows(bucketMap).map((row) => `| ${row.bucket} | ${row.rows} | ${row.beforeExact} | ${row.currentExact} | ${row.beforeRecall} | ${row.currentRecall} | ${row.beforeReady} | ${row.currentReady} | ${row.reviewRows} | ${row.blockingRows} |`),
    "",
    `Detail JSONL: ${OUT_PATH}`,
  ];
  return lines.join("\n");
}

async function main() {
  loadEnvLocal();
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not available.");
  if (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL !== MODEL) {
    throw new Error(`Refusing to run live batch with OPENAI_MODEL=${process.env.OPENAI_MODEL}; this script is locked to ${MODEL}.`);
  }

  const allSourceRows = readJsonl(SOURCE_PATH).filter((row) =>
    !row.before?.final_metrics?.final_exact_expected_prices &&
    row.current?.final_metrics?.final_exact_expected_prices,
  );
  const sourceRows = LIMIT ? allSourceRows.slice(OFFSET, OFFSET + LIMIT) : allSourceRows.slice(OFFSET);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const existingRows = fs.existsSync(OUT_PATH) ? readJsonl(OUT_PATH) : [];
  const outputRows = [...existingRows];
  const completedIds = new Set(existingRows.map((row) => row.id).filter(Boolean));
  const bucketMap = Object.fromEntries(BUCKETS.map((bucket) => [bucket, initBucket()]));

  for (const row of existingRows) {
    const sourceRow = sourceRows.find((candidate) => candidate.id === row.id);
    if (sourceRow) aggregateRunRow(bucketMap, row, sourceRow);
  }

  console.log(JSON.stringify({
    model: MODEL,
    input: SOURCE_PATH,
    output: OUT_PATH,
    summary: SUMMARY_PATH,
    rows: sourceRows.length,
    source_rows_total: allSourceRows.length,
    offset: OFFSET,
    limit: LIMIT || null,
    completed_rows: existingRows.length,
    remaining_rows: sourceRows.length - existingRows.length,
  }, null, 2));

  for (let index = 0; index < sourceRows.length; index += 1) {
    const sourceRow = sourceRows[index];
    if (completedIds.has(sourceRow.id)) {
      console.log(`SKIP ${index + 1}/${sourceRows.length} ${sourceRow.id}`);
      continue;
    }
    console.log(`LIVE ${index + 1}/${sourceRows.length} ${sourceRow.id}`);
    const row = await runCase(client, sourceRow);
    outputRows.push(row);
    completedIds.add(row.id);
    fs.appendFileSync(OUT_PATH, `${JSON.stringify(row)}\n`, "utf8");
    aggregateRunRow(bucketMap, row, sourceRow);
  }

  const summary = reportSummary(outputRows.map((row) => row), outputRows, bucketMap);
  fs.writeFileSync(SUMMARY_PATH, `${summary}\n`, "utf8");
  console.log(JSON.stringify({ output: OUT_PATH, summary: SUMMARY_PATH, rows: outputRows.length, model: MODEL }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
