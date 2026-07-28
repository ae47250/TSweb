import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value) {
  return String(value).replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function loadEnvFile(envPath) {
  if (!envPath || !existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath || "<not supplied>"}`);
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function tokenUsage(response) {
  const usage = response?.usage || {};
  return {
    input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
    output_tokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
  };
}

function metricDisplay(metric) {
  if (!metric || !Number.isFinite(metric.total)) return "not scored";
  return `${metric.matched}/${metric.total}`;
}

function architectureProjection(row) {
  return {
    option_prices: (row.actual_service_options || []).map((option) => option.price_amount),
    options: row.actual_service_options || [],
    customer: {
      name: row.actual_customer_name || "",
      phone: row.actual_phone || "",
      email: row.actual_email || "",
    },
    service_address: row.actual_service_address || "",
    tree_count: row.actual_tree_count || "",
    tree_type: row.actual_tree_type || "",
    primary_service_kind: row.accuracy?.primary_service_kind?.actual || "",
    service_kinds: row.accuracy?.service_kind_recall?.actual || [],
    relationship: row.accuracy?.option_relationship?.actual || "",
    option_b_price_role: row.accuracy?.option_b_price_role?.actual || "",
    source_final_codes: row.source_final?.codes || [],
    can_generate_pdf: Boolean(row.can_generate_pdf),
  };
}

function summarizeCell(summary, cacheRows) {
  const usage = cacheRows.reduce(
    (totals, row) => {
      totals.input_tokens += Number(row.token_usage?.input_tokens || 0);
      totals.output_tokens += Number(row.token_usage?.output_tokens || 0);
      totals.total_tokens += Number(row.token_usage?.total_tokens || 0);
      return totals;
    },
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );
  return {
    completed_calls: cacheRows.filter((row) => !row.api_error && row.raw_draft).length,
    api_errors: cacheRows.filter((row) => row.api_error).map((row) => ({
      case_id: row.case_id,
      error: row.api_error,
    })),
    token_usage: usage,
    pdf_ready: summary?.can_generate_pdf ?? null,
    blocked: summary?.blocked ?? null,
    exact_option_prices: summary?.accuracy?.exact_option_prices || null,
    exact_option_count: summary?.accuracy?.exact_option_count || null,
    primary_service_kind: summary?.accuracy?.primary_service_kind || null,
    service_kind_recall_complete: summary?.accuracy?.service_kind_recall_complete || null,
    action_fact_recall_complete: summary?.accuracy?.action_fact_recall_complete || null,
    option_relationship: summary?.accuracy?.option_relationship || null,
    option_b_price_role: summary?.accuracy?.option_b_price_role || null,
    contact_equivalence: summary?.accuracy?.contact_equivalence || null,
    address_equivalence: summary?.accuracy?.address_equivalence || null,
    source_final_counts: summary?.source_final_calibration?.omission_or_change_counts_by_code || {},
    unsafe_ready: summary?.readiness_safety?.unsafe_ready || [],
    correct_but_blocked: summary?.readiness_safety?.correct_but_blocked || [],
  };
}

function renderMarkdown(comparison) {
  const lines = [
    "# Live Service-Assembler A/B",
    "",
    `Run ID: \`${comparison.run_id}\``,
    "",
    `Fixture: \`${comparison.fixture.path}\` (${comparison.fixture.count} cases, SHA-256 \`${comparison.fixture.sha256}\`)`,
    "",
    `Base: \`${comparison.architectures.base.commit}\``,
    "",
    `Candidate: \`${comparison.architectures.candidate.commit}\``,
    "",
    "## Results",
    "",
    "| Model | Architecture | Calls | Primary kind | Exact prices | Exact count | Relationship | Unsafe ready | PDF ready | Tokens |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const model of comparison.models) {
    for (const label of ["base", "candidate"]) {
      const cell = comparison.cells[`${model}:${label}`];
      lines.push([
        model,
        label,
        cell.completed_calls,
        metricDisplay(cell.primary_service_kind),
        metricDisplay(cell.exact_option_prices),
        metricDisplay(cell.exact_option_count),
        metricDisplay(cell.option_relationship),
        cell.unsafe_ready.length,
        cell.pdf_ready ?? "n/a",
        cell.token_usage.total_tokens,
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
  }

  lines.push("", "## Architecture differences", "");
  for (const model of comparison.models) {
    const modelComparison = comparison.architecture_comparisons[model];
    lines.push(`- ${model}: ${modelComparison.behavioral_difference_count} of ${comparison.fixture.count} cases differed between independent base and candidate calls.`);
  }

  lines.push("", "## API errors", "");
  const errors = Object.entries(comparison.cells).flatMap(([cell, value]) =>
    value.api_errors.map((error) => `${cell} ${error.case_id}: ${error.error}`),
  );
  lines.push(...(errors.length ? errors.map((error) => `- ${error}`) : ["- None."]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));
const candidateRoot = resolve(args["candidate-root"] || process.cwd());
const baseRoot = resolve(args["base-root"] || "");
const fixturePath = resolve(args.fixture || "tests/fixtures/tree-dude-service-classification-60.json");
const envPath = resolve(args["env-file"] || "");
const outputDir = resolve(args["output-dir"] || "reports/service-assembler-live-ab");
const models = String(args.models || "gpt-4.1-nano,gpt-5.4-mini")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const reasoningEffort = String(args["reasoning-effort"] || "").trim().toLowerCase();
const execute = args.execute === true;

if (!baseRoot || !existsSync(baseRoot)) throw new Error(`Base root not found: ${baseRoot || "<not supplied>"}`);
if (!existsSync(candidateRoot)) throw new Error(`Candidate root not found: ${candidateRoot}`);
if (!existsSync(fixturePath)) throw new Error(`Fixture not found: ${fixturePath}`);
if (models.length !== 2) throw new Error(`Expected exactly two models; received ${models.join(", ") || "none"}.`);
if (reasoningEffort && !["low", "medium", "high"].includes(reasoningEffort)) {
  throw new Error(`Unsupported reasoning effort: ${reasoningEffort}`);
}

const fixtureText = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);
if (!Array.isArray(fixture) || fixture.length !== 60) {
  throw new Error(`Locked fixture must contain exactly 60 cases; found ${Array.isArray(fixture) ? fixture.length : "non-array"}.`);
}

const architectures = {
  base: {
    label: "base",
    root: baseRoot,
    commit: git(baseRoot, "rev-parse", "HEAD"),
    expected_commit: args["base-commit"] || "",
  },
  candidate: {
    label: "candidate",
    root: candidateRoot,
    commit: git(candidateRoot, "rev-parse", "HEAD"),
    expected_commit: args["candidate-commit"] || "",
  },
};

for (const architecture of Object.values(architectures)) {
  if (architecture.expected_commit && architecture.commit !== architecture.expected_commit) {
    throw new Error(`${architecture.label} commit mismatch: expected ${architecture.expected_commit}, found ${architecture.commit}`);
  }
  const architectureDrift = git(architecture.root, "diff", "--name-only", "HEAD", "--", "app", "lib", "package.json");
  if (architectureDrift) {
    throw new Error(`${architecture.label} has uncommitted architecture changes:\n${architectureDrift}`);
  }
  const promptModule = await import(pathToFileURL(resolve(architecture.root, "lib/openaiPrompt.js")).href);
  const schemaModule = await import(pathToFileURL(resolve(architecture.root, "lib/openaiDraftSchema.js")).href);
  architecture.system_prompt = promptModule.OPENAI_SYSTEM_PROMPT;
  architecture.response_format = schemaModule.OPENAI_DRAFT_RESPONSE_FORMAT;
  architecture.prompt_sha256 = sha256(architecture.system_prompt);
  architecture.response_format_sha256 = sha256(JSON.stringify(architecture.response_format));
}

if (
  architectures.base.prompt_sha256 !== architectures.candidate.prompt_sha256 ||
  architectures.base.response_format_sha256 !== architectures.candidate.response_format_sha256
) {
  throw new Error("Base and candidate prompt/schema hashes differ; this would not isolate the deterministic architecture change.");
}

loadEnvFile(envPath);
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not available after loading the environment file.");

const runId = args["run-id"] || basename(outputDir);
const requestSettings = {
  endpoint: "chat.completions.create",
  reasoning_effort: reasoningEffort || null,
  temperature: "provider_default",
  sdk_retries: 0,
  system_prompt_sha256: architectures.base.prompt_sha256,
  response_format_sha256: architectures.base.response_format_sha256,
};
const manifest = {
  schema_version: "service-assembler-live-ab-v1",
  run_id: runId,
  approved_calls: 240,
  planned_calls: fixture.length * models.length * Object.keys(architectures).length,
  fixture: {
    path: fixturePath,
    count: fixture.length,
    sha256: sha256(fixtureText.replace(/\r\n/g, "\n")),
  },
  models,
  architectures: Object.fromEntries(
    Object.entries(architectures).map(([key, value]) => [key, {
      root: value.root,
      commit: value.commit,
      prompt_sha256: value.prompt_sha256,
      response_format_sha256: value.response_format_sha256,
    }]),
  ),
  request_settings: requestSettings,
  execute,
};

if (manifest.planned_calls !== 240) {
  throw new Error(`Expected exactly 240 planned calls; calculated ${manifest.planned_calls}.`);
}

if (!execute) {
  console.log(JSON.stringify({ status: "dry_run", output_dir: outputDir, ...manifest }, null, 2));
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
const manifestPath = resolve(outputDir, "manifest.json");
if (existsSync(manifestPath)) {
  const existing = JSON.parse(readFileSync(manifestPath, "utf8"));
  const comparable = JSON.stringify({
    fixture: existing.fixture,
    models: existing.models,
    architectures: existing.architectures,
    request_settings: existing.request_settings,
  });
  const current = JSON.stringify({
    fixture: manifest.fixture,
    models: manifest.models,
    architectures: manifest.architectures,
    request_settings: manifest.request_settings,
  });
  if (comparable !== current) throw new Error("Existing run manifest does not match the requested experiment.");
} else {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const { default: OpenAI } = await import("openai");
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0,
  timeout: 120_000,
});
const cellState = {};

for (const model of models) {
  for (const architecture of Object.values(architectures)) {
    const key = `${model}:${architecture.label}`;
    const cachePath = resolve(outputDir, `raw-${slug(model)}-${architecture.label}.jsonl`);
    const cachedRows = readJsonLines(cachePath);
    const byCaseId = new Map(cachedRows.map((row) => [row.case_id, row]));
    for (const row of cachedRows) {
      if (
        row.fixture_sha256 !== manifest.fixture.sha256 ||
        row.architecture_commit !== architecture.commit ||
        row.model_requested !== model
      ) {
        throw new Error(`Cache metadata mismatch in ${cachePath} for ${row.case_id}.`);
      }
    }
    cellState[key] = { model, architecture, cachePath, rows: cachedRows, byCaseId };
  }
}

let attempted = Object.values(cellState).reduce((count, cell) => count + cell.rows.length, 0);
for (const [caseIndex, caseItem] of fixture.entries()) {
  const caseId = caseItem.case_id || caseItem.id || `case-${caseIndex + 1}`;
  const architectureOrder = caseIndex % 2 === 0
    ? [architectures.base, architectures.candidate]
    : [architectures.candidate, architectures.base];
  const pending = models.flatMap((model) =>
    architectureOrder
      .map((architecture) => cellState[`${model}:${architecture.label}`])
      .filter((cell) => !cell.byCaseId.has(caseId)),
  );

  await Promise.all(pending.map(async (cell) => {
    const startedAt = new Date();
    const request = {
      model: cell.model,
      ...(reasoningEffort && /^(gpt-5|o\d)/i.test(cell.model) ? { reasoning_effort: reasoningEffort } : {}),
      response_format: cell.architecture.response_format,
      messages: [
        { role: "system", content: cell.architecture.system_prompt },
        { role: "user", content: caseItem.raw_note },
      ],
    };
    let record;
    try {
      const response = await client.chat.completions.create(request);
      const rawText = response.choices?.[0]?.message?.content || "";
      let rawDraft = null;
      let responseParseError = "";
      try {
        rawDraft = JSON.parse(rawText || "{}");
      } catch (error) {
        responseParseError = error?.message || String(error);
      }
      record = {
        schema_version: "service-assembler-live-response-v1",
        run_id: runId,
        fixture_sha256: manifest.fixture.sha256,
        case_id: caseId,
        id: caseItem.id || caseId,
        category: caseItem.category || "",
        raw_note: caseItem.raw_note,
        raw_service_phrase: caseItem.raw_service_phrase || "",
        expected: caseItem.expected || {},
        architecture_label: cell.architecture.label,
        architecture_commit: cell.architecture.commit,
        model_requested: cell.model,
        model_returned: response.model || "",
        request_settings: requestSettings,
        request_id: response._request_id || response.id || "",
        response_created: response.created || null,
        token_usage: tokenUsage(response),
        raw_response_text: rawText,
        raw_draft: rawDraft,
        response_parse_error: responseParseError,
        api_error: responseParseError,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
      };
    } catch (error) {
      record = {
        schema_version: "service-assembler-live-response-v1",
        run_id: runId,
        fixture_sha256: manifest.fixture.sha256,
        case_id: caseId,
        id: caseItem.id || caseId,
        category: caseItem.category || "",
        raw_note: caseItem.raw_note,
        raw_service_phrase: caseItem.raw_service_phrase || "",
        expected: caseItem.expected || {},
        architecture_label: cell.architecture.label,
        architecture_commit: cell.architecture.commit,
        model_requested: cell.model,
        model_returned: "",
        request_settings: requestSettings,
        request_id: "",
        response_created: null,
        token_usage: null,
        raw_response_text: "",
        raw_draft: null,
        response_parse_error: "",
        api_error: error?.message || String(error),
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
      };
    }
    appendFileSync(cell.cachePath, `${JSON.stringify(record)}\n`);
    cell.rows.push(record);
    cell.byCaseId.set(caseId, record);
    attempted += 1;
    console.log(
      `[${attempted}/${manifest.planned_calls}] ${caseId} ${cell.model} ${cell.architecture.label} ` +
      `${record.api_error ? `ERROR ${record.api_error}` : `${record.token_usage?.total_tokens ?? "?"} tokens`}`,
    );
  }));
}

const evaluatorPath = resolve(candidateRoot, "scripts/eval-offline-dataset.js");
const evaluationFiles = {};
for (const [key, cell] of Object.entries(cellState)) {
  const successful = cell.rows.filter((row) => !row.api_error && row.raw_draft).length;
  if (successful !== fixture.length) {
    console.warn(`Skipping deterministic evaluation for ${key}: ${successful}/${fixture.length} successful responses.`);
    continue;
  }
  const stem = `eval-${slug(cell.model)}-${cell.architecture.label}`;
  const outputPath = resolve(outputDir, `${stem}.jsonl`);
  const summaryPath = resolve(outputDir, `${stem}-summary.json`);
  execFileSync(process.execPath, [
    evaluatorPath,
    "--input", cell.cachePath,
    "--output", outputPath,
    "--summary", summaryPath,
    "--pipeline-root", cell.architecture.root,
  ], { cwd: candidateRoot, stdio: "inherit" });
  evaluationFiles[key] = { outputPath, summaryPath };
}

const comparison = {
  schema_version: "service-assembler-live-ab-comparison-v1",
  run_id: runId,
  fixture: manifest.fixture,
  models,
  architectures: manifest.architectures,
  request_settings: requestSettings,
  cells: {},
  architecture_comparisons: {},
};

for (const [key, cell] of Object.entries(cellState)) {
  const summary = evaluationFiles[key]
    ? JSON.parse(readFileSync(evaluationFiles[key].summaryPath, "utf8"))
    : null;
  comparison.cells[key] = summarizeCell(summary, cell.rows);
}

for (const model of models) {
  const baseKey = `${model}:base`;
  const candidateKey = `${model}:candidate`;
  if (!evaluationFiles[baseKey] || !evaluationFiles[candidateKey]) {
    comparison.architecture_comparisons[model] = {
      complete: false,
      behavioral_difference_count: null,
      behavioral_differences: [],
    };
    continue;
  }
  const baseRows = new Map(readJsonLines(evaluationFiles[baseKey].outputPath).map((row) => [row.case_id, row]));
  const candidateRows = new Map(readJsonLines(evaluationFiles[candidateKey].outputPath).map((row) => [row.case_id, row]));
  const behavioralDifferences = [];
  for (const caseItem of fixture) {
    const caseId = caseItem.case_id || caseItem.id;
    const baseProjection = architectureProjection(baseRows.get(caseId) || {});
    const candidateProjection = architectureProjection(candidateRows.get(caseId) || {});
    if (JSON.stringify(baseProjection) !== JSON.stringify(candidateProjection)) {
      behavioralDifferences.push({
        case_id: caseId,
        base: baseProjection,
        candidate: candidateProjection,
      });
    }
  }
  comparison.architecture_comparisons[model] = {
    complete: true,
    behavioral_difference_count: behavioralDifferences.length,
    behavioral_differences: behavioralDifferences,
  };
}

const comparisonJsonPath = resolve(outputDir, "comparison.json");
const comparisonMarkdownPath = resolve(outputDir, "comparison.md");
writeFileSync(comparisonJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
writeFileSync(comparisonMarkdownPath, renderMarkdown(comparison));
writeFileSync(manifestPath, `${JSON.stringify({
  ...manifest,
  execute: true,
  finished_at: new Date().toISOString(),
  comparison_json: comparisonJsonPath,
  comparison_markdown: comparisonMarkdownPath,
}, null, 2)}\n`);

console.log(JSON.stringify({
  status: "complete",
  attempted_calls: attempted,
  output_dir: outputDir,
  comparison_json: comparisonJsonPath,
  comparison_markdown: comparisonMarkdownPath,
}, null, 2));
