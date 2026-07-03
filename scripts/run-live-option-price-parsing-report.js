import fs from "node:fs";
import path from "node:path";
import { buildPriceInstrumentation } from "../lib/priceInstrumentation.js";

const BASE_URL = process.env.ALPHA_LIVE_BASE_URL || "https://tree-service-web-app.vercel.app";
const REPORT_DIR = path.join(process.cwd(), "reports");

const cases = [
  {
    case_id: "price-clear-option-a-b",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_present",
    raw_input:
      "Ava Reed 812-555-0101 ava@example.com. 410 Spruce Ct Madison IN. Remove one maple tree near garage. Option A remove only $1200. Option B remove haul away and cleanup $2200.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$1,200", "$2,200"],
      should_block_for_price: false,
    },
  },
  {
    case_id: "price-clear-single-quote",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_present",
    raw_input:
      "Ben Clay 812-555-0102 ben@example.com. 77 Oak Lane Hanover IN. Remove one oak tree by driveway. Quote is $1650 haul away included.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$1,650"],
      should_block_for_price: false,
    },
  },
  {
    case_id: "price-clear-no-dollar-sign",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_present",
    raw_input:
      "Cara Mills 812-555-0103 cara@example.com. 88 Maple Ave Salem IN. Remove one pine tree. Option A drop only 1400. Option B drop and haul away 2300.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$1,400", "$2,300"],
      should_block_for_price: false,
    },
  },
  {
    case_id: "price-clear-large-phone-no-confusion",
    dataset_name: "live-option-price-parsing-v1",
    group: "phone_number_not_price",
    raw_input:
      "Drew Moss 812-555-2400 drew@example.com. 2400 Cedar Dr Corydon IN. Remove one cedar tree by shed. Option A cut and leave wood $900. Option B remove and haul $1500.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$900", "$1,500"],
      should_block_for_price: false,
      excluded_numbers_should_include: ["812-555-2400", "2400"],
    },
  },
  {
    case_id: "price-missing-option-basic",
    dataset_name: "live-option-price-parsing-v1",
    group: "no_usable_price_in_input",
    raw_input:
      "Ella Knox 812-555-0105 ella@example.com. 421 Main St Paoli IN. Remove two oak trees and haul away. Option A basic removal.",
    expected: {
      usable_price_in_input: false,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-missing-price-from-yesterday",
    dataset_name: "live-option-price-parsing-v1",
    group: "no_usable_price_in_input",
    raw_input:
      "Finn Hale 812-555-0106 finn@example.com. 300 Pine Ridge Columbus IN. Tree job from last visit, use price from yesterday.",
    expected: {
      usable_price_in_input: false,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-missing-call-customer",
    dataset_name: "live-option-price-parsing-v1",
    group: "no_usable_price_in_input",
    raw_input:
      "Gina Price 812-555-0107 gina@example.com. 66 Field Rd Columbus IN. Remove one elm tree. Need Tree Dude to call customer with price later.",
    expected: {
      usable_price_in_input: false,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-vague-around-2k",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Hank Bell 812-555-0108 hank@example.com. 40 Walnut St Corydon IN. Remove one walnut tree, around 2k, Tree Dude needs to confirm.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-vague-maybe-1900",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Ivy Stone 812-555-0109 ivy@example.com. 77 Birch Ave Seymour IN. Remove two birch trees, maybe 1900, not sure if cleanup included.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-conditional-if-simple",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Jake Fox 812-555-0110 jake@example.com. 91 Poplar Dr Bedford IN. Might be one tree or several trees along back fence. $2200 if simple.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-conditional-depends",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Kim Fox 812-555-1414 kim@example.com. 909 Ridge Rd Salem IN. Remove a dead oak tree. Price depends if crane is needed.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-placeholder",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Liam Hart 812-555-2727 liam@example.com. 56 State Road 7 North Vernon IN. Remove several trees near driveway. $3500 placeholder.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-scope-cleanup-conditional",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_with_ambiguous_scope",
    raw_input:
      "Mara Lane 812-555-1515 mara@example.com. 39 Sycamore St Bedford IN. Remove two sycamores. $2400 leave wood, clean it up if they want.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$2,400"],
      should_block_for_price: false,
      should_block_for_scope: true,
    },
  },
  {
    case_id: "price-stump-maybe",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_with_ambiguous_scope",
    raw_input:
      "Nina Patel 812-555-1516 nina@example.com. 87 Cherry Lane Charlestown IN. Remove one cherry tree for $1300, stump maybe included.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$1,300"],
      should_block_for_price: false,
      should_block_for_scope: true,
    },
  },
  {
    case_id: "price-clear-three-options",
    dataset_name: "live-option-price-parsing-v1",
    group: "firm_price_present",
    raw_input:
      "Owen Park 812-555-1617 owen@example.com. 112 Hickory Way Madison IN. Remove one hickory by barn. Option A cut and leave $950. Option B haul away $1600. Option C haul away and stump grind $2100.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$950", "$1,600", "$2,100"],
      should_block_for_price: false,
    },
  },
  {
    case_id: "price-phone-and-address-large-no-confusion",
    dataset_name: "live-option-price-parsing-v1",
    group: "phone_number_not_price",
    raw_input:
      "Paula Kent 812-555-3300 paula@example.com. 3300 River Road Salem IN. Remove one maple by driveway. Option A remove only $1,100. Option B remove and cleanup $1,900.",
    expected: {
      usable_price_in_input: true,
      should_extract_prices: ["$1,100", "$1,900"],
      should_block_for_price: false,
      excluded_numbers_should_include: ["812-555-3300", "3300"],
    },
  },
  {
    case_id: "price-missing-address-number-only",
    dataset_name: "live-option-price-parsing-v1",
    group: "no_usable_price_in_input",
    raw_input:
      "Quinn Lee 812-555-1718 quinn@example.com. 1800 Oak Lane Madison IN. Remove one oak tree and haul away. No price written yet.",
    expected: {
      usable_price_in_input: false,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-vague-about-1800",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Rita Shaw 812-555-1819 rita@example.com. 51 Elm St Hanover IN. Remove one elm tree. About $1800, but Tree Dude has to confirm after checking access.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-range-not-firm",
    dataset_name: "live-option-price-parsing-v1",
    group: "price_present_but_not_firm",
    raw_input:
      "Sam Noel 812-555-1920 sam@example.com. 74 Pine Rd Seymour IN. Remove one pine. Price probably 1500 to 2000 depending on equipment.",
    expected: {
      usable_price_in_input: false,
      price_like_text_present: true,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
  {
    case_id: "price-prior-quote-reference",
    dataset_name: "live-option-price-parsing-v1",
    group: "no_usable_price_in_input",
    raw_input:
      "Tara Cole 812-555-2021 tara@example.com. 91 Cedar Ct Bedford IN. Remove cedar near fence. Use same price as last time.",
    expected: {
      usable_price_in_input: false,
      should_extract_prices: [],
      should_block_for_price: true,
    },
  },
];

function nowStamp() {
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

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return value == null ? "" : String(value);
}

function moneyText(price) {
  return String(price?.display || "").trim();
}

function serviceOptions(alphaJson = {}) {
  return alphaJson.service_options?.items || [];
}

function td2DisplayedOptions(alphaJson = {}) {
  return serviceOptions(alphaJson).map((option, index) => ({
    label: option.label || `Option ${index + 1}`,
    title: option.title || "",
    description: option.description || "",
    price_display: moneyText(option.price),
    price_is_unclear: Boolean(option.price?.is_unclear),
    price_amount: option.price?.amount ?? null,
  }));
}

function normalizedQuoteOptions(alphaJson = {}) {
  return serviceOptions(alphaJson).map((option) => ({
    label: option.label || "",
    title: option.title || "",
    description: option.description || "",
    price: option.price || {},
  }));
}

function modelQuoteOptions(debugPipeline = {}) {
  return (debugPipeline.rawOpenAiDraftJson?.options || []).map((option) => ({
    raw_label: option.raw_label || "",
    raw_text: option.raw_text || "",
    scope: option.scope || "",
    price_raw: option.price_raw || "",
    price_amount: option.price_amount ?? null,
    price_status: option.price_status || "",
  }));
}

function formatCandidate(match) {
  return {
    value: match[0],
    index: match.index,
  };
}

function priceCandidatesDetected(rawInput) {
  return [...rawInput.matchAll(/\$?\s*\b\d[\d,]*(?:\.\d{2})?\b\s*(?:k\b)?/gi)].map(formatCandidate);
}

function excludedNumbers(rawInput) {
  const excluded = [];
  for (const match of rawInput.matchAll(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g)) {
    excluded.push({ value: match[0], reason: "phone_number", index: match.index });
  }
  for (const match of rawInput.matchAll(/\b\d+\s+(?:state\s+road|highway|hwy|road|rd|street|st|avenue|ave|lane|ln|drive|dr|court|ct|way|ridge)\b/gi)) {
    excluded.push({ value: match[0], reason: "address_or_route_number", index: match.index });
  }
  return excluded;
}

function priceWarnings(validation = {}) {
  return [...(validation.blocking_errors || []), ...(validation.follow_ups || []), ...(validation.warnings || [])]
    .filter((item) =>
      /\bmissing priced service option\b|\bmissing a clear price\b|\bfirm price\b|\bwhat price\b|\bprice is not firm\b/i.test(item)
    );
}

function priceMissingOrUnclear(alphaJson = {}) {
  const options = serviceOptions(alphaJson);
  if (!options.length) return true;
  return options.some((option) => !option.price?.display || option.price?.is_unclear);
}

function readinessStatus(validation = {}) {
  return validation.can_generate_pdf ? "ready" : "needs_more_info";
}

function dropdownActivationState(alphaJson = {}, validation = {}) {
  const options = serviceOptions(alphaJson);
  if (!options.length) {
    return {
      price_dropdown_active: true,
      reason: "no_quote_options",
      affected_options: ["Option 1"],
      confirm_quote_enabled: Boolean(validation.can_generate_pdf),
    };
  }
  const affected = options
    .filter((option) => !option.price?.display || option.price?.is_unclear)
    .map((option, index) => option.label || `Option ${index + 1}`);
  return {
    price_dropdown_active: affected.length > 0,
    reason: affected.length > 0 ? "missing_or_unclear_price" : "none",
    affected_options: affected,
    confirm_quote_enabled: Boolean(validation.can_generate_pdf),
  };
}

function failureFlags(testCase, alphaJson = {}, validation = {}) {
  const expectedPrices = testCase.expected.should_extract_prices || [];
  const actualPrices = td2DisplayedOptions(alphaJson).map((option) => option.price_display).filter(Boolean);
  const flags = [];
  const hasMissingPrice = priceMissingOrUnclear(alphaJson);
  const expectedPriceBlock = Boolean(testCase.expected.should_block_for_price);
  const hasPriceWarning = priceWarnings(validation).length > 0;

  if (testCase.expected.usable_price_in_input && hasMissingPrice) {
    flags.push("price_present_but_missing_or_unclear");
  }
  if (!testCase.expected.usable_price_in_input && hasMissingPrice) {
    flags.push("no_usable_price_in_input_and_missing_in_td2");
  }
  if (!testCase.expected.usable_price_in_input && actualPrices.length > 0) {
    flags.push("no_usable_price_in_input_but_price_finalized");
  }
  for (const expectedPrice of expectedPrices) {
    if (!actualPrices.includes(expectedPrice)) flags.push("expected_price_not_displayed");
  }
  if (expectedPriceBlock && !hasPriceWarning) flags.push("missing_price_follow_up");
  if (!expectedPriceBlock && hasPriceWarning) flags.push("unexpected_price_follow_up");
  return [...new Set(flags)];
}

function priceBucket(testCase, alphaJson = {}) {
  const hasMissingPrice = priceMissingOrUnclear(alphaJson);
  if (!hasMissingPrice) return "price_ok_or_not_missing";
  if (testCase.expected.usable_price_in_input) return "price_present_but_missing_or_unclear";
  return "no_usable_price_in_input";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, ok: response.ok, json: parsed };
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function summarize(records) {
  const buckets = {};
  const groups = {};
  for (const record of records) {
    buckets[record.price_missing_bucket] = (buckets[record.price_missing_bucket] || 0) + 1;
    groups[record.group] ||= { total: 0, missing_or_unclear_price: 0, finalized_without_usable_input: 0 };
    groups[record.group].total += 1;
    if (record.dropdown_activation_state.price_dropdown_active) groups[record.group].missing_or_unclear_price += 1;
    if (record.failure_flags.includes("no_usable_price_in_input_but_price_finalized")) {
      groups[record.group].finalized_without_usable_input += 1;
    }
  }
  return {
    total: records.length,
    production_errors: records.filter((record) => record.production_error).length,
    mocked: records.filter((record) => record.mocked).length,
    price_present_but_missing_or_unclear: buckets.price_present_but_missing_or_unclear || 0,
    no_usable_price_in_input: buckets.no_usable_price_in_input || 0,
    price_ok_or_not_missing: buckets.price_ok_or_not_missing || 0,
    finalized_without_usable_price_input: records.filter((record) =>
      record.failure_flags.includes("no_usable_price_in_input_but_price_finalized")
    ).length,
    by_group: groups,
  };
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# Live Option Price Parsing Report ${payload.timestamp}`);
  lines.push("");
  lines.push(`Base URL: ${payload.base_url}`);
  lines.push("Execution: deployed `/api/openai` followed by deployed `/api/validate`.");
  lines.push("Safety: no PDF generation, no estimate creation, no notifications.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Dataset: \`${payload.dataset_name}\``);
  lines.push(`- Total cases: ${payload.summary.total}`);
  lines.push(`- Production errors: ${payload.summary.production_errors}`);
  lines.push(`- Mocked OpenAI responses: ${payload.summary.mocked}`);
  lines.push(`- Price present but TD2 missing/unclear: ${payload.summary.price_present_but_missing_or_unclear}`);
  lines.push(`- No usable price in input and TD2 missing/unclear: ${payload.summary.no_usable_price_in_input}`);
  lines.push(`- Price OK or not missing: ${payload.summary.price_ok_or_not_missing}`);
  lines.push(`- No usable price in input but TD2 finalized a price: ${payload.summary.finalized_without_usable_price_input}`);
  lines.push(`- Reusable customer inputs: \`${payload.inputs_path}\``);
  lines.push("");
  lines.push("## Group Results");
  lines.push("");
  lines.push("| Group | Total | Missing/unclear price in TD2 | Finalized without usable input |");
  lines.push("|---|---:|---:|---:|");
  for (const [group, item] of Object.entries(payload.summary.by_group)) {
    lines.push(`| ${group} | ${item.total} | ${item.missing_or_unclear_price} | ${item.finalized_without_usable_input} |`);
  }
  lines.push("");
  lines.push("## Case Results");
  lines.push("");
  lines.push("| Case | Group | Bucket | TD2 prices | Price follow-up/warning | Failure flags |");
  lines.push("|---|---|---|---|---|---|");
  for (const record of payload.records) {
    lines.push(
      [
        record.case_id,
        record.group,
        record.price_missing_bucket,
        record.td2_displayed_options.map((option) => `${option.label} ${option.price_display || "Price missing"}`).join("; "),
        record.price_warnings.join("; "),
        record.failure_flags.join(", ") || "none",
      ].map(markdownEscape).join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function runCase(testCase) {
  let openai;
  let validate;
  let productionError = "";

  try {
    openai = await postJson(`${BASE_URL}/api/openai`, {
      case_id: testCase.case_id,
      customer_text: testCase.raw_input,
    });
    if (!openai.ok) {
      productionError = `/api/openai ${openai.status}`;
    } else {
      validate = await postJson(`${BASE_URL}/api/validate`, {
        alphaJson: openai.json.alphaJson,
        customer_text: testCase.raw_input,
      });
      if (!validate.ok) productionError = `/api/validate ${validate.status}`;
    }
  } catch (error) {
    productionError = error?.message || String(error);
  }

  const alphaJson = validate?.json?.alphaJson || openai?.json?.alphaJson || {};
  const validation = validate?.json || {};
  const debugPipeline = openai?.json?.debugPipeline || {};
  const row = {
    case_id: testCase.case_id,
    dataset_name: testCase.dataset_name,
    group: testCase.group,
    raw_input: testCase.raw_input,
    expected: testCase.expected,
    model_output_raw: debugPipeline.rawOpenAiDraftJson || null,
    alphaJson_before_normalization: null,
    alphaJson_after_normalization: alphaJson,
    model_quote_options: modelQuoteOptions(debugPipeline),
    normalized_quote_options: normalizedQuoteOptions(alphaJson),
    td2_displayed_options: td2DisplayedOptions(alphaJson),
    price_candidates_detected: priceCandidatesDetected(testCase.raw_input),
    excluded_numbers: excludedNumbers(testCase.raw_input),
    price_warnings: priceWarnings(validation),
    validation_result: {
      can_generate_pdf: validation.can_generate_pdf ?? false,
      blocking_errors: validation.blocking_errors || [],
      follow_ups: validation.follow_ups || [],
      warnings: validation.warnings || [],
    },
    readiness_status: readinessStatus(validation),
    follow_up_questions: validation.follow_ups || [],
    dropdown_activation_state: dropdownActivationState(alphaJson, validation),
    failure_flags: [],
    price_missing_bucket: "unknown",
    mocked: Boolean(openai?.json?.mocked),
    production_error: productionError,
    openai_status: openai?.status || null,
    validate_status: validate?.status || null,
  };
  const instrumentation = buildPriceInstrumentation({
    rawInput: testCase.raw_input,
    expectedPrices: testCase.expected.should_extract_prices || [],
    alphaJsonBeforeNormalization: row.model_output_raw,
    alphaJsonAfterNormalization: alphaJson,
    validation,
    dropdownActivationState: row.dropdown_activation_state,
    td2DisplayedOptions: row.td2_displayed_options,
  });
  row.price_candidates_detected = instrumentation.price_candidates_detected;
  row.excluded_numbers = instrumentation.excluded_numbers;
  row.price_evidence_spans = instrumentation.price_evidence_spans;
  row.expected_price_supported_by_raw_input = instrumentation.expected_price_supported_by_raw_input;
  row.price_failure_stage = instrumentation.price_failure_stage;
  row.price_failure_stages = instrumentation.price_failure_stages;
  row.failure_flags = failureFlags(testCase, alphaJson, validation);
  row.price_missing_bucket = priceBucket(testCase, alphaJson);
  return row;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = nowStamp();
  const records = [];

  for (const [index, testCase] of cases.entries()) {
    const row = await runCase(testCase);
    records.push(row);
    console.log(`${index + 1}/${cases.length} ${testCase.case_id} ${row.price_missing_bucket}`);
  }

  const datasetName = cases[0]?.dataset_name || "live-option-price-parsing";
  const payload = {
    timestamp,
    base_url: BASE_URL,
    dataset_name: datasetName,
    inputs_path: path.join("reports", `live-option-price-parsing-inputs-${timestamp}.jsonl`),
    summary: summarize(records),
    records,
  };

  const inputsPath = path.join(REPORT_DIR, `live-option-price-parsing-inputs-${timestamp}.jsonl`);
  const jsonlPath = path.join(REPORT_DIR, `live-option-price-parsing-results-${timestamp}.jsonl`);
  const jsonPath = path.join(REPORT_DIR, `live-option-price-parsing-summary-${timestamp}.json`);
  const mdPath = path.join(REPORT_DIR, `live-option-price-parsing-report-${timestamp}.md`);

  fs.writeFileSync(inputsPath, `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`);
  fs.writeFileSync(jsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(payload));

  console.log(JSON.stringify({ inputsPath, jsonlPath, jsonPath, mdPath, summary: payload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
