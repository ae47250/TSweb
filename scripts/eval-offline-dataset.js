import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstText(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function readCustomerText(row) {
  return firstText(
    row.raw_customer_input,
    row.customer_text,
    row.customerText,
    row.messy_input,
    row.input,
    row.text,
    typeof row.intake === "string" ? row.intake : "",
  );
}

function readStructuredIntake(row) {
  const intake = row.intake || row.structured_input || row.structuredInput || {};
  return isObject(intake) ? intake : {};
}

function readExpected(row) {
  if (isObject(row.expected)) return row.expected;
  const expected = {
    customer_name: firstText(row.expected_customer_name, row.expected_name),
    phone_display: firstText(row.expected_phone_display, row.expected_phone),
    email: asString(row.expected_email),
    service_address: firstText(row.expected_service_address, row.expected_address),
    work_requested: firstText(row.expected_work_requested, row.expected_scope, row.expected_description),
    tree_count: firstText(row.expected_tree_count, row.expected_treeCount),
    prices: row.expected_prices || row.expected_service_option_prices || null,
    can_generate_pdf: typeof row.expected_can_generate_pdf === "boolean" ? row.expected_can_generate_pdf : row.can_generate_pdf_expected,
  };
  return Object.fromEntries(Object.entries(expected).filter(([, value]) => value !== "" && value != null));
}

function summarizeOption(option) {
  return {
    label: option?.label || "",
    title: option?.title || "",
    description: option?.description || "",
    price_display: option?.price?.display || "",
    price_amount: option?.price?.amount ?? option?.price?.min_amount ?? null,
    sort_order: option?.sort_order ?? null,
  };
}

function actualSummary(validation) {
  const alphaJson = validation.alphaJson || {};
  return {
    actual_customer_name: alphaJson.customer?.name || "",
    actual_phone: alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "",
    actual_email: alphaJson.customer?.email || "",
    actual_service_address: alphaJson.job?.service_address?.display || "",
    actual_tree_count: alphaJson.job?.tree_details?.tree_count || "",
    actual_tree_type: alphaJson.job?.tree_details?.tree_type || "",
    actual_work_description: alphaJson.job?.description || "",
    actual_service_options: (alphaJson.service_options?.items || []).map(summarizeOption),
  };
}

function normalizeForMatch(value) {
  return asString(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function phoneDigits(value) {
  return asString(value).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function compareFields(expected, actual) {
  const matches = {};
  if (expected.customer_name) {
    matches.name = normalizeForMatch(expected.customer_name) === normalizeForMatch(actual.actual_customer_name);
  }
  if (expected.phone_display) {
    matches.phone = phoneDigits(expected.phone_display) === phoneDigits(actual.actual_phone);
  }
  if (expected.email) {
    matches.email = normalizeForMatch(expected.email) === normalizeForMatch(actual.actual_email);
  }
  if (expected.service_address) {
    const expectedAddress = normalizeForMatch(expected.service_address);
    const actualAddress = normalizeForMatch(actual.actual_service_address);
    matches.service_address = actualAddress === expectedAddress || actualAddress.includes(expectedAddress) || expectedAddress.includes(actualAddress);
  }
  if (expected.tree_count) {
    matches.tree_count = normalizeForMatch(expected.tree_count) === normalizeForMatch(actual.actual_tree_count);
  }
  if (typeof expected.can_generate_pdf === "boolean") {
    matches.can_generate_pdf = expected.can_generate_pdf === actual.can_generate_pdf;
  }
  return matches;
}

function summarizeRun(results) {
  const total = results.length;
  const ready = results.filter((row) => row.can_generate_pdf).length;
  const byGroup = {};
  const fieldTotals = {};
  const fieldMatches = {};

  for (const row of results) {
    const group = row.group || row.difficulty || row.messiness || "unknown";
    byGroup[group] ||= { total: 0, ready: 0, blocking: 0 };
    byGroup[group].total += 1;
    if (row.can_generate_pdf) byGroup[group].ready += 1;
    if ((row.blocking_errors || []).length) byGroup[group].blocking += 1;

    for (const [field, matched] of Object.entries(row.field_matches || {})) {
      fieldTotals[field] = (fieldTotals[field] || 0) + 1;
      if (matched) fieldMatches[field] = (fieldMatches[field] || 0) + 1;
    }
  }

  return {
    total,
    can_generate_pdf: ready,
    blocked: total - ready,
    ready_rate: total ? Number((ready / total).toFixed(4)) : 0,
    by_group: byGroup,
    field_match_rates: Object.fromEntries(
      Object.keys(fieldTotals).sort().map((field) => [
        field,
        {
          matched: fieldMatches[field] || 0,
          total: fieldTotals[field],
          rate: Number(((fieldMatches[field] || 0) / fieldTotals[field]).toFixed(4)),
        },
      ]),
    ),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output || "reports/offline-eval-current-pipeline.jsonl";
  const summaryPath = args.summary || outputPath.replace(/\.jsonl$/i, "-summary.json");
  const limit = args.limit ? Number(args.limit) : null;

  if (!inputPath) {
    console.error("Usage: node scripts/eval-offline-dataset.js --input path/to/input.jsonl --output reports/offline-eval-current-pipeline.jsonl");
    process.exit(1);
  }

  const lines = readFileSync(inputPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const selectedLines = Number.isFinite(limit) && limit > 0 ? lines.slice(0, limit) : lines;
  const results = [];

  selectedLines.forEach((line, index) => {
    const row = JSON.parse(line);
    const customerText = readCustomerText(row);
    const intake = readStructuredIntake(row);
    const expected = readExpected(row);

    if (!customerText) {
      results.push({
        case_id: row.case_id || row.caseId || row.id || index + 1,
        id: row.id || "",
        group: row.group || row.difficulty || row.messiness || row.category || "",
        error: "No customer text field found.",
        expected,
      });
      return;
    }

    const alphaJson = normalizeToAlphaJsonV14({}, customerText, intake);
    const validation = validateAlphaJson(alphaJson);
    const actual = actualSummary(validation);
    const result = {
      case_id: row.case_id || row.caseId || row.id || index + 1,
      id: row.id || "",
      group: row.group || "",
      difficulty: row.difficulty || row.messiness || "",
      category: row.category || row.email_case_type || "",
      email_present: row.email_present ?? null,
      input: customerText,
      expected,
      extracted_from_dataset: {
        name: row.extracted_name || "",
        phone: row.extracted_phone || "",
        email: row.extracted_email || "",
        service_address: row.extracted_service_address || "",
        work_requested: row.extracted_work_requested || "",
        prices: row.extracted_prices || null,
      },
      ...actual,
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors || [],
      warnings: validation.warnings || [],
      follow_ups: validation.follow_ups || [],
      structured_follow_ups: validation.structured_follow_ups || [],
      field_matches: {},
      alphaJson: validation.alphaJson,
      validation,
    };
    result.field_matches = compareFields(expected, result);
    results.push(result);
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${results.map((row) => JSON.stringify(row)).join("\n")}\n`);
  writeFileSync(summaryPath, `${JSON.stringify(summarizeRun(results), null, 2)}\n`);

  console.log(`Offline eval rows: ${results.length}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Summary: ${summaryPath}`);
}

main();
