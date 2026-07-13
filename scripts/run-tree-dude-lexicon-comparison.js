import fs from "node:fs";
import path from "node:path";
import { inferLegacyServiceKindDetails } from "../lib/canonicalServiceAssembler.js";
import { classifyTreeServiceScope } from "../lib/treeServiceLexicon.js";

const FIXTURE_PATH = path.join(process.cwd(), "tests", "fixtures", "tree-dude-service-classification-60.json");
const REPORT_DIR = path.join(process.cwd(), "reports");
const BASELINE_PATH = path.join(REPORT_DIR, "tree-dude-lexicon-v3-baseline.json");
const LOCAL_JSON_PATH = path.join(REPORT_DIR, "tree-dude-lexicon-local-comparison.json");
const LOCAL_MD_PATH = path.join(REPORT_DIR, "tree-dude-lexicon-local-disagreements.md");
const PREVIEW_JSON_PATH = path.join(REPORT_DIR, "tree-dude-lexicon-preview-comparison.json");
const PREVIEW_MD_PATH = path.join(REPORT_DIR, "tree-dude-lexicon-preview-comparison.md");
const V3_BASE_URL = process.env.V3_BASE_URL || "https://tree-service-web-app.vercel.app";
const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL || "";

function fixtures() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function serviceOptions(alphaJson = {}) {
  return alphaJson.service_options?.items || [];
}

function validationView(response = {}) {
  return {
    can_generate_pdf: Boolean(response.can_generate_pdf ?? response.alphaJson?.validation?.can_generate_pdf),
    blocking_errors: response.blocking_errors || response.alphaJson?.validation?.blocking_errors || [],
    follow_ups: response.follow_ups || response.alphaJson?.validation?.tree_dude_follow_ups || [],
    warnings: response.warnings || response.alphaJson?.validation?.warnings || [],
    review_required: Boolean(response.alphaJson?.review?.review_required),
  };
}

function td2View(response = {}) {
  const alphaJson = response.alphaJson || {};
  const customer = alphaJson.customer || {};
  const job = alphaJson.job || {};
  return {
    customer: {
      name: customer.name || customer.display_name || "",
      phone: customer.phone_primary || customer.phone || "",
      email: customer.email || "",
    },
    service_address: job.service_address?.display || customer.service_address || customer.address?.display || "",
    tree_count: job.tree_details?.tree_count || "",
    options: serviceOptions(alphaJson).map((option, index) => ({
      label: option.label || `Option ${String.fromCharCode(65 + index)}`,
      title: option.title || "",
      description: option.description || "",
      amount: option.price?.amount ?? null,
      display: option.price?.display || "",
      is_unclear: Boolean(option.price?.is_unclear),
      service_kind: option.canonical_service_item?.service_kind || "",
      relationship_type: option.canonical_service_item?.relationship_type || "",
    })),
    validation: validationView(response),
  };
}

async function postJson(url, body, attempt = 1) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(parsed).slice(0, 500)}`);
    return { status: response.status, body: parsed };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      return postJson(url, body, attempt + 1);
    }
    throw error;
  }
}

async function captureBaseline() {
  if (fs.existsSync(BASELINE_PATH) && !process.argv.includes("--force")) {
    throw new Error(`${BASELINE_PATH} already exists. Use --force only to intentionally replace the frozen baseline.`);
  }
  const records = [];
  const allFixtures = fixtures();
  for (const [index, fixture] of allFixtures.entries()) {
    const openai = await postJson(`${V3_BASE_URL}/api/openai`, {
      case_id: fixture.id,
      customer_text: fixture.raw_note,
    });
    const validate = await postJson(`${V3_BASE_URL}/api/validate`, {
      alphaJson: openai.body.alphaJson,
      customer_text: fixture.raw_note,
    });
    records.push({
      id: fixture.id,
      category: fixture.category,
      raw_note: fixture.raw_note,
      raw_service_phrase: fixture.raw_service_phrase,
      expected: fixture.expected,
      openai_status: openai.status,
      validate_status: validate.status,
      mocked: Boolean(openai.body.mocked),
      openai_response: openai.body,
      validate_response: validate.body,
      final_td2: td2View(validate.body),
    });
    console.log(`${index + 1}/${allFixtures.length} ${fixture.id} baseline ${validate.body.can_generate_pdf ? "ready" : "blocked"}`);
  }
  const payload = {
    captured_at: new Date().toISOString(),
    source: "current deployed V3",
    base_url: V3_BASE_URL,
    fixture_path: path.relative(process.cwd(), FIXTURE_PATH),
    request_count: records.length * 2,
    records,
  };
  writeJson(BASELINE_PATH, payload);
  console.log(JSON.stringify({ baseline_path: BASELINE_PATH, records: records.length, request_count: payload.request_count }, null, 2));
}

function optionSummary(options = []) {
  return options.slice(0, 2).map((option) =>
    `${option.label}: ${option.title || option.description || "scope missing"} ${option.display || "price missing"}`,
  ).join("; ");
}

function localRuleFailures(fixture, shared) {
  const failures = [];
  const expectedKinds = fixture.expected.service_kinds || [];
  for (const kind of expectedKinds) {
    if (!shared.candidate_kinds.includes(kind)) failures.push(`missing_kind:${kind}`);
  }
  if (fixture.category === "straightforward_base" && (shared.relationship_role !== "base_service" || shared.review_required)) {
    failures.push("base_service_changed_or_reviewed");
  }
  if (["clear_dependent_addon", "explicit_option_totals"].includes(fixture.category)) {
    if (shared.relationship_role !== "base_with_dependent_addon") failures.push("dependent_addon_not_recognized");
    if (shared.review_required) failures.push("clear_addon_marked_for_review");
    if (shared.price_role_hint !== fixture.expected.option_b_price_role) failures.push("wrong_price_role");
  }
  if (fixture.category === "independent_alternatives") {
    if (shared.relationship_role !== "independent_alternative") failures.push("independent_option_reclassified");
    if (!shared.review_required) failures.push("independent_option_auto_bundled");
  }
  if (fixture.category === "ambiguous_review" && !shared.review_required) failures.push("ambiguous_scope_auto_resolved");
  return failures;
}

function renderLocalMarkdown(payload) {
  const lines = [
    "# Tree Dude Shared-Lexicon Local Comparison",
    "",
    `Frozen baseline: \`${path.relative(process.cwd(), BASELINE_PATH)}\``,
    "",
    `- Notes: ${payload.summary.total}`,
    `- Classifier disagreements: ${payload.summary.classifier_disagreements}`,
    `- Strict-rule failures: ${payload.summary.strict_rule_failures}`,
    `- Local AI calls: 0`,
    `- TD2 mutations during local classification: 0`,
    "",
    "| Raw service phrase | V3 interpretation | Shared-lexicon interpretation | Option/price impact | Ready/block impact |",
    "|---|---|---|---|---|",
  ];
  for (const row of payload.rows) {
    const cells = [
      row.raw_service_phrase,
      `${row.v3.service_kind || "unresolved"} (${row.v3.reason_code})`,
      `${row.shared.candidate_kinds.join(" + ") || "unresolved"}; ${row.shared.relationship_role}; ${row.shared.price_role_hint}`,
      row.option_price_impact,
      row.ready_block_impact,
    ];
    lines.push(`| ${cells.map(escapeCell).join(" | ")} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function runLocalComparison() {
  if (!fs.existsSync(BASELINE_PATH)) throw new Error(`Missing frozen baseline: ${BASELINE_PATH}`);
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const rows = baseline.records.map((record) => {
    const v3 = inferLegacyServiceKindDetails(record.raw_service_phrase);
    const shared = classifyTreeServiceScope(record.raw_service_phrase);
    const failures = localRuleFailures(record, shared);
    const classifierDisagreement = Boolean(v3.service_kind && shared.service_kind && v3.service_kind !== shared.service_kind);
    return {
      id: record.id,
      category: record.category,
      raw_note: record.raw_note,
      raw_service_phrase: record.raw_service_phrase,
      v3,
      shared,
      classifier_disagreement: classifierDisagreement,
      option_price_impact: `${optionSummary(record.final_td2.options)}; expected A=${record.expected.option_a_amount ?? "review"}, B=${record.expected.option_b_amount ?? "none/review"}; local classifier does not mutate TD2`,
      ready_block_impact: `V3=${record.final_td2.validation.can_generate_pdf ? "ready" : "blocked"}; shared=${shared.review_required ? "review required" : "strong evidence"}; local TD2 unchanged`,
      strict_rule_failures: failures,
    };
  });
  const payload = {
    generated_at: new Date().toISOString(),
    baseline_path: path.relative(process.cwd(), BASELINE_PATH),
    method: "Frozen deployed TD2 plus local legacy and shared classifiers; no AI calls.",
    summary: {
      total: rows.length,
      classifier_disagreements: rows.filter((row) => row.classifier_disagreement).length,
      strict_rule_failures: rows.filter((row) => row.strict_rule_failures.length).length,
      pass: rows.every((row) => row.strict_rule_failures.length === 0),
    },
    rows,
  };
  writeJson(LOCAL_JSON_PATH, payload);
  fs.writeFileSync(LOCAL_MD_PATH, renderLocalMarkdown(payload));
  console.log(JSON.stringify({ json: LOCAL_JSON_PATH, markdown: LOCAL_MD_PATH, summary: payload.summary }, null, 2));
  if (!payload.summary.pass) process.exitCode = 2;
}

function same(valueA, valueB) {
  return JSON.stringify(valueA) === JSON.stringify(valueB);
}

function previewFailures(record, baselineView, previewView) {
  const failures = [];
  if (!same(baselineView.customer, previewView.customer)) failures.push("customer_contact_changed");
  if (baselineView.service_address !== previewView.service_address) failures.push("service_address_changed");
  if (baselineView.tree_count !== previewView.tree_count) failures.push("tree_count_changed");
  if (record.category === "independent_alternatives" && !same(baselineView.options, previewView.options)) {
    failures.push("independent_options_changed");
  }
  if (["clear_dependent_addon", "explicit_option_totals"].includes(record.category)) {
    if (previewView.options[0]?.amount !== record.expected.option_a_amount) failures.push("option_a_price_mismatch");
    if (previewView.options[1]?.amount !== record.expected.option_b_amount) failures.push("option_b_price_mismatch");
  }
  if (record.category === "ambiguous_review" && !previewView.validation.review_required && previewView.validation.can_generate_pdf) {
    failures.push("ambiguous_case_became_ready_without_review");
  }
  return failures;
}

function renderPreviewMarkdown(payload) {
  const lines = [
    "# Tree Dude Preview Route Comparison",
    "",
    `Current deployed V3: ${payload.v3_base_url}`,
    `Preview candidate: ${payload.preview_base_url}`,
    `Candidate execution: ${payload.candidate_execution}`,
    "",
    "The Preview `/api/validate` route received the frozen deployed `/api/openai` AlphaJSON. No second AI call was made.",
    "",
    `- Notes: ${payload.summary.total}`,
    `- Exact TD2 matches: ${payload.summary.exact_td2_matches}`,
    `- Changed TD2 outputs: ${payload.summary.changed_td2_outputs}`,
    `- Strict-rule failures: ${payload.summary.strict_rule_failures}`,
    `- Pass: ${payload.summary.pass}`,
    "",
    "| Note | Category | Current deployed V3 A/B | Preview A/B | Readiness | Strict result |",
    "|---|---|---|---|---|---|",
  ];
  for (const row of payload.rows) {
    const cells = [
      row.id,
      row.category,
      optionSummary(row.v3.options),
      optionSummary(row.preview.options),
      `V3 ${row.v3.validation.can_generate_pdf ? "ready" : "blocked"}; Preview ${row.preview.validation.can_generate_pdf ? "ready" : "blocked"}`,
      row.strict_rule_failures.join(", ") || "pass",
    ];
    lines.push(`| ${cells.map(escapeCell).join(" | ")} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function comparePreview() {
  if (!PREVIEW_BASE_URL) throw new Error("Set PREVIEW_BASE_URL to the candidate deployment URL.");
  if (!fs.existsSync(BASELINE_PATH)) throw new Error(`Missing frozen baseline: ${BASELINE_PATH}`);
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const rows = [];
  for (const [index, record] of baseline.records.entries()) {
    const response = await postJson(`${PREVIEW_BASE_URL}/api/validate`, {
      alphaJson: record.openai_response.alphaJson,
      customer_text: record.raw_note,
    });
    const preview = td2View(response.body);
    const failures = previewFailures(record, record.final_td2, preview);
    rows.push({
      id: record.id,
      category: record.category,
      raw_note: record.raw_note,
      v3: record.final_td2,
      preview,
      exact_td2_match: same(record.final_td2, preview),
      strict_rule_failures: failures,
      preview_response: response.body,
    });
    console.log(`${index + 1}/${baseline.records.length} ${record.id} preview ${failures.length ? failures.join(",") : "pass"}`);
  }
  const payload = {
    generated_at: new Date().toISOString(),
    v3_base_url: baseline.base_url,
    preview_base_url: PREVIEW_BASE_URL,
    candidate_execution: /^https:\/\//i.test(PREVIEW_BASE_URL)
      ? "deployed Vercel Preview"
      : "local production build of the Preview commit",
    method: "Frozen deployed /api/openai AlphaJSON sent to candidate /api/validate; no second AI call.",
    summary: {
      total: rows.length,
      exact_td2_matches: rows.filter((row) => row.exact_td2_match).length,
      changed_td2_outputs: rows.filter((row) => !row.exact_td2_match).length,
      strict_rule_failures: rows.filter((row) => row.strict_rule_failures.length).length,
      pass: rows.every((row) => row.strict_rule_failures.length === 0),
    },
    rows,
  };
  writeJson(PREVIEW_JSON_PATH, payload);
  fs.writeFileSync(PREVIEW_MD_PATH, renderPreviewMarkdown(payload));
  console.log(JSON.stringify({ json: PREVIEW_JSON_PATH, markdown: PREVIEW_MD_PATH, summary: payload.summary }, null, 2));
  if (!payload.summary.pass) process.exitCode = 2;
}

const command = process.argv[2];
if (command === "baseline") await captureBaseline();
else if (command === "local") runLocalComparison();
else if (command === "preview") await comparePreview();
else throw new Error("Usage: node scripts/run-tree-dude-lexicon-comparison.js baseline|local|preview [--force]");
