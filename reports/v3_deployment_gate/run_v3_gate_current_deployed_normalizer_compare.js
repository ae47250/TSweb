import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "reports", "v3_deployment_gate");
const INPUT_PATH = path.join(DIR, "v3_gate_input.jsonl");
const ANSWER_KEY = path.join(DIR, "v3_gate_answer_key.jsonl");
const OUT_DIR = path.join(DIR, "current_deployed_normalizer_compare");
const SNAPSHOT_ROOT = path.join(DIR, "snapshots");
const DEPLOYED_BASE_URL = process.env.V3_GATE_DEPLOYED_BASE_URL || "https://tree-service-web-app.vercel.app";
const PYTHON = process.env.CODEX_PYTHON ||
  "C:\\Users\\eiriksson\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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
  for (const [service, re] of patterns) if (re.test(text)) services.push(service);
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
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${compact(json.error || json.message || json.raw_response_text).slice(0, 200)}`);
  }
  return json;
}

function scoreOutput(predictionsPath, label) {
  const output = execFileSync(PYTHON, [
    path.join(DIR, "score_v3_gate.py"),
    "--answer-key", ANSWER_KEY,
    "--deployed", predictionsPath,
    "--staged", predictionsPath,
  ], { cwd: ROOT, encoding: "utf8" });
  fs.writeFileSync(path.join(OUT_DIR, `${label}_scorer_output.txt`), output);
  const section = output.split("=== STAGED / VERSION 3.0 ===")[1] || output;
  const get = (re) => {
    const match = section.match(re);
    return match ? Number(match[1]) : null;
  };
  const aF1 = get(/option A description F1\s+([\d.]+)/);
  const bF1 = get(/option B description F1\s+([\d.]+)/);
  return {
    phone: get(/phone\s+([\d.]+)%/),
    email: get(/email\s+([\d.]+)%/),
    option_a_price: get(/option_a_price\s+([\d.]+)%/),
    option_b_price: get(/option_b_price\s+([\d.]+)%/),
    pair: get(/option price pair exact\s+([\d.]+)%/),
    a_f1: aF1,
    b_f1: bF1,
    svc_f1: get(/Option B services F1\s+([\d.]+)/),
    mean_desc: aF1 != null && bF1 != null ? (aF1 + bF1) / 2 : null,
  };
}

function ensureHeadSnapshot() {
  const headDir = path.join(SNAPSHOT_ROOT, "head");
  if (fs.existsSync(path.join(headDir, "app", "api", "openai", "route.js"))) return headDir;
  throw new Error(`Missing head snapshot at ${headDir}`);
}

function materializeSnapshot(name, overlays) {
  const headDir = ensureHeadSnapshot();
  const variantDir = path.join(SNAPSHOT_ROOT, name);
  if (fs.existsSync(variantDir)) fs.rmSync(variantDir, { recursive: true, force: true });
  fs.cpSync(headDir, variantDir, { recursive: true });
  for (const overlay of overlays) {
    const dest = path.join(variantDir, overlay.path);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, overlay.content);
  }
  return variantDir;
}

function stagedContent(filePath) {
  return execFileSync("git", ["show", `:${filePath}`], { cwd: ROOT });
}

async function main() {
  ensureDir(OUT_DIR);
  const rows = readJsonl(INPUT_PATH);

  const alphaByCase = {};
  const deployedOpenAiExceptions = [];
  for (const row of rows) {
    try {
      const openai = await postJson(`${DEPLOYED_BASE_URL}/api/openai`, {
        case_id: row.case_id,
        customer_text: row.input_text,
      });
      alphaByCase[row.case_id] = openai.alphaJson;
    } catch (error) {
      alphaByCase[row.case_id] = {};
      deployedOpenAiExceptions.push({
        case_id: row.case_id,
        message: error?.message || String(error),
      });
    }
  }

  const normalizeDir = materializeSnapshot("current_deployed_normalize_only", [
    { path: "lib/normalizeAlphaJson.js", content: stagedContent("lib/normalizeAlphaJson.js") },
  ]);
  const validateDir = materializeSnapshot("current_deployed_validate_only", [
    { path: "lib/validateJson.js", content: stagedContent("lib/validateJson.js") },
  ]);
  const combinedDir = materializeSnapshot("current_deployed_normalize_validate_combined", [
    { path: "lib/normalizeAlphaJson.js", content: stagedContent("lib/normalizeAlphaJson.js") },
    { path: "lib/validateJson.js", content: stagedContent("lib/validateJson.js") },
  ]);

  const normalizeModule = await import(
    pathToFileURL(path.join(normalizeDir, "lib", "normalizeAlphaJson.js")).href + `?v=${Date.now()}`
  );
  const validateModule = await import(
    pathToFileURL(path.join(validateDir, "lib", "validateJson.js")).href + `?v=${Date.now()}`
  );
  const combinedNormalizeModule = await import(
    pathToFileURL(path.join(combinedDir, "lib", "normalizeAlphaJson.js")).href + `?v=${Date.now()}`
  );
  const combinedValidateModule = await import(
    pathToFileURL(path.join(combinedDir, "lib", "validateJson.js")).href + `?v=${Date.now()}`
  );

  const variants = [
    {
      setup: "Current deployed",
      predictionsPath: path.join(OUT_DIR, "current_deployed_predictions.jsonl"),
      exceptionsPath: path.join(OUT_DIR, "current_deployed_exceptions.jsonl"),
      run: async (row) => {
        const validation = await postJson(`${DEPLOYED_BASE_URL}/api/validate`, {
          alphaJson: alphaByCase[row.case_id],
          customer_text: row.input_text,
        });
        return predictionFromAlpha(row.case_id, validation.alphaJson || alphaByCase[row.case_id] || {});
      },
    },
    {
      setup: "Current deployed + HEAD normalize",
      predictionsPath: path.join(OUT_DIR, "current_deployed_head_normalize_predictions.jsonl"),
      exceptionsPath: path.join(OUT_DIR, "current_deployed_head_normalize_exceptions.jsonl"),
      run: async (row) => {
        const alpha = deepClone(alphaByCase[row.case_id] || {});
        const normalized = normalizeModule.normalizeToAlphaJsonV14(alpha, row.input_text, {});
        const validation = await postJson(`${DEPLOYED_BASE_URL}/api/validate`, {
          alphaJson: normalized,
          customer_text: row.input_text,
        });
        return predictionFromAlpha(row.case_id, validation.alphaJson || normalized || {});
      },
    },
    {
      setup: "Current deployed + HEAD validate",
      predictionsPath: path.join(OUT_DIR, "current_deployed_head_validate_predictions.jsonl"),
      exceptionsPath: path.join(OUT_DIR, "current_deployed_head_validate_exceptions.jsonl"),
      run: async (row) => {
        const validation = validateModule.validateAlphaJson(deepClone(alphaByCase[row.case_id] || {}));
        return predictionFromAlpha(row.case_id, validation.alphaJson || validation || alphaByCase[row.case_id] || {});
      },
    },
    {
      setup: "Current deployed + HEAD normalize + HEAD validate",
      predictionsPath: path.join(OUT_DIR, "current_deployed_head_normalize_validate_predictions.jsonl"),
      exceptionsPath: path.join(OUT_DIR, "current_deployed_head_normalize_validate_exceptions.jsonl"),
      run: async (row) => {
        const alpha = deepClone(alphaByCase[row.case_id] || {});
        const normalized = combinedNormalizeModule.normalizeToAlphaJsonV14(alpha, row.input_text, {});
        const validation = combinedValidateModule.validateAlphaJson(normalized);
        return predictionFromAlpha(row.case_id, validation.alphaJson || validation || normalized || {});
      },
    },
  ];

  const results = [];
  for (const variant of variants) {
    const predictions = [];
    const exceptions = [];
    for (const row of rows) {
      try {
        predictions.push(await variant.run(row));
      } catch (error) {
        predictions.push(emptyPrediction(row.case_id));
        exceptions.push({
          case_id: row.case_id,
          message: error?.message || String(error),
        });
      }
    }
    writeJsonl(variant.predictionsPath, predictions);
    writeJsonl(variant.exceptionsPath, exceptions);
    const metrics = scoreOutput(variant.predictionsPath, variant.setup.replace(/[^a-z0-9]+/gi, "_").toLowerCase());
    results.push({
      setup: variant.setup,
      predictionsPath: variant.predictionsPath,
      exceptions: exceptions.length + (variant.setup === "Current deployed" ? deployedOpenAiExceptions.length : 0),
      metrics,
    });
  }

  const reportPath = path.join(OUT_DIR, "current_deployed_normalizer_compare_report.md");
  const summaryPath = path.join(OUT_DIR, "current_deployed_normalizer_compare_summary.json");
  const tableRows = results.map((result) => [
    result.setup,
    `${result.metrics.pair.toFixed(0)}%`,
    `${result.metrics.phone.toFixed(0)}%`,
    `${result.metrics.email.toFixed(0)}%`,
    result.metrics.a_f1.toFixed(3),
    result.metrics.b_f1.toFixed(3),
    result.metrics.mean_desc.toFixed(3),
    result.metrics.svc_f1.toFixed(3),
    String(result.exceptions),
  ]);

  const markdown = [
    "# Current Deployed Normalizer Compare",
    "",
    "Fresh deployed OpenAI calls were run once for each of the 30 gate notes.",
    "Those AlphaJSON outputs were then scored four ways against the same answer key:",
    "",
    "| Setup | Price Pair | Phone | Email | A Desc F1 | B Desc F1 | Mean Desc F1 | Services F1 | Exceptions |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...tableRows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Setup Definitions",
    "",
    "- `Current deployed`: live deployed `/api/openai` output, then live deployed `/api/validate`.",
    "- `Current deployed + HEAD normalize`: live deployed `/api/openai` output, then staged `lib/normalizeAlphaJson.js`, then live deployed `/api/validate`.",
    "- `Current deployed + HEAD validate`: live deployed `/api/openai` output, then staged `lib/validateJson.js`.",
    "- `Current deployed + HEAD normalize + HEAD validate`: live deployed `/api/openai` output, then staged normalize and staged validate.",
    "",
    "## Notes",
    "",
    "- The scorer is unchanged and the answer key was not exposed to the model calls.",
    "- Exceptions count any local pipeline failures in the evaluation harness.",
    "- `Mean Desc F1` is computed as the average of option A and option B description F1.",
    "",
    "## Generated Files",
    "",
    `- Predictions: ${results.map((r) => `\`${path.relative(ROOT, r.predictionsPath)}\``).join(", ")}`,
    `- Report JSON: \`${path.relative(ROOT, summaryPath)}\``,
  ].join("\n");

  const summary = {
    generated_at: new Date().toISOString(),
    rows: rows.length,
    deployed_openai_exceptions: deployedOpenAiExceptions.length,
    deployed_openai_exception_rows: deployedOpenAiExceptions,
    results: results.map((result) => ({
      setup: result.setup,
      predictionsPath: result.predictionsPath,
      exceptions: result.exceptions,
      metrics: result.metrics,
    })),
  };

  fs.writeFileSync(reportPath, `${markdown}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify({
    report: reportPath,
    summary: summaryPath,
    rows: rows.length,
    deployed_openai_exceptions: deployedOpenAiExceptions.length,
  }, null, 2));
}

await main();
