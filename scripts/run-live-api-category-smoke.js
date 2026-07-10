import fs from "node:fs";
import path from "node:path";
import { buildCustomerJobSummary, normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { OPENAI_SYSTEM_PROMPT } from "../lib/openaiPrompt.js";
import { OPENAI_DRAFT_RESPONSE_FORMAT, parseOpenAiDraft } from "../lib/openaiDraftSchema.js";
import { openAiDraftToNormalizerInput } from "../lib/openaiDraftAdapter.js";

const REPORT_DIR = path.join(process.cwd(), "reports");
const REPLAY_PATH =
  process.env.LIVE_API_REPLAY_PATH ||
  path.join(REPORT_DIR, "replay-messy-inputs-2026-07-01_19-43-fresh-700-v2b.jsonl");
const DEFAULT_CASE_PLAN = [
  ["clean_baseline", 3],
  ["messy_job_description", 12],
  ["messy_service_address", 5],
  ["incomplete_ambiguous_address", 5],
  ["large_price_spread", 3],
  ["tree_count_tree_detail", 12],
  ["noise_heavy_notes", 10],
];

function casePlanFromEnv() {
  const rawPlan = process.env.LIVE_API_CASE_PLAN || "";
  if (!rawPlan.trim()) return DEFAULT_CASE_PLAN;

  return rawPlan.split(",").map((entry) => {
    const [category, countText] = entry.split(":").map((part) => part.trim());
    const count = Number(countText);
    if (!category || !Number.isInteger(count) || count < 1) {
      throw new Error(`Invalid LIVE_API_CASE_PLAN entry: ${entry}`);
    }
    return [category, count];
  });
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
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

function timestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function priceDisplays(alphaJson) {
  return (alphaJson.service_options?.items || []).map((option) => option.price?.display || "").filter(Boolean);
}

function includesAll(haystack, needles) {
  const text = String(haystack || "").toLowerCase();
  return needles.every((needle) => text.includes(String(needle).toLowerCase()));
}

function publicText(alphaJson, td2JobSummary) {
  return [
    alphaJson.normalization?.corrected_interpretation || "",
    alphaJson.job?.description || "",
    td2JobSummary || "",
    alphaJson.customer?.name || "",
    ...(alphaJson.service_options?.items || []).flatMap((option) => [option.title || "", option.description || ""]),
  ].join(" ");
}

function evaluate(caseItem, responseBody, validation, td2JobSummary) {
  const alphaJson = validation.alphaJson || responseBody.alphaJson || {};
  const expected = caseItem.expected || {};
  const findings = [];
  const address = alphaJson.job?.service_address?.display || "";
  const prices = priceDisplays(alphaJson);
  const warningsText = (validation.warnings || []).join(" | ");
  const followUpText = [...(validation.follow_ups || []), ...(validation.blocking_errors || [])].join(" | ");

  if (typeof expected.ready === "boolean" && validation.can_generate_pdf !== expected.ready) {
    findings.push({
      severity: 90,
      code: expected.ready ? "unexpected_block" : "unexpected_ready",
      message: `Expected can_generate_pdf=${expected.ready}, got ${validation.can_generate_pdf}.`,
    });
  }

  if (expected.addressIncludes?.length && !includesAll(address, expected.addressIncludes)) {
    findings.push({
      severity: 85,
      code: "address_mismatch",
      message: `Expected address to include ${expected.addressIncludes.join(", ")}; got ${JSON.stringify(address)}.`,
    });
  }

  for (const expectedPrice of expected.prices || []) {
    if (!prices.includes(expectedPrice)) {
      findings.push({
        severity: 75,
        code: "price_missing",
        message: `Expected price ${expectedPrice}; got ${prices.join(", ") || "no prices"}.`,
      });
    }
  }

  const treeCount = alphaJson.job?.tree_details?.tree_count || "";
  if (expected.treeCount && treeCount !== expected.treeCount) {
    findings.push({
      severity: 75,
      code: "tree_count_mismatch",
      message: `Expected tree_count ${JSON.stringify(expected.treeCount)}; got ${JSON.stringify(treeCount)}.`,
    });
  }

  const treeType = alphaJson.job?.tree_details?.tree_type || "";
  if (expected.treeType && treeType !== expected.treeType) {
    findings.push({
      severity: 60,
      code: "tree_type_mismatch",
      message: `Expected tree_type ${JSON.stringify(expected.treeType)}; got ${JSON.stringify(treeType)}.`,
    });
  }

  for (const patternText of expected.warningRegexes || []) {
    const pattern = new RegExp(patternText.source || patternText, "i");
    if (!pattern.test(warningsText)) {
      findings.push({
        severity: 55,
        code: "warning_missing",
        message: `Expected warning matching ${pattern}; got ${JSON.stringify(validation.warnings || [])}.`,
      });
    }
  }

  for (const patternText of expected.followUpRegexes || []) {
    const pattern = new RegExp(patternText.source || patternText, "i");
    if (!pattern.test(followUpText)) {
      findings.push({
        severity: 55,
        code: "followup_missing",
        message: `Expected follow-up/blocker matching ${pattern}; got ${JSON.stringify(validation.follow_ups || [])} / ${JSON.stringify(validation.blocking_errors || [])}.`,
      });
    }
  }

  if (expected.noCustomerLeakage && /Tree Dude note|sent from phone|text only|customer works nights|listed phone|example\.com|812-555|Follow-up/i.test(publicText(alphaJson, td2JobSummary))) {
    findings.push({
      severity: 65,
      code: "customer_facing_noise_leakage",
      message: "TD2-facing text appears to include contact, raw-note, or workflow noise.",
    });
  }

  findings.sort((a, b) => b.severity - a.severity || a.code.localeCompare(b.code));
  return findings;
}

function loadReplayCases() {
  const rows = fs.readFileSync(REPLAY_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return casePlanFromEnv().flatMap(([category, count]) =>
    rows
      .filter((row) => row.category === category)
      .slice(0, count)
      .map((row, index) => ({
        ...row,
        case_id: `LIVEapi-${category}-${String(index + 1).padStart(2, "0")}`,
        source_case_id: row.case_id,
      })),
  );
}

function tokenUsageFromResponse(response) {
  const usage = response?.usage || {};
  return {
    input_tokens: usage.prompt_tokens ?? null,
    output_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
  };
}

async function callOpenAi(caseItem, client) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-nano";
  const response = await client.chat.completions.create({
    model,
    response_format: OPENAI_DRAFT_RESPONSE_FORMAT,
    messages: [
      {
        role: "system",
        content: OPENAI_SYSTEM_PROMPT,
      },
      { role: "user", content: caseItem.raw_input },
    ],
  });
  const rawText = response.choices[0]?.message?.content || "{}";
  return {
    model,
    usage: tokenUsageFromResponse(response),
    rawOpenAiDraftJson: JSON.parse(rawText),
  };
}

function summarize(records) {
  const categories = [...new Set(records.map((record) => record.category))];
  return {
    total: records.length,
    passed: records.filter((record) => record.pass).length,
    failed: records.filter((record) => !record.pass).length,
    openai_used: records.filter((record) => !record.mocked).length,
    mocked_or_fallback: records.filter((record) => record.mocked).length,
    by_category: Object.fromEntries(
      categories.map((category) => {
        const items = records.filter((record) => record.category === category);
        const failureCounts = {};
        for (const record of items) {
          for (const finding of record.findings || []) {
            failureCounts[finding.code] = (failureCounts[finding.code] || 0) + 1;
          }
        }
        return [
          category,
          {
            total: items.length,
            passed: items.filter((record) => record.pass).length,
            failed: items.filter((record) => !record.pass).length,
            top_findings: Object.entries(failureCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => ({ code, count })),
          },
        ];
      }),
    ),
  };
}

function renderMarkdown(summary, records, paths) {
  const lines = [];
  lines.push("# LIVEapi Smoke Test Summary");
  lines.push("");
  lines.push("Live OpenAI API run against the local API route using the current local code.");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push(`- Inputs: ${paths.inputsPath}`);
  lines.push(`- Results JSONL: ${paths.resultsPath}`);
  lines.push(`- GPT raw-input CSV: ${paths.csvPath}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cases: ${summary.total}`);
  lines.push(`- Passed: ${summary.passed}`);
  lines.push(`- Failed: ${summary.failed}`);
  lines.push(`- OpenAI used: ${summary.openai_used}`);
  lines.push(`- Local fallback/mock: ${summary.mocked_or_fallback}`);
  lines.push("");
  lines.push("## Category Results");
  lines.push("");
  lines.push("| Category | Passed | Failed | Top findings |");
  lines.push("|---|---:|---:|---|");
  for (const [category, item] of Object.entries(summary.by_category)) {
    const top = item.top_findings.map((finding) => `${finding.code} ${finding.count}`).join(", ") || "none";
    lines.push(`| ${category} | ${item.passed}/${item.total} | ${item.failed}/${item.total} | ${top} |`);
  }
  lines.push("");
  lines.push("## Failing Cases");
  lines.push("");
  lines.push("| Case | Category | Main finding | TD2 summary | Needs more info | Warnings |");
  lines.push("|---|---|---|---|---|---|");
  const failures = records.filter((record) => !record.pass);
  if (!failures.length) {
    lines.push("| none | none | none | none | none | none |");
  } else {
    failures.forEach((record) => {
      const finding = record.findings?.[0];
      lines.push(
        [
          record.case_id,
          record.category,
          finding ? `${finding.code}: ${finding.message}` : "",
          record.td2_rendered_fields.job_summary,
          record.validation.follow_ups.join("; ") || record.validation.blocking_errors.join("; "),
          record.validation.warnings.join("; "),
        ].map((value) => String(value || "").replace(/\|/g, "\\|")).join(" | ").replace(/^/, "| ").replace(/$/, " |"),
      );
    });
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

loadEnvLocal();
process.env.DEBUG_PIPELINE = "true";
fs.mkdirSync(REPORT_DIR, { recursive: true });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not available. Live API test would use fallback instead of OpenAI.");
}

const stamp = timestamp();
const cases = loadReplayCases();
const label = `${stamp}-${cases.length}cases`;
const records = [];
const { default: OpenAI } = await import("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

for (const [index, caseItem] of cases.entries()) {
  console.log(`LIVEapi ${index + 1}/${cases.length} ${caseItem.case_id}`);
  let apiResult = {};
  let alphaJson = {};
  let validation = {};
  let td2JobSummary = "";
  let findings = [];

  try {
    apiResult = await callOpenAi(caseItem, client);
    const parsedDraft = parseOpenAiDraft(apiResult.rawOpenAiDraftJson);
    const normalizerInput = openAiDraftToNormalizerInput(parsedDraft.draft, { rawInput: caseItem.raw_input });
    alphaJson = normalizeToAlphaJsonV14(normalizerInput, caseItem.raw_input);
    validation = validateAlphaJson(alphaJson);
    td2JobSummary = buildCustomerJobSummary(validation.alphaJson || alphaJson);
    findings = evaluate(caseItem, { alphaJson }, validation, td2JobSummary);
  } catch (error) {
    alphaJson = normalizeToAlphaJsonV14({}, caseItem.raw_input);
    validation = validateAlphaJson(alphaJson);
    td2JobSummary = buildCustomerJobSummary(validation.alphaJson || alphaJson);
    findings = [{ severity: 100, code: "api_error", message: error?.message || String(error) }];
    apiResult = { model: process.env.OPENAI_MODEL || "gpt-4.1-nano", usage: null, rawOpenAiDraftJson: null, error: error?.message || String(error) };
  }

  records.push({
    case_id: caseItem.case_id,
    source_case_id: caseItem.source_case_id,
    category: caseItem.category,
    raw_input: caseItem.raw_input,
    expected: caseItem.expected,
    pass: findings.length === 0,
    max_severity: findings[0]?.severity || 0,
    findings,
    model: apiResult.model || process.env.OPENAI_MODEL || "gpt-4.1-nano",
    token_usage: apiResult.usage || null,
    mocked: Boolean(apiResult.error),
    api_error: apiResult.error || "",
    raw_openai_draft_json: apiResult.rawOpenAiDraftJson || null,
    cleaned_canonical_alphaJson: validation.alphaJson || alphaJson,
    validation: {
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors || [],
      follow_ups: validation.follow_ups || [],
      warnings: validation.warnings || [],
    },
    td2_rendered_fields: {
      customer_name: validation.alphaJson?.customer?.name || alphaJson.customer?.name || "",
      customer_phone: validation.alphaJson?.customer?.phone_display || alphaJson.customer?.phone_display || "",
      customer_email: validation.alphaJson?.customer?.email || alphaJson.customer?.email || "",
      service_address: validation.alphaJson?.job?.service_address?.display || alphaJson.job?.service_address?.display || "",
      job_summary: td2JobSummary,
      quote_options: ((validation.alphaJson || alphaJson).service_options?.items || []).map((option) => ({
        label: option.label || "",
        title: option.title || "",
        description: option.description || "",
        price_display: option.price?.display || "",
      })),
      warnings: validation.warnings || [],
      needs_more_info: validation.follow_ups?.length ? validation.follow_ups : validation.blocking_errors || [],
    },
  });
}

const summary = summarize(records);
const inputsPath = path.join(REPORT_DIR, `LIVEapi-inputs-${label}.jsonl`);
const resultsPath = path.join(REPORT_DIR, `LIVEapi-results-${label}.jsonl`);
const csvPath = path.join(REPORT_DIR, `LIVEapi-gpt-raw-inputs-${label}.csv`);
const mdPath = path.join(REPORT_DIR, `LIVEapi-summary-${label}.md`);

fs.writeFileSync(inputsPath, `${cases.map((item) => JSON.stringify(item)).join("\n")}\n`);
fs.writeFileSync(resultsPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
fs.writeFileSync(csvPath, `case_id,category,raw_input\n${cases.map((item) => `${csvEscape(item.case_id)},${csvEscape(item.category)},${csvEscape(item.raw_input)}`).join("\n")}\n`);
fs.writeFileSync(mdPath, renderMarkdown(summary, records, { inputsPath, resultsPath, csvPath }));

console.log(JSON.stringify({ summary, files: { inputsPath, resultsPath, csvPath, mdPath } }, null, 2));
