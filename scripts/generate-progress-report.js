import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "reports";
const HISTORY_PATH = join(REPORT_DIR, "alpha-metrics-history.jsonl");

const SUMMARY_RISK_PATTERN =
  /\b(?:one|two|three|four|\d+)\s+trees?\s+(?:has\s+)?(?:wants?|would\s+like|requested|requests?|is\s+requesting|needs?|as\s+requested|remove\b)|\btrees?\s+(?:has\s+)?(?:wants?|would\s+like|requested|requests?|is\s+requesting|needs?)\b|service address|812-555|example\.com|Follow-up|Tree Dude|raw note|power\s*lines?|service\s+drop|crew\s+caution|dog\s+in\s+yard|leaning\s+toward/i;

function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function timestampForFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`;
}

function easternTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function reportFilesMatching(prefix, suffix) {
  if (!existsSync(REPORT_DIR)) return [];
  return readdirSync(REPORT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort()
    .map((name) => join(REPORT_DIR, name));
}

function latestFile(prefix, suffix) {
  return reportFilesMatching(prefix, suffix).at(-1) || "";
}

function firstAndLastMetricDelta() {
  const rows = readJsonl(HISTORY_PATH);
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows.at(-1);
  const tiers = Object.keys(first.fixtures || {});
  const byTier = tiers.map((tier) => {
    const baseline = first.fixtures[tier];
    const latest = last.fixtures[tier];
    return {
      tier,
      total: latest.total,
      baselineFailing: baseline.failing,
      latestFailing: latest.failing,
      failureDelta: baseline.failing - latest.failing,
      baselineErrorPct: baseline.errorRatePercentExact,
      latestErrorPct: latest.errorRatePercentExact,
      errorPctDelta: Number((baseline.errorRatePercentExact - latest.errorRatePercentExact).toFixed(2)),
      baselineLeakage: baseline.customerFacingLeakage,
      latestLeakage: latest.customerFacingLeakage,
      leakageDelta: baseline.customerFacingLeakage - latest.customerFacingLeakage,
    };
  });

  const aggregate = byTier.reduce(
    (memo, row) => {
      memo.total += row.total;
      memo.baselineFailing += row.baselineFailing;
      memo.latestFailing += row.latestFailing;
      memo.baselineLeakage += row.baselineLeakage;
      memo.latestLeakage += row.latestLeakage;
      return memo;
    },
    { total: 0, baselineFailing: 0, latestFailing: 0, baselineLeakage: 0, latestLeakage: 0 },
  );

  aggregate.failureDelta = aggregate.baselineFailing - aggregate.latestFailing;
  aggregate.baselineErrorPct = Number(((aggregate.baselineFailing / aggregate.total) * 100).toFixed(2));
  aggregate.latestErrorPct = Number(((aggregate.latestFailing / aggregate.total) * 100).toFixed(2));
  aggregate.errorPctDelta = Number((aggregate.baselineErrorPct - aggregate.latestErrorPct).toFixed(2));
  aggregate.leakageDelta = aggregate.baselineLeakage - aggregate.latestLeakage;

  return {
    firstTimestamp: first.timestampEastern || first.timestamp,
    lastTimestamp: last.timestampEastern || last.timestamp,
    firstCommit: first.commit || "",
    lastCommit: last.commit || "",
    byTier,
    aggregate,
  };
}

function liveStats(path) {
  const rows = readJsonl(path);
  const warningRows = rows.filter((row) => (row.validation?.warnings || []).length);
  const riskyRows = rows.filter((row) => SUMMARY_RISK_PATTERN.test(row.td2_rendered_fields?.job_summary || ""));
  const warningLeaks = warningRows.filter((row) => SUMMARY_RISK_PATTERN.test(row.td2_rendered_fields?.job_summary || ""));

  return {
    path,
    total: rows.length,
    pass: rows.filter((row) => row.pass).length,
    fail: rows.filter((row) => !row.pass).length,
    openaiUsed: rows.filter((row) => !row.mocked).length,
    mocked: rows.filter((row) => row.mocked).length,
    warningCases: warningRows.length,
    riskySummaryCount: riskyRows.length,
    warningSummaryLeakCount: warningLeaks.length,
    riskyCases: riskyRows.map((row) => row.case_id),
  };
}

function internalStats(path) {
  const rows = readJsonl(path);
  const byCategory = {};
  for (const row of rows) {
    const category = row.category || "unknown";
    byCategory[category] ||= { total: 0, pass: 0, fail: 0, warn: 0, blocked: 0 };
    byCategory[category].total += 1;
    if (row.pass) byCategory[category].pass += 1;
    else byCategory[category].fail += 1;
    if ((row.validation?.warnings || []).length) byCategory[category].warn += 1;
    if (row.validation?.can_generate_pdf === false) byCategory[category].blocked += 1;
  }
  return {
    path,
    total: rows.length,
    pass: rows.filter((row) => row.pass).length,
    fail: rows.filter((row) => !row.pass).length,
    byCategory,
  };
}

function markdownTable(headers, rows) {
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
  return lines.join("\n");
}

function renderReport({ metricDelta, firstLive, latestLive, internal, commits }) {
  const lines = [];
  lines.push("# TSweb Progress Report");
  lines.push("");
  lines.push(`Generated: ${easternTimestamp()}`);
  lines.push(`Current commit: ${git("rev-parse --short HEAD")}`);
  lines.push("");
  lines.push("## What This Uses");
  lines.push("");
  lines.push("- Existing Alpha metrics history: `reports/alpha-metrics-history.jsonl`");
  lines.push(`- Latest internal 700-case tracking: \`${internal.path || "missing"}\``);
  lines.push(`- First comparable LIVEapi result: \`${firstLive.path || "missing"}\``);
  lines.push(`- Latest LIVEapi result: \`${latestLive.path || "missing"}\``);
  lines.push("- Git commits from the last 24 hours.");
  lines.push("");
  lines.push("No new OpenAI calls, production calls, PDFs, or notifications are made by this report.");
  lines.push("");

  if (metricDelta) {
    lines.push("## Tracked Cohort Trend");
    lines.push("");
    lines.push(`History window: ${metricDelta.firstTimestamp} to ${metricDelta.lastTimestamp}`);
    lines.push("");
    lines.push(markdownTable(
      ["Metric", "Baseline", "Latest", "Change"],
      [
        ["Failing cases", `${metricDelta.aggregate.baselineFailing}/${metricDelta.aggregate.total}`, `${metricDelta.aggregate.latestFailing}/${metricDelta.aggregate.total}`, `${metricDelta.aggregate.failureDelta} fewer failures`],
        ["Error rate", `${metricDelta.aggregate.baselineErrorPct}%`, `${metricDelta.aggregate.latestErrorPct}%`, `${metricDelta.aggregate.errorPctDelta} points lower`],
        ["Customer-facing leakage", String(metricDelta.aggregate.baselineLeakage), String(metricDelta.aggregate.latestLeakage), `${metricDelta.aggregate.leakageDelta} fewer leaks`],
      ],
    ));
    lines.push("");
    lines.push(markdownTable(
      ["Tier", "Baseline fail", "Latest fail", "Error change", "Leakage change"],
      metricDelta.byTier.map((row) => [
        row.tier,
        `${row.baselineFailing}/${row.total}`,
        `${row.latestFailing}/${row.total}`,
        `${row.errorPctDelta} pts`,
        `${row.baselineLeakage} -> ${row.latestLeakage}`,
      ]),
    ));
    lines.push("");
  }

  lines.push("## LIVEapi TD2 Summary Trend");
  lines.push("");
  lines.push(markdownTable(
    ["Metric", "Earlier live run", "Latest live run", "Change"],
    [
      ["Cases passed", `${firstLive.pass}/${firstLive.total}`, `${latestLive.pass}/${latestLive.total}`, `${latestLive.pass - firstLive.pass}`],
      ["OpenAI used", String(firstLive.openaiUsed), String(latestLive.openaiUsed), `${latestLive.openaiUsed - firstLive.openaiUsed}`],
      ["Local fallback/mock", String(firstLive.mocked), String(latestLive.mocked), `${latestLive.mocked - firstLive.mocked}`],
      ["Risky TD2 summaries", String(firstLive.riskySummaryCount), String(latestLive.riskySummaryCount), `${firstLive.riskySummaryCount - latestLive.riskySummaryCount} fewer`],
      ["Warning cases", String(firstLive.warningCases), String(latestLive.warningCases), `${latestLive.warningCases - firstLive.warningCases}`],
      ["Warnings leaked into summary", String(firstLive.warningSummaryLeakCount), String(latestLive.warningSummaryLeakCount), `${firstLive.warningSummaryLeakCount - latestLive.warningSummaryLeakCount} fewer`],
    ],
  ));
  lines.push("");

  lines.push("## Internal 700-Case Battery");
  lines.push("");
  lines.push(markdownTable(
    ["Metric", "Value"],
    [
      ["Total cases", String(internal.total)],
      ["Passed", String(internal.pass)],
      ["Failed", String(internal.fail)],
    ],
  ));
  lines.push("");
  lines.push(markdownTable(
    ["Category", "Passed", "Failed", "Warnings", "Blocked by design"],
    Object.entries(internal.byCategory || {}).map(([category, item]) => [
      category,
      `${item.pass}/${item.total}`,
      String(item.fail),
      String(item.warn),
      String(item.blocked),
    ]),
  ));
  lines.push("");

  lines.push("## Last 24 Hours");
  lines.push("");
  lines.push(`Commits in last 24 hours: ${commits.length}`);
  lines.push("");
  lines.push("```text");
  lines.push(...commits.slice(0, 25));
  lines.push("```");
  lines.push("");

  lines.push("## Honest Read");
  lines.push("");
  lines.push("- Rerunning fixed examples proves regression safety, not full generalization.");
  lines.push("- The stronger evidence is the broader tracked cohort trend, the fresh 700-case internal battery, and the live 50-case TD2 summary comparison.");
  lines.push("- The weakest remaining area is still tree-count behavior in hard and uber-messy cases.");
  lines.push("- Next best measurement improvement: create a locked holdout set that we do not tune against.");
  lines.push("");

  lines.push("## Source Files");
  lines.push("");
  lines.push(`- Metrics history: \`${HISTORY_PATH}\``);
  lines.push(`- Internal tracking: \`${internal.path || "missing"}\``);
  lines.push(`- Earlier live results: \`${firstLive.path || "missing"}\``);
  lines.push(`- Latest live results: \`${latestLive.path || "missing"}\``);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

mkdirSync(REPORT_DIR, { recursive: true });

const liveFiles = reportFilesMatching("LIVEapi-results-", ".jsonl").filter((path) => !path.includes("_22-46-"));
const firstLive = liveStats(liveFiles[0] || "");
const latestLive = liveStats(liveFiles.at(-1) || "");
const internal = internalStats(latestFile("internal-100-each-tracking-", ".jsonl"));
const commits = git('log --since="24 hours ago" --oneline --decorate').split(/\r?\n/).filter(Boolean);

const report = renderReport({
  metricDelta: firstAndLastMetricDelta(),
  firstLive,
  latestLive,
  internal,
  commits,
});

const outputPath = join(REPORT_DIR, `progress-report-${timestampForFilename()}.md`);
writeFileSync(outputPath, report);
console.log(outputPath);
