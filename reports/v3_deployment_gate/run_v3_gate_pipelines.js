import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, "reports", "v3_deployment_gate");
const INPUT_PATH = path.join(BENCH_DIR, "v3_gate_input.jsonl");
const DEPLOYED_OUTPUT = path.join(BENCH_DIR, "deployed_predictions.jsonl");
const STAGED_OUTPUT = path.join(BENCH_DIR, "staged_predictions.jsonl");
const EXCEPTIONS_OUTPUT = path.join(BENCH_DIR, "pipeline_exceptions.jsonl");

const DEPLOYED_BASE_URL = process.env.V3_GATE_DEPLOYED_BASE_URL || "https://tree-service-web-app.vercel.app";
const STAGED_BASE_URL = process.env.V3_GATE_STAGED_BASE_URL || "http://127.0.0.1:3000";

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asPriceAmount(option = {}) {
  const amount = option?.price?.amount ?? option?.price?.min_amount;
  const numeric = Number(amount);
  if (Number.isFinite(numeric) && numeric > 0 && !option?.price?.is_unclear) {
    return Math.round(numeric);
  }

  const display = compact(option?.price?.display);
  if (!display || option?.price?.is_unclear) return null;
  const digits = display.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function optionDescription(option = {}) {
  return compact(option.description || option.title || "");
}

function optionByLabel(options, label, fallbackIndex) {
  const normalized = label.toLowerCase();
  return options.find((option) => compact(option.label).toLowerCase() === normalized) || options[fallbackIndex] || {};
}

function optionBAdditionalServices(option = {}) {
  const text = compact(`${option.title || ""} ${option.description || ""}`).toLowerCase();
  const services = [];
  const patterns = [
    ["stump grinding", /\b(?:stump|stumps|grind|grinding)\b/],
    ["haul brush", /\b(?:haul|remove|take away|chip)\b[^.]*\bbrush\b|\bbrush\b[^.]*\b(?:haul|remove|take away|chip)\b/],
    ["haul logs", /\b(?:haul|remove|take away)\b[^.]*\b(?:log|logs|wood)\b|\b(?:log|logs|wood)\b[^.]*\b(?:haul|remove|take away)\b/],
    ["haul debris", /\b(?:haul|remove|take away)\b[^.]*\bdebris\b|\bdebris\b[^.]*\b(?:haul|remove|take away)\b/],
    ["brush cleanup", /\b(?:cleanup|clean up|rake|final cleanup|yard cleanup)\b|\bchip(?:ping)? brush\b/],
  ];

  for (const [service, re] of patterns) {
    if (re.test(text)) services.push(service);
  }

  return [...new Set(services)];
}

function predictionFromAlpha(caseId, alphaJson = {}) {
  const customer = alphaJson.customer || {};
  const options = alphaJson.service_options?.items || [];
  const optionA = optionByLabel(options, "Option A", 0);
  const optionB = optionByLabel(options, "Option B", 1);

  return {
    case_id: caseId,
    customer_name: compact(customer.name),
    phone: compact(customer.phone_display || customer.phone_primary || customer.phone),
    email: compact(customer.email),
    option_a_description: optionDescription(optionA),
    option_a_price: asPriceAmount(optionA),
    option_b_description: optionDescription(optionB),
    option_b_price: asPriceAmount(optionB),
    option_b_additional_services: optionBAdditionalServices(optionB),
  };
}

function emptyPrediction(caseId) {
  return {
    case_id: caseId,
    customer_name: "",
    phone: "",
    email: "",
    option_a_description: "",
    option_a_price: null,
    option_b_description: "",
    option_b_price: null,
    option_b_additional_services: [],
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw_response_text: text.slice(0, 500) };
  }
  return { ok: response.ok, status: response.status, json };
}

async function runOne(baseUrl, row, pipeline) {
  const openai = await postJson(`${baseUrl}/api/openai`, {
    case_id: row.case_id,
    customer_text: row.input_text,
  });
  if (!openai.ok) {
    throw new Error(`${pipeline} /api/openai returned ${openai.status}`);
  }

  const validate = await postJson(`${baseUrl}/api/validate`, {
    alphaJson: openai.json.alphaJson,
    customer_text: row.input_text,
  });
  if (!validate.ok) {
    throw new Error(`${pipeline} /api/validate returned ${validate.status}`);
  }

  return predictionFromAlpha(row.case_id, validate.json.alphaJson || openai.json.alphaJson || {});
}

async function runPipeline(baseUrl, rows, pipeline) {
  const predictions = [];
  const exceptions = [];

  for (const row of rows) {
    try {
      predictions.push(await runOne(baseUrl, row, pipeline));
    } catch (error) {
      predictions.push(emptyPrediction(row.case_id));
      exceptions.push({
        pipeline,
        case_id: row.case_id,
        message: error?.message || String(error),
      });
    }
  }

  return { predictions, exceptions };
}

function validatePredictions(inputRows, predictions, label) {
  const inputIds = inputRows.map((row) => row.case_id);
  const predictionIds = predictions.map((row) => row.case_id);
  const errors = [];

  if (predictions.length !== inputRows.length) {
    errors.push(`${label}: expected ${inputRows.length} rows, got ${predictions.length}`);
  }
  if (new Set(predictionIds).size !== predictionIds.length) {
    errors.push(`${label}: duplicate case_id values`);
  }
  if (JSON.stringify(inputIds) !== JSON.stringify(predictionIds)) {
    errors.push(`${label}: case_id order or values do not match input`);
  }
  for (const row of predictions) {
    for (const key of ["option_a_price", "option_b_price"]) {
      if (row[key] !== null && typeof row[key] !== "number") {
        errors.push(`${label}: ${row.case_id} ${key} must be number or null`);
      }
    }
    if (!Array.isArray(row.option_b_additional_services)) {
      errors.push(`${label}: ${row.case_id} option_b_additional_services must be an array`);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

const rows = readJsonl(INPUT_PATH);
const deployed = await runPipeline(DEPLOYED_BASE_URL, rows, "deployed");
const staged = await runPipeline(STAGED_BASE_URL, rows, "staged");

validatePredictions(rows, deployed.predictions, "deployed");
validatePredictions(rows, staged.predictions, "staged");

writeJsonl(DEPLOYED_OUTPUT, deployed.predictions);
writeJsonl(STAGED_OUTPUT, staged.predictions);
writeJsonl(EXCEPTIONS_OUTPUT, [...deployed.exceptions, ...staged.exceptions]);

console.log(JSON.stringify({
  deployed_base_url: DEPLOYED_BASE_URL,
  staged_base_url: STAGED_BASE_URL,
  input_rows: rows.length,
  deployed_predictions: DEPLOYED_OUTPUT,
  staged_predictions: STAGED_OUTPUT,
  exceptions: EXCEPTIONS_OUTPUT,
  deployed_exception_count: deployed.exceptions.length,
  staged_exception_count: staged.exceptions.length,
}, null, 2));
