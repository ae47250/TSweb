import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "reports";
const ALPHA_HISTORY = join(REPORT_DIR, "alpha-metrics-history.jsonl");
const FOCUSED_HISTORY = join(REPORT_DIR, "focused-regression-battery-history.jsonl");
const OUTPUT_PATH = join(REPORT_DIR, "alpha-problem-dashboard.html");

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function metricId(source, name) {
  return `${source}:${name}`;
}

function pushMetric(metrics, source, name, kind, timestamp, label, value, denominator = null) {
  const id = metricId(source, name);
  const existing = metrics.get(id) || {
    id,
    source,
    name,
    kind,
    denominator,
    points: [],
    maxProblemScore: 0,
    latestProblemScore: 0,
    maxDenominator: denominator || 0,
  };
  const numericValue = Number(value || 0);
  const score = denominator ? (numericValue / denominator) * 100 : numericValue;
  existing.maxProblemScore = Math.max(existing.maxProblemScore, score);
  existing.latestProblemScore = score;
  existing.maxDenominator = Math.max(existing.maxDenominator, denominator || 0);
  existing.points.push({
    timestamp,
    label,
    value: Number(numericValue.toFixed(2)),
    score: Number(score.toFixed(2)),
  });
  metrics.set(id, existing);
}

function collectAlpha(metrics) {
  for (const snapshot of readJsonl(ALPHA_HISTORY)) {
    const timestamp = snapshot.timestamp;
    const label = `${snapshot.commit?.slice(0, 7) || "unknown"} ${shortTime(timestamp)}`;
    for (const [tier, summary] of Object.entries(snapshot.fixtures || {})) {
      pushMetric(
        metrics,
        "Alpha 150-case cohorts",
        `${tier}: error rate`,
        "percent",
        timestamp,
        label,
        summary.errorRatePercentExact || 0,
        100,
      );
      pushMetric(
        metrics,
        "Alpha 150-case cohorts",
        `${tier}: still blocked`,
        "count",
        timestamp,
        label,
        summary.stillBlocked || 0,
        summary.total || null,
      );
      pushMetric(
        metrics,
        "Alpha 150-case cohorts",
        `${tier}: customer leakage`,
        "count",
        timestamp,
        label,
        summary.customerFacingLeakage || 0,
        summary.total || null,
      );
      for (const [bucket, count] of Object.entries(summary.failureCategories || {})) {
        pushMetric(
          metrics,
          "Alpha 150-case cohorts",
          `${tier}: ${bucket}`,
          "count",
          timestamp,
          label,
          count,
          summary.total || null,
        );
      }
    }
  }
}

function collectFocused(metrics) {
  for (const snapshot of readJsonl(FOCUSED_HISTORY)) {
    const metadata = snapshot.metadata || {};
    const summary = snapshot.summary || {};
    const timestamp = metadata.timestampUtc || metadata.timestamp || "";
    const label = `${metadata.commit?.slice(0, 7) || "unknown"} ${shortTime(timestamp)}`;
    pushMetric(
      metrics,
      "Focused regression battery",
      "overall failing cases",
      "count",
      timestamp,
      label,
      summary.failing || 0,
      summary.total || null,
    );
    for (const [category, result] of Object.entries(summary.byCategory || {})) {
      pushMetric(
        metrics,
        "Focused regression battery",
        `${category}: failing cases`,
        "count",
        timestamp,
        label,
        result.failing || 0,
        result.total || null,
      );
    }
    for (const [bucket, count] of Object.entries(summary.byFailure || {})) {
      pushMetric(
        metrics,
        "Focused regression battery",
        `${bucket} failures`,
        "count",
        timestamp,
        label,
        count,
        summary.total || null,
      );
    }
  }
}

function parseInternalReport(path) {
  const text = readFileSync(path, "utf8");
  const stat = statSync(path);
  const total = Number(text.match(/- Total cases:\s*(\d+)/)?.[1] || 0);
  const failed = Number(text.match(/- Failed:\s*(\d+)/)?.[1] || 0);
  const rows = [...text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(\d+)\/(\d+)\s*\|\s*(\d+)\/(\d+)\s*\|\s*([^|]+?)\s*\|$/gm)];
  return {
    timestamp: stat.mtime.toISOString(),
    label: shortTime(stat.mtime.toISOString()),
    total,
    failed,
    rows: rows.map((match) => ({
      category: match[1].trim(),
      passed: Number(match[2]),
      total: Number(match[3]),
      failed: Number(match[4]),
      findings: match[6].trim(),
    })),
  };
}

function collectInternal(metrics) {
  const files = readdirSync(REPORT_DIR)
    .filter((name) => /^internal-100-each-summary-.*\.md$/i.test(name))
    .sort();

  for (const filename of files) {
    const report = parseInternalReport(join(REPORT_DIR, filename));
    pushMetric(
      metrics,
      "Internal 100-each synthetic sets",
      "overall failed cases",
      "count",
      report.timestamp,
      report.label,
      report.failed,
      report.total || null,
    );

    for (const row of report.rows) {
      pushMetric(
        metrics,
        "Internal 100-each synthetic sets",
        `${row.category}: failed cases`,
        "count",
        report.timestamp,
        report.label,
        row.failed,
        row.total || null,
      );

      if (row.findings === "none") continue;
      for (const finding of row.findings.split(/\s*,\s*/)) {
        const match = finding.match(/^([a-z0-9_]+)\s+(\d+)$/i);
        if (!match) continue;
        pushMetric(
          metrics,
          "Internal 100-each synthetic sets",
          `${row.category}: ${match[1]}`,
          "count",
          report.timestamp,
          report.label,
          Number(match[2]),
          row.total || null,
        );
      }
    }
  }
}

function svgLine(points, kind) {
  const width = 520;
  const height = 150;
  const pad = 28;
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, kind === "percent" ? 100 : 1);
  const minValue = Math.min(...values, 0);
  const span = Math.max(1, maxValue - minValue);
  const xFor = (index) => pad + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - pad * 2));
  const yFor = (value) => height - pad - ((value - minValue) / span) * (height - pad * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(" ");
  const circles = points
    .map((point, index) => `<circle cx="${xFor(index).toFixed(1)}" cy="${yFor(point.value).toFixed(1)}" r="3"><title>${htmlEscape(point.label)}: ${point.value}${kind === "percent" ? "%" : ""}</title></circle>`)
    .join("");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Metric history chart">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
      <text x="${pad}" y="18">${maxValue.toFixed(kind === "percent" ? 0 : 1)}${kind === "percent" ? "%" : ""}</text>
      <text x="${pad}" y="${height - 6}">${minValue.toFixed(0)}</text>
      <path d="${path}" />
      ${circles}
    </svg>`;
}

function renderChart(metric, index) {
  const sortedPoints = metric.points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const first = sortedPoints[0];
  const latest = sortedPoints.at(-1);
  const delta = latest.value - first.value;
  const deltaText = delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}${metric.kind === "percent" ? "%" : ""}`;
  return `
    <section class="card">
      <div class="card-head">
        <span class="rank">${index}</span>
        <div>
          <h2>${htmlEscape(metric.name)}</h2>
          <p>${htmlEscape(metric.source)}</p>
        </div>
      </div>
      ${svgLine(sortedPoints, metric.kind)}
      <div class="stats">
        <span>Latest <strong>${latest.value}${metric.kind === "percent" ? "%" : ""}</strong></span>
        <span>Base <strong>${first.value}${metric.kind === "percent" ? "%" : ""}</strong></span>
        <span>Change <strong>${deltaText}</strong></span>
        <span>Points <strong>${sortedPoints.length}</strong></span>
      </div>
    </section>`;
}

function renderDashboard(metrics) {
  const ranked = [...metrics.values()]
    .filter((metric) => metric.points.length > 0 && metric.maxProblemScore > 0)
    .sort((a, b) => problemRank(b) - problemRank(a))
    .slice(0, 8);
  const latestAlpha = readJsonl(ALPHA_HISTORY).at(-1);
  const generated = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TSweb Problem Metrics Dashboard</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f7f9; color: #172033; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    header { margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    .meta { margin: 0; color: #536071; line-height: 1.45; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05); }
    .card-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .rank { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; background: #172033; color: #fff; border-radius: 999px; font-weight: 700; flex: 0 0 auto; }
    h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
    .card p { margin: 4px 0 0; color: #667085; font-size: 13px; }
    svg { width: 100%; height: 150px; overflow: visible; }
    svg line { stroke: #c7cfda; stroke-width: 1; }
    svg path { fill: none; stroke: #176b87; stroke-width: 3; }
    svg circle { fill: #d24b34; stroke: #fff; stroke-width: 1.5; }
    svg text { fill: #667085; font-size: 11px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; font-size: 12px; color: #667085; }
    .stats strong { display: block; color: #172033; font-size: 14px; margin-top: 2px; }
    @media (max-width: 760px) {
      main { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>TSweb Problem Metrics Dashboard</h1>
      <p class="meta">Generated ${htmlEscape(shortTime(generated))}. Latest alpha commit ${htmlEscape(latestAlpha?.commit?.slice(0, 7) || "unknown")}. Local datasets only; no live API calls were used.</p>
      <p class="meta">Ranking uses the worst historical problem score from baseline through the current run. Lower lines are better.</p>
    </header>
    <div class="grid">
      ${ranked.map((metric, index) => renderChart(metric, index + 1)).join("\n")}
    </div>
  </main>
</body>
</html>
`;
}

function problemRank(metric) {
  const sampleWeight = Math.log10(Math.max(10, metric.maxDenominator || 10));
  return metric.latestProblemScore * sampleWeight + metric.maxProblemScore * 0.25;
}

const metrics = new Map();
collectAlpha(metrics);
collectFocused(metrics);
collectInternal(metrics);
writeFileSync(OUTPUT_PATH, renderDashboard(metrics));
console.log(`Wrote ${OUTPUT_PATH}`);
