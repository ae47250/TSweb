import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_DATASET = "C:\\Users\\eiriksson\\Downloads\\messy-price-scope-100-customer-notes.md";
const REPORT_DIR = path.join(process.cwd(), "reports");
const WORKTREE_ROOT = path.join(process.cwd(), "reports", "compare-version-study", "worktrees");

const TARGETS = [
  { key: "dashboard_first", label: "First dashboard commit", ref: "96fd9a3" },
  { key: "last_push", label: "Last pushed commit", ref: "79b911b" },
  { key: "working_copy", label: "Current working copy", path: process.cwd() },
];

const MONEY_PATTERN = /\$?\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*k|\d{3,6})\b/gi;
const CLEAR_LABEL_PATTERN = /\b(?:option\s*[ab12]|opt\s*[ab12]|\b[ab]\b|remove\s+only|drop\s+only|cut\s+only|haul|hual|hawl|cleanup|clean\s*up|stump|grind|full|base|quote)\b/i;
const UNCLEAR_PRICE_PATTERN = /\b(?:maybe|around|about|roughly|approx|ish|not\s+sure|could\s+be|if\s+needed|depending|depends|between|old\s+quote|not\s+final|unknown|blank|\?)\b/i;
const UNCLEAR_SCOPE_PATTERN = /\b(?:unclear|not\s+sure|same\s+as\s+talked|tree\s+stuff|take\s+care|fix\s+it|get\s+it\s+done|handled|make\s+safe|good\s+one|cheap\s+one|with\s+stuff|do\s+the|scope\s+just|no\s+detail|no\s+details|no\s+label|no\s+labels|no\s+precise\s+scope|maybe\s+removal|maybe\s+heavy\s+trim)\b/i;
const PHONE_PATTERN = /\b(?:\d{3})[-.\s]?(?:\d{3})[-.\s]?(\d{4})\b/g;
const ADDRESS_PATTERN = /\b(\d{3,5})\s+[A-Z][A-Za-z0-9.]*\s+(?:St|Street|Road|Rd|Ave|Avenue|Lane|Ln|Drive|Dr|Court|Ct|Way|Pike|Trail|Trl|Highway|Hwy)\b/gi;

function timestampParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    stamp: `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`,
    utc: now.toISOString(),
    eastern: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now),
  };
}

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options }).trim();
}

function ensureWorktree(target) {
  if (target.path) return target.path;
  fs.mkdirSync(WORKTREE_ROOT, { recursive: true });
  const targetPath = path.join(WORKTREE_ROOT, target.key);
  if (!fs.existsSync(targetPath)) {
    git(["worktree", "add", "--detach", targetPath, target.ref], { stdio: "pipe" });
  }
  return targetPath;
}

function parseDataset(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^case\s+(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+)$/i);
      if (!match) throw new Error(`Unsupported dataset line: ${line}`);
      return {
        case_id: `case-${match[1].padStart(3, "0")}`,
        case_number: Number(match[1]),
        category: match[2].trim(),
        raw_input: match[3].trim(),
      };
    });
}

function normalizeMoney(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, "").trim();
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return `$${Math.round(Number(kMatch[1]) * 1000).toLocaleString("en-US")}`;
  const numeric = text.replace(/[^\d]/g, "");
  if (!numeric) return "";
  return `$${Number(numeric).toLocaleString("en-US")}`;
}

function sentenceAround(text, index) {
  const before = text.lastIndexOf(".", index);
  const after = text.indexOf(".", index);
  return text.slice(before < 0 ? 0 : before + 1, after < 0 ? text.length : after).trim();
}

function rawPriceEvidence(rawInput) {
  const evidence = [];
  const phoneLastFour = new Set([...rawInput.matchAll(PHONE_PATTERN)].map((match) => normalizeMoney(match[1])).filter(Boolean));
  const addressNumbers = new Set([...rawInput.matchAll(ADDRESS_PATTERN)].map((match) => normalizeMoney(match[1])).filter(Boolean));

  for (const match of rawInput.matchAll(MONEY_PATTERN)) {
    const display = normalizeMoney(match[0]);
    if (!display) continue;
    const context = sentenceAround(rawInput, match.index || 0);
    const lowerContext = context.toLowerCase();
    const supported =
      CLEAR_LABEL_PATTERN.test(context) ||
      UNCLEAR_PRICE_PATTERN.test(context) ||
      /\b(?:price|prices|quote|quoted|wrote|number|budget|total|each|per)\b/i.test(context);
    const excluded = phoneLastFour.has(display) || addressNumbers.has(display);
    evidence.push({
      display,
      context,
      clear: supported && !UNCLEAR_PRICE_PATTERN.test(context) && !excluded,
      approximate: supported && UNCLEAR_PRICE_PATTERN.test(context) && !excluded,
      excluded,
      exclusion_reason: phoneLastFour.has(display) ? "phone-last-four" : addressNumbers.has(display) ? "address-number" : "",
      supported,
    });
  }

  return evidence;
}

function expectedForCase(testCase) {
  const evidence = rawPriceEvidence(testCase.raw_input);
  const clear = evidence.filter((item) => item.clear);
  const approximate = evidence.filter((item) => item.approximate);
  const supported = evidence.filter((item) => (item.clear || item.approximate) && !item.excluded);
  const clearUnique = [...new Set(clear.map((item) => item.display))];
  return {
    evidence,
    clear_prices: clearUnique,
    supported_prices: [...new Set(supported.map((item) => item.display))],
    approximate_prices: [...new Set(approximate.map((item) => item.display))],
    should_keep_clear_prices: clearUnique.length > 0,
    should_block_for_unclear_price: testCase.category === "unclear_price_language" || approximate.length > 0,
    should_block_or_override_for_scope:
      testCase.category === "clear_prices_unclear_work_scope" ||
      testCase.category === "two_clear_prices_one_clear_option_scope" ||
      UNCLEAR_SCOPE_PATTERN.test(testCase.raw_input),
  };
}

function optionPrices(alphaJson = {}) {
  return (alphaJson.service_options?.items || [])
    .map((option, index) => ({
      label: option.label || `Option ${String.fromCharCode(65 + index)}`,
      title: option.title || "",
      description: option.description || "",
      display: option.price?.display || "",
      amount: option.price?.amount ?? null,
      is_unclear: Boolean(option.price?.is_unclear),
    }))
    .filter((item) => item.display || item.amount != null || item.is_unclear);
}

function followUpText(validation = {}) {
  return [
    ...(validation.follow_ups || []),
    ...(validation.alphaJson?.validation?.tree_dude_follow_ups || []),
    ...((validation.alphaJson?.validation?.structured_follow_ups || []).map((item) => item.question).filter(Boolean)),
  ].join(" | ");
}

function combinedValidationText(validation = {}) {
  return [
    ...(validation.blocking_errors || []),
    ...(validation.warnings || []),
    followUpText(validation),
    ...(validation.alphaJson?.validation?.unclear_prices || []),
    ...(validation.alphaJson?.validation?.missing_required_fields || []),
  ].join(" | ");
}

function priceDropdownActive(validation = {}) {
  return /\b(price|priced|cost|amount|firm|quote)\b/i.test(combinedValidationText(validation));
}

function scopeOverrideAvailable(validation = {}) {
  const text = combinedValidationText(validation);
  return /work scope unclear|scope is unclear|confirm what this price covers|remove, trim, or another service/i.test(text);
}

async function loadPipeline(versionPath) {
  const normalizeModule = await import(pathToFileURL(path.join(versionPath, "lib", "normalizeAlphaJson.js")).href);
  const validateModule = await import(pathToFileURL(path.join(versionPath, "lib", "validateJson.js")).href);
  let reviewModule = {};
  try {
    reviewModule = await import(pathToFileURL(path.join(versionPath, "lib", "reviewOverrides.js")).href);
  } catch {
    reviewModule = {};
  }
  return {
    normalizeToAlphaJsonV14: normalizeModule.normalizeToAlphaJsonV14,
    validateAlphaJson: validateModule.validateAlphaJson,
    getBlockingOverrideStatus: reviewModule.getBlockingOverrideStatus || null,
  };
}

function evaluateFlags(testCase, validation, alphaJson, expected, overrideStatus) {
  const prices = optionPrices(validation.alphaJson || alphaJson || {});
  const displayed = prices.map((price) => normalizeMoney(price.display || price.amount)).filter(Boolean);
  const displayedSet = new Set(displayed);
  const supportedSet = new Set(expected.supported_prices);
  const clearSet = new Set(expected.clear_prices);
  const unsupportedDisplayed = displayed.filter((price) => !supportedSet.has(price));
  const missingClear = expected.clear_prices.filter((price) => !displayedSet.has(price));
  const validationText = combinedValidationText(validation);
  const scopeIssueVisible =
    /work scope unclear|scope is unclear|confirm what this price covers|remove, trim, or another service/i.test(validationText) ||
    Boolean(overrideStatus?.needsScopeOverride);
  const priceIssueVisible = /\b(price|priced|cost|amount|firm|quote)\b/i.test(validationText);
  const anyDisplayedApproximate = displayed.some((price) => expected.approximate_prices.includes(price));
  const scopeOverrideProceeds = Boolean(overrideStatus?.needsScopeOverride && overrideStatus?.canProceed);
  const phoneAddressInvented = prices.some((price) => {
    const value = normalizeMoney(price.display || price.amount);
    return expected.evidence.some((item) => item.display === value && item.excluded);
  });

  return {
    missing_raw_supported_price: missingClear.length > 0,
    correct_option_price_assignment: expected.clear_prices.length ? missingClear.length === 0 : displayed.length === 0 || supportedSet.size > 0,
    correct_option_scope_assignment: expected.should_block_or_override_for_scope ? scopeIssueVisible || !validation.can_generate_pdf : true,
    fake_price_display: displayed.length > 0 && supportedSet.size === 0,
    unsupported_td2_price: unsupportedDisplayed.length > 0,
    unexpected_ready:
      validation.can_generate_pdf &&
      (expected.should_block_for_unclear_price || (expected.should_block_or_override_for_scope && !scopeIssueVisible)),
    unnecessary_price_dropdown: !expected.should_block_for_unclear_price && !expected.should_keep_clear_prices && priceDropdownActive(validation),
    appropriate_dropdown_followup:
      expected.should_block_for_unclear_price || expected.should_block_or_override_for_scope
        ? !validation.can_generate_pdf && (priceIssueVisible || scopeIssueVisible || followUpText(validation))
        : true,
    clear_price_scope_overrideable:
      testCase.category === "clear_prices_unclear_work_scope" ? expected.clear_prices.length > 0 && (scopeOverrideAvailable(validation) || scopeOverrideProceeds) : null,
    clear_price_scope_override_proceeds:
      testCase.category === "clear_prices_unclear_work_scope" ? expected.clear_prices.length > 0 && scopeOverrideProceeds : null,
    approximate_price_preserved_uncertain: anyDisplayedApproximate ? prices.some((price) => price.is_unclear) || !validation.can_generate_pdf : true,
    phone_address_number_used_as_price: phoneAddressInvented,
    missing_clear_prices: missingClear,
    unsupported_displayed_prices: unsupportedDisplayed,
    displayed_prices: displayed,
  };
}

async function runVersion(target, cases) {
  const versionPath = ensureWorktree(target);
  const pipeline = await loadPipeline(versionPath);
  const rows = [];

  for (const testCase of cases) {
    const expected = expectedForCase(testCase);
    let alphaJson = null;
    let validation = null;
    let error = "";
    try {
      alphaJson = pipeline.normalizeToAlphaJsonV14({}, testCase.raw_input, {});
      validation = pipeline.validateAlphaJson(alphaJson);
    } catch (caught) {
      error = caught?.stack || String(caught);
      validation = { can_generate_pdf: false, blocking_errors: [error], warnings: [], follow_ups: [], alphaJson: alphaJson || {} };
    }

    const finalAlphaJson = validation.alphaJson || alphaJson || {};
    const overrideStatus = pipeline.getBlockingOverrideStatus
      ? pipeline.getBlockingOverrideStatus(validation, { unclearScopeWithPrice: true }, finalAlphaJson)
      : null;
    const flags = evaluateFlags(testCase, validation, alphaJson, expected, overrideStatus);
    rows.push({
      version_key: target.key,
      version_label: target.label,
      version_ref: target.ref || "working-copy",
      case_id: testCase.case_id,
      category: testCase.category,
      raw_input: testCase.raw_input,
      expected,
      actual: {
        can_generate_pdf: Boolean(validation.can_generate_pdf),
        blocking_errors: validation.blocking_errors || [],
        warnings: validation.warnings || [],
        follow_ups: validation.follow_ups || [],
        td2_displayed_options: optionPrices(finalAlphaJson),
        unclear_scope_override_status: overrideStatus,
      },
      flags,
      pipeline_error: error,
    });
  }

  return rows;
}

function pct(count, total) {
  return total ? `${((count / total) * 100).toFixed(1)}%` : "0.0%";
}

function summarize(rows) {
  const total = rows.length;
  const count = (flag) => rows.filter((row) => row.flags[flag]).length;
  const scopeOverrideRows = rows.filter((row) => row.flags.clear_price_scope_overrideable !== null);
  const categoryNames = [...new Set(rows.map((row) => row.category))];
  return {
    total,
    missing_raw_supported_price: count("missing_raw_supported_price"),
    correct_option_price_assignment: rows.filter((row) => row.flags.correct_option_price_assignment).length,
    correct_option_scope_assignment: rows.filter((row) => row.flags.correct_option_scope_assignment).length,
    fake_price_display: count("fake_price_display"),
    unsupported_td2_price: count("unsupported_td2_price"),
    unexpected_ready: count("unexpected_ready"),
    unnecessary_price_dropdown: count("unnecessary_price_dropdown"),
    appropriate_dropdown_followup: rows.filter((row) => row.flags.appropriate_dropdown_followup).length,
    clear_price_scope_override_relevant: scopeOverrideRows.length,
    clear_price_scope_overrideable: scopeOverrideRows.filter((row) => row.flags.clear_price_scope_overrideable).length,
    clear_price_scope_override_proceeds: scopeOverrideRows.filter((row) => row.flags.clear_price_scope_override_proceeds).length,
    approximate_price_preserved_uncertain: rows.filter((row) => row.flags.approximate_price_preserved_uncertain).length,
    phone_address_number_used_as_price: count("phone_address_number_used_as_price"),
    by_category: Object.fromEntries(
      categoryNames.map((category) => {
        const subset = rows.filter((row) => row.category === category);
        return [
          category,
          {
            total: subset.length,
            missing_raw_supported_price: subset.filter((row) => row.flags.missing_raw_supported_price).length,
            unsupported_td2_price: subset.filter((row) => row.flags.unsupported_td2_price).length,
            unexpected_ready: subset.filter((row) => row.flags.unexpected_ready).length,
            scope_overrideable: subset.filter((row) => row.flags.clear_price_scope_overrideable).length,
            scope_override_proceeds: subset.filter((row) => row.flags.clear_price_scope_override_proceeds).length,
          },
        ];
      }),
    ),
  };
}

function renderSummaryTable(summaries) {
  const rows = [
    "| Version | Total | Missing clear price | Price assignment OK | Scope assignment OK | Fake price | Unsupported TD2 price | Unexpected ready | Unneeded price dropdown | Appropriate dropdown/follow-up | Scope override visible | Scope override proceeds | Phone/address price errors |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const [version, summary] of Object.entries(summaries)) {
    rows.push(
      [
        version,
        summary.total,
        `${summary.missing_raw_supported_price} (${pct(summary.missing_raw_supported_price, summary.total)})`,
        `${summary.correct_option_price_assignment} (${pct(summary.correct_option_price_assignment, summary.total)})`,
        `${summary.correct_option_scope_assignment} (${pct(summary.correct_option_scope_assignment, summary.total)})`,
        `${summary.fake_price_display} (${pct(summary.fake_price_display, summary.total)})`,
        `${summary.unsupported_td2_price} (${pct(summary.unsupported_td2_price, summary.total)})`,
        `${summary.unexpected_ready} (${pct(summary.unexpected_ready, summary.total)})`,
        `${summary.unnecessary_price_dropdown} (${pct(summary.unnecessary_price_dropdown, summary.total)})`,
        `${summary.appropriate_dropdown_followup} (${pct(summary.appropriate_dropdown_followup, summary.total)})`,
        `${summary.clear_price_scope_overrideable}/${summary.clear_price_scope_override_relevant} (${pct(summary.clear_price_scope_overrideable, summary.clear_price_scope_override_relevant)})`,
        `${summary.clear_price_scope_override_proceeds}/${summary.clear_price_scope_override_relevant} (${pct(summary.clear_price_scope_override_proceeds, summary.clear_price_scope_override_relevant)})`,
        `${summary.phone_address_number_used_as_price} (${pct(summary.phone_address_number_used_as_price, summary.total)})`,
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }
  return rows.join("\n");
}

function renderMarkdown(payload) {
  const lines = [
    `# Messy Price/Scope Comparison ${payload.meta.stamp}`,
    "",
    "Local-only parser/validator comparison. No OpenAI calls, no production calls, no PDFs, no notifications.",
    "",
    `Generated Eastern: ${payload.meta.eastern}`,
    `Generated UTC: ${payload.meta.utc}`,
    `Dataset: ${payload.meta.datasetPath}`,
    "",
    "## Version Summary",
    "",
    renderSummaryTable(payload.summaries),
    "",
    "## Category Detail",
    "",
  ];

  for (const [version, summary] of Object.entries(payload.summaries)) {
    lines.push(`### ${version}`, "");
    lines.push("| Category | Total | Missing clear price | Unsupported TD2 price | Unexpected ready | Scope override visible | Scope override proceeds |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|");
    for (const [category, item] of Object.entries(summary.by_category)) {
      lines.push(`| ${category} | ${item.total} | ${item.missing_raw_supported_price} | ${item.unsupported_td2_price} | ${item.unexpected_ready} | ${item.scope_overrideable}/${item.total} | ${item.scope_override_proceeds}/${item.total} |`);
    }
    lines.push("");
  }

  lines.push("## Worst Current Working-Copy Rows", "");
  lines.push("| Case | Category | Flags | Displayed prices | Blocking/follow-up |");
  lines.push("|---|---|---|---|---|");
  const currentRows = payload.rows.filter((row) => row.version_key === "working_copy");
  const problemRows = currentRows.filter((row) =>
    [
      "missing_raw_supported_price",
      "fake_price_display",
      "unsupported_td2_price",
      "unexpected_ready",
      "phone_address_number_used_as_price",
    ].some((flag) => row.flags[flag]),
  );
  for (const row of problemRows.slice(0, 40)) {
    const flags = Object.entries(row.flags)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .join(", ");
    const prices = row.actual.td2_displayed_options.map((option) => `${option.label} ${option.display}`).join("; ");
    const blockers = [...row.actual.blocking_errors, ...row.actual.follow_ups].join("; ");
    lines.push(
      `| ${row.case_id} | ${row.category} | ${flags.replace(/\|/g, "\\|")} | ${prices.replace(/\|/g, "\\|")} | ${blockers.replace(/\|/g, "\\|")} |`,
    );
  }

  lines.push("", "## Notes", "");
  lines.push("- Clear raw-supported price means the note has a price-like number in a price/option context without uncertainty words and not identified as phone/address evidence.");
  lines.push("- Approximate prices are allowed to appear only if they remain uncertain or the case blocks for confirmation.");
  lines.push("- Scope override OK measures whether clear-price/vague-scope cases expose a scope blocker/override path instead of silently becoming ready.");
  lines.push("- Historical versions are run from detached git worktrees under reports/compare-version-study/worktrees.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const datasetPath = process.argv[2] || DEFAULT_DATASET;
const cases = parseDataset(datasetPath);
const meta = {
  ...timestampParts(),
  datasetPath,
  currentCommit: git(["rev-parse", "HEAD"]),
  currentBranch: git(["branch", "--show-current"]),
  dirtyFiles: git(["status", "--short"], "").split(/\r?\n/).filter(Boolean).length,
};

fs.mkdirSync(REPORT_DIR, { recursive: true });

const rows = [];
for (const target of TARGETS) {
  rows.push(...(await runVersion(target, cases)));
}

const summaries = Object.fromEntries(
  TARGETS.map((target) => {
    const versionRows = rows.filter((row) => row.version_key === target.key);
    return [`${target.label} (${target.ref || "working copy"})`, summarize(versionRows)];
  }),
);

const payload = { meta, targets: TARGETS, summaries, rows };
const baseName = `messy-price-scope-comparison-${meta.stamp}`;
const jsonPath = path.join(REPORT_DIR, `${baseName}.json`);
const jsonlPath = path.join(REPORT_DIR, `${baseName}.jsonl`);
const mdPath = path.join(REPORT_DIR, `${baseName}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(jsonlPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
fs.writeFileSync(mdPath, renderMarkdown(payload));

console.log(JSON.stringify({ mdPath, jsonPath, jsonlPath, summaries }, null, 2));
