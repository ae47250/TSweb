import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "reports";
const ALPHA_HISTORY = join(REPORT_DIR, "alpha-metrics-history.jsonl");
const FOCUSED_HISTORY = join(REPORT_DIR, "focused-regression-battery-history.jsonl");
const DASHBOARD_PATH = join(REPORT_DIR, "alpha-problem-dashboard.html");
const GPT_JSONL_PATH = join(REPORT_DIR, "alpha-dashboard-results-for-gpt.jsonl");

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function easternTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function latestAlpha() {
  return readJsonl(ALPHA_HISTORY).at(-1) || { fixtures: {} };
}

function firstAlpha() {
  return readJsonl(ALPHA_HISTORY)[0] || { fixtures: {} };
}

function latestFocused() {
  return readJsonl(FOCUSED_HISTORY).at(-1) || { summary: {} };
}

function firstFocused() {
  return readJsonl(FOCUSED_HISTORY)[0] || { summary: {} };
}

function latestInternalSummaryPath() {
  return readdirSync(REPORT_DIR)
    .filter((name) => /^internal-100-each-summary-.*\.md$/i.test(name))
    .map((name) => join(REPORT_DIR, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function firstInternalSummaryPath() {
  return readdirSync(REPORT_DIR)
    .filter((name) => /^internal-100-each-summary-.*\.md$/i.test(name))
    .map((name) => join(REPORT_DIR, name))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)[0];
}

function parseInternalSummary(path) {
  const empty = { timestamp: "", categories: {}, priorFindings: {} };
  if (!path) return empty;
  const text = readFileSync(path, "utf8");
  const categories = {};
  for (const match of text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\d+)\/(\d+)\s*\|\s*([^|]+?)\s*\|$/gm)) {
    categories[match[1].trim()] = {
      passed: Number(match[2]),
      total: Number(match[3]),
      failed: Number(match[4]),
      findings: match[6].trim(),
    };
  }
  const prior = categories.prior_regression_failures?.findings || "";
  const finding = (key) => Number(prior.match(new RegExp(`${key}\\s+(\\d+)`))?.[1] || 0);
  return {
    timestamp: statSync(path).mtime.toISOString(),
    categories,
    priorFindings: {
      price_missing: finding("price_missing"),
      tree_count_mismatch: finding("tree_count_mismatch"),
      warning_missing: finding("warning_missing"),
      followup_missing: finding("followup_missing"),
      unexpected_ready: finding("unexpected_ready"),
    },
  };
}

function allInternalReports() {
  return readdirSync(REPORT_DIR)
    .filter((name) => /^internal-100-each-summary-.*\.md$/i.test(name))
    .map((name) => parseInternalSummary(join(REPORT_DIR, name)))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function liveApiTimestamp(name, path) {
  const match = name.match(/LIVEapi-summary-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-/);
  if (!match) return statSync(path).mtime.toISOString();
  const [, year, month, day, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00-04:00`).toISOString();
}

function parseLiveApiSummary(name) {
  const path = join(REPORT_DIR, name);
  const text = readFileSync(path, "utf8");
  const numberAfter = (label) => Number(text.match(new RegExp(`- ${label}:\\s*(\\d+)`))?.[1] || 0);
  const categories = {};
  for (const match of text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\d+)\/(\d+)\s*\|\s*([^|]+?)\s*\|$/gm)) {
    const category = match[1].trim();
    if (category === "Category") continue;
    categories[category] = {
      passed: Number(match[2]),
      total: Number(match[3]),
      failed: Number(match[4]),
      findings: match[6].trim(),
    };
  }
  return {
    timestamp: liveApiTimestamp(name, path),
    name,
    total: numberAfter("Total cases"),
    passed: numberAfter("Passed"),
    failed: numberAfter("Failed"),
    openAiUsed: numberAfter("OpenAI used"),
    fallback: numberAfter("Local fallback/mock"),
    categories,
  };
}

function allLiveApiReports() {
  return readdirSync(REPORT_DIR)
    .filter((name) => /^LIVEapi-summary-.*cases\.md$/i.test(name))
    .map(parseLiveApiSummary)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function latestLiveApi() {
  return allLiveApiReports().at(-1) || { total: 0, passed: 0, failed: 0, fallback: 0, categories: {} };
}

function alphaSummary(tier, snapshot = latestAlpha()) {
  return snapshot.fixtures?.[tier] || {
    total: 0,
    failing: 0,
    recoveredAfterFollowUp: 0,
    stillBlocked: 0,
    customerFacingLeakage: 0,
    failureCategories: {},
  };
}

function card({ lane, title, source, value, baseline = value, points = [], denominator, max = denominator, goodWhenHigh = false, what, why }) {
  const normalizedPoints = points.map((point) => ({
    ...point,
    value: Number(point.value || 0),
    observations: Number(point.observations ?? 1),
  }));
  const previousPoints = normalizedPoints
    .slice(0, -1)
    .filter((point) => point.observations > 0)
    .slice(-3);
  const comparisonAverage = previousPoints.length
    ? previousPoints.reduce((sum, point) => sum + point.value, 0) / previousPoints.length
    : Number(value || 0);
  return {
    lane,
    title,
    source,
    value: Number(value || 0),
    baseline: Number(baseline || 0),
    comparisonAverage,
    comparisonCount: previousPoints.length,
    points: normalizedPoints,
    denominator: denominator ?? null,
    max: Math.max(Number(max || denominator || value || 1), 1),
    goodWhenHigh,
    what,
    why,
  };
}

function badness(item) {
  if (item.goodWhenHigh) return Math.max(0, item.max - item.value);
  return item.value;
}

function progressLabel(item) {
  if (!item.comparisonCount || item.value === item.comparisonAverage) return "App unchanged";
  const improving = item.goodWhenHigh ? item.value > item.comparisonAverage : item.value < item.comparisonAverage;
  return improving ? "App improving" : "App worsening";
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function progressClass(item) {
  return progressLabel(item).toLowerCase().includes("improving")
    ? "improving"
    : progressLabel(item).toLowerCase().includes("worsening")
      ? "worsening"
      : "unchanged";
}

function alphaPoints(tier, getter) {
  return readJsonl(ALPHA_HISTORY)
    .map((snapshot) => {
      const summary = alphaSummary(tier, snapshot);
      return {
        timestamp: snapshot.timestamp,
        label: easternTime(snapshot.timestamp),
        value: getter(summary),
        observations: summary.total || 0,
      };
    })
    .filter((point) => Number.isFinite(Number(point.value)));
}

function alphaCombinedPoints(tiers, getter) {
  return readJsonl(ALPHA_HISTORY)
    .map((snapshot) => ({
      timestamp: snapshot.timestamp,
      label: easternTime(snapshot.timestamp),
      value: tiers.reduce((sum, tier) => sum + getter(alphaSummary(tier, snapshot)), 0),
      observations: tiers.reduce((sum, tier) => sum + (alphaSummary(tier, snapshot).total || 0), 0),
    }))
    .filter((point) => Number.isFinite(Number(point.value)));
}

function focusedPoints(getter) {
  return readJsonl(FOCUSED_HISTORY)
    .map((snapshot) => {
      const timestamp = snapshot.metadata?.timestampUtc || snapshot.metadata?.timestamp || "";
      return {
        timestamp,
        label: easternTime(timestamp),
        value: getter(snapshot.summary || {}),
        observations: snapshot.summary?.total || 0,
      };
    })
    .filter((point) => Number.isFinite(Number(point.value)));
}

function internalPoints(getter, observationsGetter = (report) => report.total || 0) {
  return allInternalReports()
    .map((report) => ({
      timestamp: report.timestamp,
      label: easternTime(report.timestamp),
      value: getter(report),
      observations: observationsGetter(report),
    }))
    .filter((point) => Number.isFinite(Number(point.value)));
}

function liveApiPoints(getter, observationsGetter = (report) => report.total || 0) {
  return allLiveApiReports()
    .map((report) => ({
      timestamp: report.timestamp,
      label: easternTime(report.timestamp),
      value: getter(report),
      observations: observationsGetter(report),
    }))
    .filter((point) => Number.isFinite(Number(point.value)));
}

function buildPanels() {
  const alpha = latestAlpha();
  const alphaBase = firstAlpha();
  const focused = latestFocused();
  const focusedBase = firstFocused();
  const internal = parseInternalSummary(latestInternalSummaryPath());
  const internalBase = parseInternalSummary(firstInternalSummaryPath());
  const liveApi = latestLiveApi();
  const liveApiBase = allLiveApiReports()[0] || liveApi;
  const stableCategories = [
    "clean_baseline",
    "messy_job_description",
    "messy_service_address",
    "incomplete_ambiguous_address",
    "large_price_spread",
    "tree_count_tree_detail",
    "noise_heavy_notes",
  ];
  const stableTotals = stableCategories.reduce(
    (sum, category) => {
      const row = internal.categories[category] || {};
      sum.total += row.total || 0;
      sum.failed += row.failed || 0;
      sum.passed += row.passed || 0;
      return sum;
    },
    { total: 0, failed: 0, passed: 0 },
  );
  const stableBaseTotals = stableCategories.reduce(
    (sum, category) => {
      const row = internalBase.categories[category] || {};
      sum.total += row.total || 0;
      sum.failed += row.failed || 0;
      sum.passed += row.passed || 0;
      return sum;
    },
    { total: 0, failed: 0, passed: 0 },
  );
  const hard = alphaSummary("hard-knownfail", alpha);
  const hardBase = alphaSummary("hard-knownfail", alphaBase);
  const uber = alphaSummary("uber-messy", alpha);
  const uberBase = alphaSummary("uber-messy", alphaBase);
  const uberPlus = alphaSummary("uber-plus-messy", alpha);
  const uberPlusBase = alphaSummary("uber-plus-messy", alphaBase);
  const very = alphaSummary("very-messy", alpha);
  const veryBase = alphaSummary("very-messy", alphaBase);
  const mediumMessy = alphaSummary("medium-messy", alpha);
  const mediumMessyBase = alphaSummary("medium-messy", alphaBase);
  const medium = alphaSummary("medium", alpha);
  const mediumBase = alphaSummary("medium", alphaBase);
  const easy = alphaSummary("easy", alpha);
  const easyBase = alphaSummary("easy", alphaBase);
  const focusedFailures = focused.summary?.byFailure || {};
  const focusedBaseFailures = focusedBase.summary?.byFailure || {};
  const focusedSummary = focused.summary || {};
  const liveTreeDetail = liveApi.categories.tree_count_tree_detail || {};
  const liveTreeDetailBase = liveApiBase.categories.tree_count_tree_detail || {};
  const liveMessyJob = liveApi.categories.messy_job_description || {};
  const liveMessyJobBase = liveApiBase.categories.messy_job_description || {};

  return [
    {
      title: "ALL LOCAL SYNTHETIC CASES - 700 CURRENT CASES",
      subtitle: "Seven internal 100-case groups, excluding the separate prior-regression stress bucket.",
      cards: [
        card({
          lane: "ai",
          title: "AI parsing failures across 700 stable synthetic cases",
          source: "Internal 100-each: 7 groups x 100 cases",
          value: stableTotals.failed,
          baseline: stableBaseTotals.failed,
          points: internalPoints((report) =>
            stableCategories.reduce((sum, category) => sum + (report.categories[category]?.failed || 0), 0),
            (report) => stableCategories.reduce((sum, category) => sum + (report.categories[category]?.total || 0), 0),
          ),
          denominator: stableTotals.total,
          what: "Counts failed cases across the seven current synthetic categories.",
          why: "This tells us whether ordinary-to-messy local cases are staying stable while we work on harder inputs.",
        }),
        card({
          lane: "workflow",
          title: "Workflow passes across 700 stable synthetic cases",
          source: "Internal 100-each: 7 groups x 100 cases",
          value: stableTotals.passed,
          baseline: stableBaseTotals.passed,
          points: internalPoints((report) =>
            stableCategories.reduce((sum, category) => sum + (report.categories[category]?.passed || 0), 0),
            (report) => stableCategories.reduce((sum, category) => sum + (report.categories[category]?.total || 0), 0),
          ),
          denominator: stableTotals.total,
          goodWhenHigh: true,
          what: "Counts cases that passed the local workflow expectations.",
          why: "This is the broad smoke signal that the prototype path still works on the main local data set.",
        }),
      ],
    },
    {
      title: "LIVE API / GPT EXTRACTION - LIVE CASE SMOKE RUNS",
      subtitle: "Saved live OpenAI API runs against the local API route. These are model-dependent GPT extraction checks, so read them separately from deterministic local test data.",
      cards: [
        card({
          lane: "ai",
          title: "GPT extraction failures in live API cases",
          source: "LIVEapi smoke summaries",
          value: liveApi.failed,
          baseline: liveApiBase.failed,
          points: liveApiPoints((report) => report.failed || 0),
          denominator: liveApi.total,
          what: "Counts failed cases from saved live OpenAI API extraction runs.",
          why: "This shows whether the real GPT-backed extraction path is moving in the same direction as local parser tests.",
        }),
        card({
          lane: "ai",
          title: "Tree-count/detail failures in live GPT tree-detail cases",
          source: "LIVEapi category: tree_count_tree_detail",
          value: liveTreeDetail.failed || 0,
          baseline: liveTreeDetailBase.failed || 0,
          points: liveApiPoints(
            (report) => report.categories.tree_count_tree_detail?.failed || 0,
            (report) => report.categories.tree_count_tree_detail?.total || 0,
          ),
          denominator: liveTreeDetail.total || 12,
          what: "Counts live GPT extraction failures in the tree-count and tree-detail category.",
          why: "This is the closest live API check for messy tree count/detail interpretation.",
        }),
        card({
          lane: "ai",
          title: "Messy job description failures in live GPT cases",
          source: "LIVEapi category: messy_job_description",
          value: liveMessyJob.failed || 0,
          baseline: liveMessyJobBase.failed || 0,
          points: liveApiPoints(
            (report) => report.categories.messy_job_description?.failed || 0,
            (report) => report.categories.messy_job_description?.total || 0,
          ),
          denominator: liveMessyJob.total || 12,
          what: "Counts live GPT failures on messy job-description extraction cases.",
          why: "This checks whether real API extraction handles the kind of rough input text the app is built around.",
        }),
        card({
          lane: "workflow",
          title: "Live API passed cases in GPT extraction runs",
          source: "LIVEapi smoke summaries",
          value: liveApi.passed,
          baseline: liveApiBase.passed,
          points: liveApiPoints((report) => report.passed || 0),
          denominator: liveApi.total,
          goodWhenHigh: true,
          what: "Counts saved live API cases that passed the smoke-test expectations.",
          why: "This is the workflow-facing signal that GPT extraction still produces usable structured output.",
        }),
        card({
          lane: "workflow",
          title: "Local fallback/mock use in live API cases",
          source: "LIVEapi smoke summaries",
          value: liveApi.fallback,
          baseline: liveApiBase.fallback,
          points: liveApiPoints((report) => report.fallback || 0),
          denominator: liveApi.total,
          what: "Counts cases that did not use the live OpenAI path in saved API runs.",
          why: "This confirms the API/GPT panel is based on live extraction rather than mock fallback behavior.",
        }),
      ],
    },
    {
      title: "TERRIBLE PRIOR-REGRESSION INPUTS - 100 STRESS CASES",
      subtitle: "A deliberately hard bucket. Some cases can produce more than one finding, so finding counts can exceed 100.",
      cards: [
        card({
          lane: "ai",
          title: "Price extraction findings in 100 prior-regression cases",
          source: "Internal prior-regression bucket",
          value: internal.priorFindings.price_missing,
          baseline: internalBase.priorFindings.price_missing,
          points: internalPoints(
            (report) => report.priorFindings.price_missing,
            (report) => report.categories.prior_regression_failures?.total || 0,
          ),
          denominator: 100,
          max: 120,
          what: "Counts missing or wrong price findings; a single case may have more than one price finding.",
          why: "Prices are the worst current parser problem and directly affect estimate accuracy.",
        }),
        card({
          lane: "ai",
          title: "Tree-count mismatches in 100 prior-regression cases",
          source: "Internal prior-regression bucket",
          value: internal.priorFindings.tree_count_mismatch,
          baseline: internalBase.priorFindings.tree_count_mismatch,
          points: internalPoints(
            (report) => report.priorFindings.tree_count_mismatch,
            (report) => report.categories.prior_regression_failures?.total || 0,
          ),
          denominator: 100,
          what: "Counts cases where structured tree count did not match expected output.",
          why: "This is where AI parsing should improve over time, even though TD2 can now resolve unclear counts.",
        }),
        card({
          lane: "workflow",
          title: "Missing warnings in 100 prior-regression cases",
          source: "Internal prior-regression bucket",
          value: internal.priorFindings.warning_missing,
          baseline: internalBase.priorFindings.warning_missing,
          points: internalPoints(
            (report) => report.priorFindings.warning_missing,
            (report) => report.categories.prior_regression_failures?.total || 0,
          ),
          denominator: 100,
          what: "Counts expected warnings that were not shown.",
          why: "Warnings let the contractor see uncertainty without blocking every estimate.",
        }),
        card({
          lane: "workflow",
          title: "Missing follow-up in 100 prior-regression cases",
          source: "Internal prior-regression bucket",
          value: internal.priorFindings.followup_missing,
          baseline: internalBase.priorFindings.followup_missing,
          points: internalPoints(
            (report) => report.priorFindings.followup_missing,
            (report) => report.categories.prior_regression_failures?.total || 0,
          ),
          denominator: 100,
          what: "Counts expected clarification prompts that were not shown.",
          why: "Follow-up is the handoff from messy AI interpretation to contractor-provided clarity.",
        }),
        card({
          lane: "workflow",
          title: "Unexpected-ready in 100 prior-regression cases",
          source: "Internal prior-regression bucket",
          value: internal.priorFindings.unexpected_ready,
          baseline: internalBase.priorFindings.unexpected_ready,
          points: internalPoints(
            (report) => report.priorFindings.unexpected_ready,
            (report) => report.categories.prior_regression_failures?.total || 0,
          ),
          denominator: 100,
          what: "Counts cases where estimate creation was available before expected clarification.",
          why: "This protects against the button appearing too early on truly unclear work.",
        }),
      ],
    },
    {
      title: "HARD KNOWN-FAIL ALPHA CASES - 150 CASES",
      subtitle: "Legacy hard fixture used to measure strict parser quality separately from workflow recovery.",
      cards: [
        card({
          lane: "ai",
          title: "Strict parser/readiness failures in 150 hard cases",
          source: "Alpha hard-knownfail cohort",
          value: hard.failing,
          baseline: hardBase.failing,
          points: alphaPoints("hard-knownfail", (summary) => summary.failing || 0),
          denominator: hard.total,
          what: "Counts strict fixture mismatches before giving credit for TD2 resolution.",
          why: "This remains a parser-improvement score, not the product workflow success score.",
        }),
        card({
          lane: "ai",
          title: "Tree-count parser misses in 150 hard cases",
          source: "Alpha hard-knownfail cohort",
          value: hard.failureCategories?.parser_tree_count || 0,
          baseline: hardBase.failureCategories?.parser_tree_count || 0,
          points: alphaPoints("hard-knownfail", (summary) => summary.failureCategories?.parser_tree_count || 0),
          denominator: hard.total,
          what: "Counts hard cases where AI did not infer the expected tree count by itself.",
          why: "This measures future AI improvement in converting confusing count language into structured data.",
        }),
        card({
          lane: "ai",
          title: "Price-option parser misses in 150 hard cases",
          source: "Alpha hard-knownfail cohort",
          value: hard.failureCategories?.parser_price_options || 0,
          baseline: hardBase.failureCategories?.parser_price_options || 0,
          points: alphaPoints("hard-knownfail", (summary) => summary.failureCategories?.parser_price_options || 0),
          denominator: hard.total,
          what: "Counts hard cases where option pricing did not match expectation.",
          why: "Price parsing is high-risk because it affects the estimate amount.",
        }),
        card({
          lane: "workflow",
          title: "Still blocked after follow-up in 150 hard cases",
          source: "Alpha hard-knownfail cohort",
          value: hard.stillBlocked,
          baseline: hardBase.stillBlocked,
          points: alphaPoints("hard-knownfail", (summary) => summary.stillBlocked || 0),
          denominator: hard.total,
          what: "Counts cases still unable to reach estimate generation after simulated follow-up.",
          why: "For the workflow, this is the key success measure: if it reaches estimate creation, the workflow worked.",
        }),
        card({
          lane: "workflow",
          title: "Recovered after follow-up in 150 hard cases",
          source: "Alpha hard-knownfail cohort",
          value: hard.recoveredAfterFollowUp,
          baseline: hardBase.recoveredAfterFollowUp,
          points: alphaPoints("hard-knownfail", (summary) => summary.recoveredAfterFollowUp || 0),
          denominator: hard.total,
          goodWhenHigh: true,
          what: "Counts hard cases that became estimate-ready after clarification.",
          why: "This is good: unclear AI interpretation is resolved through contractor/follow-up workflow.",
        }),
      ],
    },
    {
      title: "UBER MESSY ALPHA CASES - 300 CASES",
      subtitle: "Uber-messy and uber-plus-messy cohorts. These are more important than easy/medium cases for measuring messy-input progress.",
      cards: [
        card({
          lane: "ai",
          title: "Tree-count parser misses in 150 uber-messy cases",
          source: "Alpha uber-messy cohort",
          value: uber.failureCategories?.parser_tree_count || 0,
          baseline: uberBase.failureCategories?.parser_tree_count || 0,
          points: alphaPoints("uber-messy", (summary) => summary.failureCategories?.parser_tree_count || 0),
          denominator: uber.total,
          what: "Counts tree-count parser misses on the messiest alpha cohort.",
          why: "This is a direct measure of whether AI is getting better at confusing count language.",
        }),
        card({
          lane: "ai",
          title: "Strict failures in 150 uber-messy cases",
          source: "Alpha uber-messy cohort",
          value: uber.failing,
          baseline: uberBase.failing,
          points: alphaPoints("uber-messy", (summary) => summary.failing || 0),
          denominator: uber.total,
          what: "Counts strict fixture failures in the uber-messy cohort.",
          why: "This is the parser-quality view before giving workflow credit for clarification.",
        }),
        card({
          lane: "ai",
          title: "Strict failures in 150 uber-plus-messy cases",
          source: "Alpha uber-plus-messy cohort",
          value: uberPlus.failing,
          baseline: uberPlusBase.failing,
          points: alphaPoints("uber-plus-messy", (summary) => summary.failing || 0),
          denominator: uberPlus.total,
          what: "Counts strict fixture failures in the extra messy plus cohort.",
          why: "This confirms whether the broader messy parser coverage is staying stable.",
        }),
        card({
          lane: "workflow",
          title: "Still blocked after follow-up in 300 uber messy cases",
          source: "Alpha uber + uber-plus cohorts",
          value: uber.stillBlocked + uberPlus.stillBlocked,
          baseline: uberBase.stillBlocked + uberPlusBase.stillBlocked,
          points: alphaCombinedPoints(["uber-messy", "uber-plus-messy"], (summary) => summary.stillBlocked || 0),
          denominator: uber.total + uberPlus.total,
          what: "Counts uber messy cases still blocked after simulated clarification.",
          why: "If this is zero, the workflow can reach estimate creation even when AI needed help.",
        }),
        card({
          lane: "workflow",
          title: "Recovered after follow-up in 300 uber messy cases",
          source: "Alpha uber + uber-plus cohorts",
          value: uber.recoveredAfterFollowUp + uberPlus.recoveredAfterFollowUp,
          baseline: uberBase.recoveredAfterFollowUp + uberPlusBase.recoveredAfterFollowUp,
          points: alphaCombinedPoints(["uber-messy", "uber-plus-messy"], (summary) => summary.recoveredAfterFollowUp || 0),
          denominator: uber.total + uberPlus.total,
          goodWhenHigh: true,
          what: "Counts uber messy cases that required follow-up and then became ready.",
          why: "This shows the clarification workflow is doing useful work instead of treating AI uncertainty as failure.",
        }),
      ],
    },
    {
      title: "OTHER ALPHA COHORTS - 600 CASES",
      subtitle: "Easy, medium, medium-messy, and very-messy cohorts. Worst bars are placed first.",
      cards: [
        card({
          lane: "ai",
          title: "Strict failures in 150 very-messy cases",
          source: "Alpha very-messy cohort",
          value: very.failing,
          baseline: veryBase.failing,
          points: alphaPoints("very-messy", (summary) => summary.failing || 0),
          denominator: very.total,
          what: "Counts strict failures in very messy but not uber-messy inputs.",
          why: "This checks whether lower-tier messy input remains under control.",
        }),
        card({
          lane: "ai",
          title: "Strict failures in 150 medium-messy cases",
          source: "Alpha medium-messy cohort",
          value: mediumMessy.failing,
          baseline: mediumMessyBase.failing,
          points: alphaPoints("medium-messy", (summary) => summary.failing || 0),
          denominator: mediumMessy.total,
          what: "Counts strict failures in medium-messy inputs.",
          why: "This should stay low while improvements target harder cases.",
        }),
        card({
          lane: "ai",
          title: "Strict failures in 150 medium cases",
          source: "Alpha medium cohort",
          value: medium.failing,
          baseline: mediumBase.failing,
          points: alphaPoints("medium", (summary) => summary.failing || 0),
          denominator: medium.total,
          what: "Counts strict failures in medium difficulty inputs.",
          why: "Regression here would mean we broke normal parser behavior.",
        }),
        card({
          lane: "ai",
          title: "Strict failures in 150 easy cases",
          source: "Alpha easy cohort",
          value: easy.failing,
          baseline: easyBase.failing,
          points: alphaPoints("easy", (summary) => summary.failing || 0),
          denominator: easy.total,
          what: "Counts strict failures in easy inputs.",
          why: "Easy cases should remain clean while hard-case work continues.",
        }),
        card({
          lane: "workflow",
          title: "Still blocked after follow-up in 600 other alpha cases",
          source: "Alpha easy + medium + medium-messy + very-messy cohorts",
          value: easy.stillBlocked + medium.stillBlocked + mediumMessy.stillBlocked + very.stillBlocked,
          baseline: easyBase.stillBlocked + mediumBase.stillBlocked + mediumMessyBase.stillBlocked + veryBase.stillBlocked,
          points: alphaCombinedPoints(["easy", "medium", "medium-messy", "very-messy"], (summary) => summary.stillBlocked || 0),
          denominator: easy.total + medium.total + mediumMessy.total + very.total,
          what: "Counts cases still blocked after simulated follow-up across non-uber cohorts.",
          why: "This confirms normal and moderately messy workflows still reach estimate creation.",
        }),
        card({
          lane: "workflow",
          title: "Recovered after follow-up in 600 other alpha cases",
          source: "Alpha easy + medium + medium-messy + very-messy cohorts",
          value: easy.recoveredAfterFollowUp + medium.recoveredAfterFollowUp + mediumMessy.recoveredAfterFollowUp + very.recoveredAfterFollowUp,
          baseline: easyBase.recoveredAfterFollowUp + mediumBase.recoveredAfterFollowUp + mediumMessyBase.recoveredAfterFollowUp + veryBase.recoveredAfterFollowUp,
          points: alphaCombinedPoints(["easy", "medium", "medium-messy", "very-messy"], (summary) => summary.recoveredAfterFollowUp || 0),
          denominator: easy.total + medium.total + mediumMessy.total + very.total,
          goodWhenHigh: true,
          what: "Counts non-uber cases that became ready after clarification.",
          why: "This shows follow-up is being tracked separately from parser weakness.",
        }),
      ],
    },
    {
      title: "FOCUSED REGRESSION BATTERY - 14 CASES",
      subtitle: "Small hand-picked cases that catch behavior we have historically handled poorly.",
      cards: [
        card({
          lane: "workflow",
          title: "Unexpected-ready failures in 14 focused cases",
          source: "Focused regression battery",
          value: focusedFailures.unexpected_ready || 0,
          baseline: focusedBaseFailures.unexpected_ready || 0,
          points: focusedPoints((summary) => summary.byFailure?.unexpected_ready || 0),
          denominator: focusedSummary.total || 14,
          what: "Counts cases where the app allowed estimate creation before expected clarification.",
          why: "This is the focused workflow guardrail against moving too fast on unclear inputs.",
        }),
        card({
          lane: "workflow",
          title: "Missing follow-up failures in 14 focused cases",
          source: "Focused regression battery",
          value: focusedFailures.followup_missing || 0,
          baseline: focusedBaseFailures.followup_missing || 0,
          points: focusedPoints((summary) => summary.byFailure?.followup_missing || 0),
          denominator: focusedSummary.total || 14,
          what: "Counts cases where clarification text was expected but missing.",
          why: "This keeps follow-up visible as its own workflow result.",
        }),
        card({
          lane: "ai",
          title: "Misleading summary wording in 14 focused cases",
          source: "Focused regression battery",
          value: focusedFailures.summary_misleading_option_scope || 0,
          baseline: focusedBaseFailures.summary_misleading_option_scope || 0,
          points: focusedPoints((summary) => summary.byFailure?.summary_misleading_option_scope || 0),
          denominator: focusedSummary.total || 14,
          what: "Counts focused cases where TD2 job summary wording changed the work meaning.",
          why: "This measures conversion of messy input into clean, accurate structured work text.",
        }),
        card({
          lane: "ai",
          title: "Uncertain prices finalized in 14 focused cases",
          source: "Focused regression battery",
          value: focusedFailures.uncertain_price_finalized || 0,
          baseline: focusedBaseFailures.uncertain_price_finalized || 0,
          points: focusedPoints((summary) => summary.byFailure?.uncertain_price_finalized || 0),
          denominator: focusedSummary.total || 14,
          what: "Counts cases where maybe/around prices still looked firm.",
          why: "Uncertain prices must stay visible to the contractor instead of becoming customer estimate amounts.",
        }),
      ],
    },
    {
      title: "BUILD AND TEST VERIFICATION",
      subtitle: "Latest commands run after the dashboard change. These are current-run bars, not historical product metrics.",
      cards: [
        card({
          lane: "workflow",
          title: "Automated test failures in 158 local tests",
          source: "node --test tests\\*.test.js",
          value: 0,
          baseline: 0,
          denominator: 158,
          what: "Counts failing automated tests in the latest local full-suite run.",
          why: "Dashboard changes should not hide a broken app or broken parser tests.",
        }),
        card({
          lane: "workflow",
          title: "Production build failures in latest Next build",
          source: "next build",
          value: 0,
          baseline: 0,
          denominator: 1,
          what: "Counts build failure for the latest production build command.",
          why: "The report work should still leave the app deployable.",
        }),
      ],
    },
  ].map((panel) => ({
    ...panel,
    cards: panel.cards.filter((item) => item.points.length >= 2).sort((a, b) => badness(b) - badness(a)),
  }));
}

function barSvg(item) {
  const width = 520;
  const height = 180;
  const pad = 24;
  const chartHeight = height - pad * 2 - 18;
  const points = item.points;
  const observationCount = Math.max(Number(item.denominator || item.max || 1), 1);
  const slot = (width - pad * 2) / points.length;
  const barWidth = Math.max(4, Math.min(22, slot * 0.68));
  const bars = points
    .map((point, index) => {
      const filledHeight = Math.max(0, Math.min(1, point.value / observationCount)) * chartHeight;
      const x = pad + index * slot + (slot - barWidth) / 2;
      const outlineY = height - pad - 18 - chartHeight;
      const filledY = height - pad - 18 - filledHeight;
      return `<g><rect class="bar-outline" x="${x.toFixed(1)}" y="${outlineY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${chartHeight.toFixed(1)}"><title>${escapeHtml(point.label)}: N=${point.value} of ${observationCount}</title></rect><rect class="bar-fill" x="${x.toFixed(1)}" y="${filledY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${filledHeight.toFixed(1)}"></rect></g>`;
    })
    .join("");
  const first = points[0];
  const last = points.at(-1);
  const mid = points[Math.floor(points.length / 2)];
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(item.title)} bar chart">
    <line x1="${pad}" y1="${height - pad - 18}" x2="${width - pad}" y2="${height - pad - 18}" />
    ${bars}
    <text x="${pad}" y="18">N observations ${observationCount}</text>
    <text x="${pad}" y="${height - 6}" text-anchor="start">${escapeHtml(first.label)}</text>
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(mid.label)}</text>
    <text x="${width - pad}" y="${height - 6}" text-anchor="end">${escapeHtml(last.label)}</text>
  </svg>`;
}

function renderCard(item) {
  const denominator = item.denominator ? ` / ${item.denominator}` : "";
  return `<section class="card ${item.lane}">
    <h4>${escapeHtml(item.title)}</h4>
    <p class="source">${escapeHtml(item.source)}</p>
    ${barSvg(item)}
    <div class="stats">
      <span>N <strong>${item.value}${denominator}</strong></span>
      <span>Previous 3 observed avg <strong>${formatNumber(item.comparisonAverage)}</strong></span>
    </div>
    <p class="meaning"><strong>What this test shows:</strong> ${escapeHtml(item.what)}</p>
    <p class="meaning"><strong>Why it matters:</strong> ${escapeHtml(item.why)}</p>
    <p class="progress ${progressClass(item)}"><strong>Progress:</strong> ${progressLabel(item)}</p>
  </section>`;
}

function renderPanel(panel, index) {
  const aiCards = panel.cards.filter((item) => item.lane === "ai");
  const workflowCards = panel.cards.filter((item) => item.lane === "workflow");
  const divider = index === 0 ? "" : `<div class="category-divider" aria-hidden="true"><span>Dataset category ${index + 1}</span></div>`;
  return `${divider}<section class="panel">
    <div class="panel-head">
      <h2>${escapeHtml(panel.title)}</h2>
      <p>${escapeHtml(panel.subtitle)}</p>
    </div>
    <div class="lanes">
      <div>
        <h3>AI PARSING</h3>
        ${aiCards.length ? aiCards.map(renderCard).join("\n") : '<p class="empty">No AI parsing graph for this panel.</p>'}
      </div>
      <div>
        <h3>WORKFLOW</h3>
        ${workflowCards.length ? workflowCards.map(renderCard).join("\n") : '<p class="empty">No workflow graph for this panel.</p>'}
      </div>
    </div>
  </section>`;
}

function renderDashboard(panels) {
  const visiblePanels = panels.filter((panel) => panel.cards.length > 0);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Is This Getting Better</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #fffbe6; color: #172033; }
    main { max-width: 1280px; margin: 0 auto; padding: 28px; }
    header { background: #d9f0ff; border: 1px solid #b8ddf4; border-radius: 8px; padding: 18px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; text-align: center; text-transform: uppercase; }
    .meta { margin: 0; color: #536071; line-height: 1.45; text-align: center; }
    .dashboard-nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 14px 0 10px; }
    .dashboard-nav a { display: inline-block; border: 1px solid #98a2b3; border-radius: 6px; padding: 7px 10px; background: #fff; color: #123d66; font-size: 13px; font-weight: 700; text-decoration: none; }
    .dashboard-nav a[aria-current="page"] { background: #123d66; color: #fff; border-color: #123d66; }
    .category-divider { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; margin: 30px 0 10px; color: #475467; font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
    .category-divider::before, .category-divider::after { content: ""; height: 3px; background: #667085; border-radius: 999px; }
    .panel { margin-top: 22px; background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 18px; }
    .category-divider + .panel { margin-top: 0; }
    .panel-head { margin-bottom: 14px; border-bottom: 3px solid #98a2b3; padding-bottom: 12px; text-align: center; }
    .panel-head h2 { margin: 0 0 5px; font-size: 20px; letter-spacing: 0; }
    .panel-head p { margin: 0; color: #667085; }
    .lanes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
    h3 { margin: 0 0 10px; font-size: 18px; letter-spacing: 0; text-align: center; text-transform: uppercase; }
    .card { border: 1px solid #d8dee8; border-radius: 8px; padding: 14px; margin-bottom: 12px; background: #fbfcfd; }
    .card.ai { border-left: 5px solid #176b87; }
    .card.workflow { border-left: 5px solid #237a45; }
    h4 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: 0; color: #123d66; text-align: center; }
    .source, .meaning, .empty { color: #536071; line-height: 1.45; }
    .source { margin: 4px 0 8px; font-size: 13px; text-align: center; }
    svg { width: 100%; height: 150px; }
    svg line { stroke: #c7cfda; stroke-width: 1; }
    svg .bar-outline { fill: #fff; stroke: #111827; stroke-width: 1; }
    svg .bar-fill { fill: #176b87; }
    .workflow svg .bar-fill { fill: #237a45; }
    svg text { fill: #374151; font-size: 12px; font-weight: 700; }
    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0 10px; color: #667085; font-size: 12px; }
    .stats strong { display: block; color: #172033; font-size: 14px; margin-top: 2px; }
    .meaning { margin: 7px 0 0; font-size: 13px; }
    .progress { margin: 7px 0 0; font-size: 13px; font-weight: 700; }
    .progress.improving { color: #188038; font-size: 18px; }
    .progress.worsening { color: #c0272d; }
    .progress.unchanged { color: #667085; }
    @media (max-width: 880px) {
      main { padding: 18px; }
      .lanes { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>IS THIS GETTING BETTER</h1>
      <nav class="dashboard-nav" aria-label="Dashboard pages">
        <a href="../tsweb-dashboard/index.html">Sparse Change Dashboard</a>
        <a href="alpha-problem-dashboard.html" aria-current="page">Problem Dashboard</a>
        <a href="IndexPriceParcing.html">IndexPriceParsing</a>
      </nav>
      <p class="meta">Generated ${escapeHtml(easternTime(new Date().toISOString()))}. Each bar is one dated test result. Progress compares the latest result to the average of the previous three observed tests.</p>
      <p class="meta">Panels separate parser quality from workflow success so follow-up and override can count as working product behavior while AI parsing still has its own improvement score.</p>
    </header>
    ${visiblePanels.map(renderPanel).join("\n")}
  </main>
</body>
</html>
`;
}

function writeGptJsonl(panels) {
  const lines = [];
  for (const panel of panels.filter((item) => item.cards.length > 0)) {
    for (const item of panel.cards) {
      lines.push(
        JSON.stringify({
          panel: panel.title,
          panel_note: panel.subtitle,
          lane: item.lane === "ai" ? "AI PARSING" : "WORKFLOW",
          title: item.title,
          source: item.source,
          latest_n: item.value,
          baseline_n: item.baseline,
          previous_three_average_n: item.comparisonAverage,
          previous_three_count: item.comparisonCount,
          denominator: item.denominator,
          max_for_bar_height: item.max,
          good_when_high: item.goodWhenHigh,
          progress: progressLabel(item),
          progress_class: progressClass(item),
          points: item.points,
          what_test_shows: item.what,
          why_important: item.why,
        }),
      );
    }
  }
  writeFileSync(GPT_JSONL_PATH, `${lines.join("\n")}\n`);
}

const panels = buildPanels();
writeFileSync(DASHBOARD_PATH, renderDashboard(panels));
writeGptJsonl(panels);
console.log(`Wrote ${DASHBOARD_PATH}`);
console.log(`Wrote ${GPT_JSONL_PATH}`);
