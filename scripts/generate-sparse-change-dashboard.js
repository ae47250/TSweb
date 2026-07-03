import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "reports";
const INPUT_PATH = join(REPORT_DIR, "alpha-dashboard-results-for-gpt.jsonl");
const OUTPUT_PATH = join("tsweb-dashboard", "index.html");
const DASHBOARD_PAGE_URL = "https://urveska.vercel.app/tsweb-dashboard/";

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

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatOneDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function trendClass(item) {
  const latest = Number(item.latest_n || 0);
  const baseline = Number(item.baseline_n || 0);
  if (latest === baseline) return "unchanged";
  const improved = item.good_when_high ? latest > baseline : latest < baseline;
  return improved ? "improved" : "worse";
}

function trendText(item) {
  const latest = Number(item.latest_n || 0);
  const baseline = Number(item.baseline_n || 0);
  if (latest === baseline) return "App unchanged";
  return trendClass(item) === "improved" ? "App improving" : "App worsening";
}

function directionText(item) {
  return item.good_when_high
    ? "Higher number is good; lower number is bad for this metric."
    : "Lower number is good; higher number is bad for this metric.";
}

function scaleText(item) {
  return item.good_when_high
    ? "This graph shows fraction of total possible success."
    : "This graph shows fraction of the first data point, the base. Values can rise above 100% if the metric got worse than base.";
}

function scaleInfo(item, points) {
  if (item.good_when_high) {
    const denominator = Math.max(Number(item.denominator || item.max_for_bar_height || 1), 1);
    const ratios = points.map((point) => Number(point.value || 0) / denominator);
    return { denominator, maxRatio: Math.max(1, ...ratios), label: "of possible" };
  }

  const baseline = Number(item.baseline_n || points[0]?.value || 0);
  const denominator = baseline > 0
    ? baseline
    : Math.max(Number(item.denominator || item.max_for_bar_height || 1), 1);
  const ratios = points.map((point) => Number(point.value || 0) / denominator);
  return {
    denominator,
    maxRatio: Math.max(1, ...ratios),
    label: baseline > 0 ? "of base" : "of fallback scale",
  };
}

function percentLabel(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function lastTenUnchanged(points) {
  if (points.length < 10) return false;
  const lastTen = points.slice(-10);
  return lastTen.every((point) => Number(point.value) === Number(lastTen[0].value));
}

function selectedPoints(points) {
  if (points.length <= 2) {
    return points.map((point, index) => ({
      ...point,
      originalIndex: index,
      reason: index === 0 ? "base" : "latest",
      ghost: false,
    }));
  }

  const selected = new Map();
  const add = (index, reason, ghost = false) => {
    const point = points[index];
    if (!point) return;
    const key = `${index}-${reason}`;
    selected.set(key, { ...point, originalIndex: index, reason, ghost });
  };

  add(0, "base");

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = Number(points[index - 1].value);
    const current = Number(points[index].value);
    if (current !== previous) add(index, "changed");
  }

  let flatStart = 0;
  for (let index = 1; index <= points.length; index += 1) {
    const isEnd = index === points.length;
    const changed = !isEnd && Number(points[index].value) !== Number(points[index - 1].value);
    if (!isEnd && !changed) continue;

    const flatLength = index - flatStart;
    if (flatLength >= 20) {
      for (let marker = flatStart + 10; marker < index - 1; marker += 10) {
        add(marker, "every 10th unchanged", true);
      }
    }
    flatStart = index;
  }

  add(points.length - 1, "latest");

  return [...selected.values()]
    .sort((a, b) => a.originalIndex - b.originalIndex || a.reason.localeCompare(b.reason))
    .filter((point, index, list) => index === 0 || point.originalIndex !== list[index - 1].originalIndex || point.reason !== "latest");
}

function barSvg(item) {
  const points = item.points || [];
  const selected = selectedPoints(points);
  const noRecentChange = lastTenUnchanged(points);
  const width = 620;
  const height = 220;
  const pad = 30;
  const labelHeight = 36;
  const chartHeight = height - pad * 2 - labelHeight;
  const scale = scaleInfo(item, points);
  const maxRatio = scale.maxRatio;

  if (noRecentChange && selected.length <= 3) {
    const base = points[0];
    const latest = points.at(-1);
    const latestRatio = Number(latest?.value || 0) / scale.denominator;
    return `<svg class="sparse-chart no-change-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(item.title)} no recent change">
      <rect class="plot-bg" x="${pad}" y="${pad}" width="${width - pad * 2}" height="${chartHeight}" />
      <text class="no-change-title" x="${width / 2}" y="${height / 2 - 12}" text-anchor="middle">No metric change in the last 10 observations</text>
      <text class="no-change-subtitle" x="${width / 2}" y="${height / 2 + 14}" text-anchor="middle">Base ${escapeHtml(base?.label || "")}: ${formatNumber(base?.value)} - Latest ${escapeHtml(latest?.label || "")}: ${formatNumber(latest?.value)} (${percentLabel(latestRatio)} ${escapeHtml(scale.label)})</text>
      <text class="axis-label" x="${pad}" y="${height - 8}" text-anchor="start">base</text>
      <text class="axis-label" x="${width - pad}" y="${height - 8}" text-anchor="end">latest</text>
    </svg>`;
  }

  const slot = (width - pad * 2) / Math.max(selected.length, 1);
  const barWidth = Math.max(8, Math.min(30, slot * 0.58));
  const bars = selected.map((point, index) => {
    const value = Number(point.value || 0);
    const ratio = value / scale.denominator;
    const filledHeight = Math.max(0, ratio / maxRatio) * chartHeight;
    const x = pad + index * slot + (slot - barWidth) / 2;
    const y = pad + chartHeight - filledHeight;
    const marker = point.ghost
      ? `<circle class="flat-marker" cx="${(x + barWidth / 2).toFixed(1)}" cy="${(pad + chartHeight - 5).toFixed(1)}" r="4"><title>${escapeHtml(point.label)} unchanged: ${formatNumber(value)} (${percentLabel(ratio)} ${escapeHtml(scale.label)})</title></circle>`
      : `<rect class="bar-fill" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${filledHeight.toFixed(1)}"><title>${escapeHtml(point.label)} ${point.reason}: ${formatNumber(value)} (${percentLabel(ratio)} ${escapeHtml(scale.label)})</title></rect>`;
    const label = point.reason === "every 10th unchanged" ? "10th" : point.reason;
    return `<g>
      <rect class="bar-outline" x="${x.toFixed(1)}" y="${pad}" width="${barWidth.toFixed(1)}" height="${chartHeight}" />
      ${marker}
      <text class="point-label" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 19}" text-anchor="middle">${escapeHtml(label)}</text>
      <text class="point-value" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${percentLabel(ratio)}</text>
    </g>`;
  }).join("");

  const recentMessage = noRecentChange
    ? `<text class="recent-note" x="${width / 2}" y="20" text-anchor="middle">No metric change in the last 10 observations</text>`
    : "";

  return `<svg class="sparse-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(item.title)} sparse change chart">
    ${recentMessage}
    <text class="scale-note" x="${width - pad}" y="20" text-anchor="end">scale: ${escapeHtml(scale.label)}</text>
    <line class="axis" x1="${pad}" y1="${pad + chartHeight}" x2="${width - pad}" y2="${pad + chartHeight}" />
    ${bars}
  </svg>`;
}

function renderCard(item) {
  const denominator = item.denominator ? ` / ${item.denominator}` : "";
  return `<section class="card ${item.lane === "AI PARSING" ? "ai" : "workflow"}">
    <h4>${escapeHtml(item.title)}</h4>
    <p class="source">${escapeHtml(item.source)}</p>
    <p class="graph-subtitle">${escapeHtml(scaleText(item))}</p>
    ${barSvg(item)}
    <div class="stats">
      <span>Most recent <strong>${formatOneDecimal(item.latest_n)}${denominator}</strong></span>
      <span>MA (prev 3) <strong>${formatOneDecimal(item.previous_three_average_n)}</strong></span>
      <span>Base <strong>${formatOneDecimal(item.baseline_n)}</strong></span>
      <span>Shown points <strong>${selectedPoints(item.points || []).length} of ${(item.points || []).length}</strong></span>
      <span class="progress-row ${trendClass(item)}"><span class="progress-label">Progress:</span> <strong>${escapeHtml(trendText(item))}</strong></span>
    </div>
    <p class="meaning"><strong>What this test shows:</strong> ${escapeHtml(item.what_test_shows)}</p>
    <p class="meaning"><strong>Good/bad direction:</strong> ${escapeHtml(directionText(item))}</p>
    <p class="meaning"><strong>How bars are scaled:</strong> ${escapeHtml(scaleText(item))}</p>
    <p class="meaning"><strong>Why it matters:</strong> ${escapeHtml(item.why_important)}</p>
  </section>`;
}

function groupPanels(rows) {
  const panels = [];
  const byPanel = new Map();
  for (const row of rows) {
    const key = row.panel;
    if (!byPanel.has(key)) {
      const panel = { title: row.panel, note: row.panel_note, cards: [] };
      byPanel.set(key, panel);
      panels.push(panel);
    }
    byPanel.get(key).cards.push(row);
  }
  return panels;
}

function renderPanel(panel, index) {
  const aiCards = panel.cards.filter((card) => card.lane === "AI PARSING");
  const workflowCards = panel.cards.filter((card) => card.lane === "WORKFLOW");
  const divider = index === 0 ? "" : `<div class="category-divider"><span>Dataset category ${index + 1}</span></div>`;
  return `${divider}<section class="panel">
    <div class="panel-head">
      <h2>${escapeHtml(panel.title)}</h2>
      <p>${escapeHtml(panel.note)}</p>
    </div>
    <div class="lanes">
      <div>
        <h3>AI Parsing</h3>
        ${aiCards.length ? aiCards.map(renderCard).join("\n") : '<p class="empty">No AI parsing graph for this panel.</p>'}
      </div>
      <div>
        <h3>Workflow</h3>
        ${workflowCards.length ? workflowCards.map(renderCard).join("\n") : '<p class="empty">No workflow graph for this panel.</p>'}
      </div>
    </div>
  </section>`;
}

function renderDashboard(rows) {
  const panels = groupPanels(rows);
  const generated = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sparse Change Dashboard Prototype</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #fffbe6; color: #172033; }
    main { max-width: 1280px; margin: 0 auto; padding: 28px; }
    header { background: #d9f0ff; border: 1px solid #b8ddf4; border-radius: 8px; padding: 18px; }
    h1 { margin: 0 0 8px; padding: 12px; text-align: center; font-size: 30px; letter-spacing: 0; text-transform: uppercase; background: #123d66; color: #fff; border-radius: 6px; }
    .meta { margin: 5px 0 0; color: #536071; line-height: 1.45; }
    .dashboard-nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 14px 0 10px; }
    .dashboard-nav a { display: inline-block; border: 1px solid #98a2b3; border-radius: 6px; padding: 7px 10px; background: #fff; color: #123d66; font-size: 13px; font-weight: 700; text-decoration: none; }
    .dashboard-nav a[aria-current="page"] { background: #123d66; color: #fff; border-color: #123d66; }
    .header-notes { margin: 12px 0 0; padding: 12px 18px 12px 30px; background: #fff; border: 1px solid #b8ddf4; border-radius: 6px; color: #294861; line-height: 1.45; }
    .header-notes li + li { margin-top: 5px; }
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
    .graph-subtitle { margin: 0 0 8px; color: #475467; font-size: 13px; font-weight: 700; line-height: 1.35; text-align: center; }
    .sparse-chart { width: 100%; height: 220px; background: #fff; border: 1px solid #e6ebf1; border-radius: 6px; }
    .axis { stroke: #c7cfda; stroke-width: 1; }
    .plot-bg { fill: #f8fafc; stroke: #d8dee8; }
    .bar-outline { fill: #fff; stroke: #111827; stroke-width: 1; opacity: 0.8; }
    .bar-fill { fill: #176b87; }
    .workflow .bar-fill { fill: #237a45; }
    .flat-marker { fill: #f2b84b; stroke: #8a5a00; stroke-width: 1; }
    .point-label, .axis-label, .scale-note { fill: #475467; font-size: 11px; font-weight: 700; }
    .point-value { fill: #172033; font-size: 11px; font-weight: 700; }
    .recent-note, .no-change-title { fill: #7a2e0e; font-size: 14px; font-weight: 700; }
    .no-change-subtitle { fill: #536071; font-size: 12px; font-weight: 700; }
    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0; color: #667085; font-size: 12px; }
    .stats strong { display: block; color: #172033; font-size: 14px; margin-top: 2px; }
    .stats .improved strong { color: #188038; }
    .stats .worse strong { color: #c0272d; }
    .stats .unchanged strong { color: #667085; }
    .progress-row { grid-column: 1 / -1; }
    .progress-label { color: #667085; font-weight: 700; }
    .progress-row strong { display: inline; margin-left: 6px; font-size: 18px; font-weight: 800; }
    .progress-row.improved strong { color: #188038; }
    .progress-row.worse strong { color: #c0272d; }
    .progress-row.unchanged strong { color: #667085; }
    .meaning { margin: 7px 0 0; font-size: 13px; }
    @media (max-width: 880px) {
      main { padding: 18px; }
      .lanes { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>IS THIS GETTING BETTER</h1>
      <nav class="dashboard-nav" aria-label="Dashboard pages">
        <a href="index.html" aria-current="page">Sparse Change Dashboard</a>
        <a href="../reports/alpha-problem-dashboard.html">Problem Dashboard</a>
        <a href="../reports/IndexPriceParcing.html">IndexPriceParsing</a>
      </nav>
      <p class="meta">Page: <code>${escapeHtml(DASHBOARD_PAGE_URL)}</code></p>
      <p class="meta">Generated ${escapeHtml(generated)} from current report data.</p>
      <ul class="header-notes">
        <li>Always show base and latest data points.</li>
        <li>Hide repeated points unless the metric changed.</li>
        <li>For long unchanged stretches, show every 10th point between base and latest.</li>
        <li>If the last 10 observations did not change, say so inside the graph instead of drawing repeated bars.</li>
      </ul>
    </header>
    ${panels.map(renderPanel).join("\n")}
  </main>
</body>
</html>
`;
}

const rows = readJsonl(INPUT_PATH);
if (!rows.length) {
  throw new Error(`No dashboard rows found at ${INPUT_PATH}`);
}

writeFileSync(OUTPUT_PATH, renderDashboard(rows));
console.log(`Wrote ${OUTPUT_PATH}`);
