import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "reports", "v3_deployment_gate");
const SNAPSHOT_DIR = path.join(DIR, "snapshots");
const INPUT_PATH = path.join(DIR, "v3_gate_input.jsonl");
const ANSWER_KEY = path.join(DIR, "v3_gate_answer_key.jsonl");
const OUT_DIR = path.join(DIR, "ablation");
const PYTHON = process.env.CODEX_PYTHON ||
  "C:\\Users\\eiriksson\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const CANDIDATE_FILES = [
  "lib/normalizeAlphaJson.js",
  "lib/optionPriceNormalizer.js",
  "lib/validateJson.js",
  "lib/sourceFinalFactCoverage.js",
  "app/api/openai/route.js",
];

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

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function removeDirIfExists(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function archiveHeadSnapshot() {
  const headDir = path.join(SNAPSHOT_DIR, "head");
  if (fs.existsSync(path.join(headDir, "app", "api", "openai", "route.js"))) return headDir;
  removeDirIfExists(headDir);
  ensureDir(headDir);
  const archive = path.join(SNAPSHOT_DIR, "head.zip");
  ensureDir(SNAPSHOT_DIR);
  execFileSync("git", ["archive", "--format=zip", "--output", archive, "HEAD"], { cwd: ROOT });
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    "& { param($archive,$dest) Expand-Archive -LiteralPath $archive -DestinationPath $dest -Force }",
    archive,
    headDir,
  ], { cwd: ROOT });
  return headDir;
}

function stagedContent(filePath) {
  return execFileSync("git", ["show", `:${filePath}`], { cwd: ROOT });
}

function workingTreeContent(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath));
}

function materializeVariant(name, overlays) {
  const headDir = archiveHeadSnapshot();
  const variantDir = path.join(SNAPSHOT_DIR, name);
  removeDirIfExists(variantDir);
  copyDir(headDir, variantDir);
  fs.writeFileSync(path.join(variantDir, "lib", "api.js"), [
    "export function json(data, init = {}) {",
    "  return Response.json(data, init);",
    "}",
    "",
    "export async function readJson(request) {",
    "  try { return await request.json(); } catch { return {}; }",
    "}",
    "",
    "export function requestIp(request) {",
    "  return request.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() || \"local\";",
    "}",
    "",
  ].join("\n"));
  for (const overlay of overlays) {
    const dest = path.join(variantDir, overlay.path);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, overlay.content);
  }
  return variantDir;
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asPriceAmount(option = {}) {
  const amount = option?.price?.amount ?? option?.price?.min_amount;
  const numeric = Number(amount);
  if (Number.isFinite(numeric) && numeric > 0 && !option?.price?.is_unclear) return Math.round(numeric);
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

async function invokeRoute(routeModule, body) {
  const request = new Request("http://local.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await routeModule.POST(request);
  const json = await response.json();
  return { status: response.status, ok: response.ok, json };
}

async function runVariant(variant) {
  const rows = readJsonl(INPUT_PATH);
  const openaiUrl = pathToFileURL(path.join(variant.dir, "app", "api", "openai", "route.js")).href + `?variant=${variant.name}`;
  const validateUrl = pathToFileURL(path.join(variant.dir, "app", "api", "validate", "route.js")).href + `?variant=${variant.name}`;
  const openaiRoute = await import(openaiUrl);
  const validateRoute = await import(validateUrl);
  const predictions = [];
  const exceptions = [];

  for (const row of rows) {
    try {
      const openai = await invokeRoute(openaiRoute, { case_id: row.case_id, customer_text: row.input_text });
      if (!openai.ok) throw new Error(`/api/openai ${openai.status}`);
      const validate = await invokeRoute(validateRoute, { alphaJson: openai.json.alphaJson, customer_text: row.input_text });
      if (!validate.ok) throw new Error(`/api/validate ${validate.status}`);
      predictions.push(predictionFromAlpha(row.case_id, validate.json.alphaJson || openai.json.alphaJson || {}));
    } catch (error) {
      predictions.push(emptyPrediction(row.case_id));
      exceptions.push({ variant: variant.name, case_id: row.case_id, message: error?.message || String(error) });
    }
  }

  const outPath = path.join(OUT_DIR, `${variant.name}_predictions.jsonl`);
  writeJsonl(outPath, predictions);
  if (exceptions.length) writeJsonl(path.join(OUT_DIR, `${variant.name}_exceptions.jsonl`), exceptions);
  return { ...variant, predictions: outPath, exceptions };
}

function scoreOutput(predictionsPath, label) {
  const output = execFileSync(PYTHON, [
    path.join(DIR, "score_v3_gate.py"),
    "--answer-key", ANSWER_KEY,
    "--deployed", predictionsPath,
    "--staged", predictionsPath,
  ], { cwd: ROOT, encoding: "utf8" });
  const metrics = {};
  const section = output.split("=== STAGED / VERSION 3.0 ===")[1] || output;
  const patterns = {
    phone: /phone\s+([\d.]+)%/,
    email: /email\s+([\d.]+)%/,
    option_a_price: /option_a_price\s+([\d.]+)%/,
    option_b_price: /option_b_price\s+([\d.]+)%/,
    pair: /option price pair exact\s+([\d.]+)%/,
    a_f1: /option A description F1\s+([\d.]+)/,
    b_f1: /option B description F1\s+([\d.]+)/,
    svc_f1: /Option B services F1\s+([\d.]+)/,
  };
  for (const [key, re] of Object.entries(patterns)) {
    const match = section.match(re);
    metrics[key] = match ? Number(match[1]) : null;
  }
  const hardMatch = section.match(/HARD:\s+price-pair exact: ([\d.]+)%\s+critical exact:\s+[\d.]+%\s+desc mean F1:\s+([\d.]+)/);
  metrics.hard_pair = hardMatch ? Number(hardMatch[1]) : null;
  metrics.hard_desc = hardMatch ? Number(hardMatch[2]) : null;
  metrics.mean_desc = metrics.a_f1 != null && metrics.b_f1 != null ? (metrics.a_f1 + metrics.b_f1) / 2 : null;
  fs.writeFileSync(path.join(OUT_DIR, `${label}_scorer_output.txt`), output);
  return metrics;
}

loadEnvLocal();
ensureDir(OUT_DIR);
ensureDir(SNAPSHOT_DIR);

const variants = [];
variants.push({ name: "no_staged_head", dir: materializeVariant("no_staged_head", []) });

for (const file of CANDIDATE_FILES) {
  const content = file === "app/api/openai/route.js" ? workingTreeContent(file) : stagedContent(file);
  variants.push({
    name: `single_${file.replace(/[\/.]/g, "_")}`,
    dir: materializeVariant(`single_${file.replace(/[\/.]/g, "_")}`, [{ path: file, content }]),
    overlays: [file],
  });
}

const individual = [];
for (const variant of variants) {
  const result = await runVariant(variant);
  const metrics = scoreOutput(result.predictions, result.name);
  individual.push({ name: result.name, overlays: result.overlays || [], predictions: result.predictions, exceptions: result.exceptions.length, metrics });
}

const baseline = individual.find((item) => item.name === "no_staged_head");
const ranked = individual
  .filter((item) => item.name !== "no_staged_head")
  .map((item) => ({
    ...item,
    delta_pair: item.metrics.pair - baseline.metrics.pair,
    delta_mean_desc: item.metrics.mean_desc - baseline.metrics.mean_desc,
    regression_score: Math.min(0, item.metrics.phone - baseline.metrics.phone) +
      Math.min(0, item.metrics.email - baseline.metrics.email) +
      Math.min(0, item.metrics.option_a_price - baseline.metrics.option_a_price) +
      Math.min(0, item.metrics.option_b_price - baseline.metrics.option_b_price),
  }))
  .sort((a, b) =>
    b.delta_pair - a.delta_pair ||
    b.delta_mean_desc - a.delta_mean_desc ||
    b.regression_score - a.regression_score
  );

const topFiveFiles = ranked.slice(0, 5).flatMap((item) => item.overlays);
const topFiveOverlays = topFiveFiles.map((file) => ({
  path: file,
  content: file === "app/api/openai/route.js" ? workingTreeContent(file) : stagedContent(file),
}));
const topFiveVariant = {
  name: "top5_promising_least_regressive",
  dir: materializeVariant("top5_promising_least_regressive", topFiveOverlays),
  overlays: topFiveFiles,
};
const topFiveResult = await runVariant(topFiveVariant);
const topFiveMetrics = scoreOutput(topFiveResult.predictions, topFiveResult.name);

const summary = {
  generated_at: new Date().toISOString(),
  baseline: {
    name: baseline.name,
    predictions: baseline.predictions,
    exceptions: baseline.exceptions,
    metrics: baseline.metrics,
  },
  individual_ranked: ranked.map((item) => ({
    name: item.name,
    overlays: item.overlays,
    predictions: item.predictions,
    exceptions: item.exceptions,
    metrics: item.metrics,
    delta_pair: item.delta_pair,
    delta_mean_desc: item.delta_mean_desc,
    regression_score: item.regression_score,
  })),
  top5: {
    overlays: topFiveFiles,
    predictions: topFiveResult.predictions,
    exceptions: topFiveResult.exceptions.length,
    metrics: topFiveMetrics,
  },
};

fs.writeFileSync(path.join(OUT_DIR, "ablation_summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
