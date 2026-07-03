import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "reports";
const OUTPUT_HTML = join(REPORT_DIR, "IndexPriceParcing.html");
const OUTPUT_DATA = join(REPORT_DIR, "index-price-parcing-data.json");

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function eastern(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function latestMatching(prefix, suffix) {
  const matches = readdirSync(REPORT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => join(REPORT_DIR, name))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  return matches.at(-1) || "";
}

function alphaHistory() {
  return readJsonl(join(REPORT_DIR, "alpha-metrics-history.jsonl"));
}

function parserPriceFailures(snapshot, tier = "") {
  const fixtures = snapshot.fixtures || {};
  if (tier) return fixtures[tier]?.failureCategories?.parser_price_options || 0;
  return Object.values(fixtures).reduce((sum, fixture) => sum + (fixture.failureCategories?.parser_price_options || 0), 0);
}

function alphaPoints(title, tier, denominator, note) {
  return {
    title,
    source: "reports/alpha-metrics-history.jsonl",
    goodWhenHigh: false,
    denominator,
    note,
    points: alphaHistory().map((snapshot) => ({
      label: eastern(snapshot.timestamp),
      timestamp: snapshot.timestamp,
      value: parserPriceFailures(snapshot, tier),
    })),
  };
}

function parseInternalSummary(filePath) {
  const text = readFileSync(filePath, "utf8");
  const timestamp = statSync(filePath).mtime.toISOString();
  const priorLine = text.match(/^\|\s*prior_regression_failures\s*\|\s*\d+\/\d+\s*\|\s*\d+\/\d+\s*\|\s*([^|]+?)\s*\|$/m)?.[1] || "";
  const priceMissing = Number(priorLine.match(/price_missing\s+(\d+)/)?.[1] || 0);
  return { timestamp, priceMissing };
}

function internalPricePoints() {
  const points = readdirSync(REPORT_DIR)
    .filter((name) => /^internal-100-each-summary-.*\.md$/i.test(name))
    .map((name) => parseInternalSummary(join(REPORT_DIR, name)))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((item) => ({
      label: eastern(item.timestamp),
      timestamp: item.timestamp,
      value: item.priceMissing,
    }));

  return {
    title: "Prior-regression price-missing findings",
    source: "internal-100-each-summary history",
    goodWhenHigh: false,
    denominator: 120,
    note: "Lower is better. This is the recurring 100-case stress bucket; finding count can exceed case count because one case can have more than one price issue.",
    points,
  };
}

function validLiveSummaries() {
  return readdirSync(REPORT_DIR)
    .filter((name) => /^live-option-price-parsing-summary-.*\.json$/i.test(name))
    .map((name) => {
      const path = join(REPORT_DIR, name);
      const data = readJson(path);
      return { path, name, data, timestamp: statSync(path).mtime.toISOString() };
    })
    .filter((item) => item.data.summary?.production_errors === 0 && item.data.summary?.mocked === 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function liveMetricPoints(title, getter, denominatorGetter, goodWhenHigh, note) {
  const reports = validLiveSummaries();
  const latest = reports.at(-1);
  return {
    title,
    source: "saved live option-price parsing summaries",
    goodWhenHigh,
    denominator: denominatorGetter(latest?.data?.summary || {}),
    note,
    points: reports.map((report) => ({
      label: eastern(report.timestamp),
      timestamp: report.timestamp,
      value: getter(report.data.summary || {}),
    })),
  };
}

function latestLocalPriceSummary() {
  const path = latestMatching("local-price-benchmark-", "-summary.json");
  if (!path) return null;
  return { path, data: readJson(path), timestamp: statSync(path).mtime.toISOString() };
}

function localPriceCards() {
  const latest = latestLocalPriceSummary();
  if (!latest) return [];
  const summary = latest.data.summary || {};
  const axis = summary.by_axis || {};
  const bucket = summary.by_bucket || {};
  const dataset = summary.by_dataset || {};
  const stamp = latest.data.meta?.eastern || eastern(latest.timestamp);

  const onePoint = (title, value, denominator, goodWhenHigh, note) => ({
    title,
    source: latest.path,
    goodWhenHigh,
    denominator,
    note: `${note} First full local price benchmark, so base and current are the same score.`,
    points: [{ label: stamp, timestamp: latest.timestamp, value }],
  });

  return [
    onePoint("Full local price benchmark failures", axis.firm_price_extraction?.fail || 0, summary.total || 1, false, "Lower is better. Includes firm price missing and firm price wrong."),
    onePoint("Full local firm-price extraction passes", axis.firm_price_extraction?.pass || 0, (axis.firm_price_extraction?.pass || 0) + (axis.firm_price_extraction?.fail || 0), true, "Higher is better. Measures whether firm option prices made it into TD2."),
    onePoint("Stable 700 replay price rows passing", dataset["stable-700-replay-current-local"]?.pass || 0, dataset["stable-700-replay-current-local"]?.total || 700, true, "Higher is better. This isolates the stable broad replay input set."),
    onePoint("Hard-knownfail price-slice failures", dataset["alpha-hard-knownfail-price-slice"]?.fail || 0, dataset["alpha-hard-knownfail-price-slice"]?.total || 150, false, "Lower is better. This remains the main price parser backlog."),
    onePoint("Firm prices missing", bucket.firm_price_missing || 0, summary.total || 1, false, "Lower is better. Price was expected but TD2 had no usable price."),
    onePoint("Firm prices wrong", bucket.firm_price_wrong || 0, summary.total || 1, false, "Lower is better. TD2 had a price, but not the expected price set."),
    onePoint("Missing or vague price invented", (bucket.no_price_invented || 0) + (bucket.unclear_price_treated_as_firm || 0), summary.total || 1, false, "Lower is better. This is the safety metric for not turning vague/no-price text into a customer-facing amount."),
  ];
}

function liveCards() {
  return [
    liveMetricPoints(
      "Live firm-price extraction misses",
      (summary) => summary.price_present_but_missing_or_unclear || 0,
      (summary) => summary.total || 1,
      false,
      "Lower is better. Firm price was present, but TD2 missed it or made it unclear.",
    ),
    liveMetricPoints(
      "Live firm/control price rows OK",
      (summary) => summary.price_ok_or_not_missing || 0,
      (summary) => summary.price_ok_or_not_missing + summary.price_present_but_missing_or_unclear || summary.total || 1,
      true,
      "Higher is better. Controls prove the app can still extract firm option prices.",
    ),
    liveMetricPoints(
      "Live missing/vague prices correctly blocked",
      (summary) => summary.no_usable_price_in_input || 0,
      (summary) => (summary.by_group?.no_usable_price_in_input?.total || 0) + (summary.by_group?.price_present_but_not_firm?.total || 0) || 1,
      true,
      "Higher is better. This focuses on simply missing prices plus vague or non-firm price language.",
    ),
    liveMetricPoints(
      "Live invented prices from no usable input",
      (summary) => summary.finalized_without_usable_price_input || 0,
      (summary) => summary.total || 1,
      false,
      "Lower is better. This should stay at zero.",
    ),
    liveMetricPoints(
      "Live phone/address number price confusion",
      (summary) => summary.by_group?.phone_number_not_price?.missing_or_unclear_price || 0,
      (summary) => summary.by_group?.phone_number_not_price?.total || 1,
      false,
      "Lower is better. Phone and address numbers should not become prices.",
    ),
  ];
}

function allCards() {
  const alpha = [
    alphaPoints("All Alpha parser_price_options failures", "", 1050, "Lower is better. Direct parser price-option mismatch across all Alpha fixture cohorts."),
    alphaPoints("Hard-knownfail parser_price_options failures", "hard-knownfail", 150, "Lower is better. This is the historic hard price/options backlog."),
    alphaPoints("Uber-plus parser_price_options failures", "uber-plus-messy", 150, "Lower is better. This should stay at zero in the non-backlog messy set."),
    alphaPoints("Very-messy parser_price_options failures", "very-messy", 150, "Lower is better. This should stay at zero in the smaller price-option slice."),
  ];

  return [
    ...liveCards(),
    ...localPriceCards(),
    internalPricePoints(),
    ...alpha,
  ].filter((card) => card.points.length > 0);
}

function selectedPoints(points) {
  if (points.length <= 1) return points.map((point, index) => ({ ...point, index, reason: index === 0 ? "base/current" : "latest" }));
  const selected = [];
  const add = (index, reason) => {
    const point = points[index];
    if (!point) return;
    if (selected.some((item) => item.index === index)) return;
    selected.push({ ...point, index, reason });
  };
  const latestDate = new Date(points.at(-1).timestamp);
  const previousDay = new Date(latestDate);
  previousDay.setDate(previousDay.getDate() - 1);
  const morningIndex = closestEasternHourIndex(points, previousDay, 10);
  const afternoonIndex = closestEasternHourIndex(points, previousDay, 17);

  add(0, "base");
  add(morningIndex, "yday 10am");
  add(afternoonIndex, "yday 5pm");
  for (let index = 1; index < points.length - 1; index += 1) {
    if (Number(points[index].value) !== Number(points[index - 1].value)) add(index, "changed");
  }
  add(points.length - 1, "current");
  return selected.sort((a, b) => a.index - b.index);
}

function easternParts(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function closestEasternHourIndex(points, targetDate, targetHour) {
  const target = easternParts(targetDate);
  const candidates = points
    .map((point, index) => ({ point, index, parts: easternParts(point.timestamp) }))
    .filter(({ parts }) => parts.year === target.year && parts.month === target.month && parts.day === target.day);
  if (!candidates.length) return -1;
  const targetMinutes = targetHour * 60;
  candidates.sort((a, b) => {
    const aMinutes = Number(a.parts.hour) * 60 + Number(a.parts.minute);
    const bMinutes = Number(b.parts.hour) * 60 + Number(b.parts.minute);
    return Math.abs(aMinutes - targetMinutes) - Math.abs(bMinutes - targetMinutes);
  });
  return candidates[0].index;
}

function previousNote(card) {
  const points = card.points;
  if (points.length < 2) return "No previous period yet; base and current are the same score.";
  const previous = points.at(-2);
  const current = points.at(-1);
  if (Number(previous.value) === Number(current.value)) {
    return `Same score as previous period: ${current.value}. The previous period is not drawn as a separate bar unless it was also a change point.`;
  }
  const direction = card.goodWhenHigh
    ? Number(current.value) > Number(previous.value) ? "better" : "worse"
    : Number(current.value) < Number(previous.value) ? "better" : "worse";
  return `Changed since previous period: ${previous.value} -> ${current.value}; ${direction}.`;
}

function scale(card) {
  if (card.goodWhenHigh) {
    return {
      denominator: Math.max(Number(card.denominator || 1), 1),
      label: "of possible",
      maxRatio: 1,
    };
  }
  const base = Number(card.points[0]?.value || 0);
  const denominator = base > 0 ? base : Math.max(Number(card.denominator || 1), 1);
  const maxRatio = Math.max(1, ...card.points.map((point) => Number(point.value || 0) / denominator));
  return {
    denominator,
    label: base > 0 ? "of base" : "of fallback scale",
    maxRatio,
  };
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function trendClass(card) {
  if (card.points.length < 2) return "same";
  const previous = Number(card.points.at(-2).value || 0);
  const current = Number(card.points.at(-1).value || 0);
  if (previous === current) return "same";
  const improved = card.goodWhenHigh ? current > previous : current < previous;
  return improved ? "better" : "worse";
}

function trendText(card) {
  const klass = trendClass(card);
  if (klass === "same") return "Same score as previous period";
  return klass === "better" ? "Improved since previous period" : "Worse since previous period";
}

function svgChart(card) {
  const points = selectedPoints(card.points);
  const sc = scale(card);
  const width = 640;
  const height = 218;
  const top = 32;
  const bottom = 54;
  const chartHeight = height - top - bottom;
  const slot = (width - 64) / Math.max(points.length, 1);
  const barWidth = Math.max(18, Math.min(44, slot * 0.55));
  const bars = points
    .map((point, index) => {
      const ratio = Number(point.value || 0) / sc.denominator;
      const h = Math.max(0, ratio / sc.maxRatio) * chartHeight;
      const x = 32 + index * slot + (slot - barWidth) / 2;
      const y = top + chartHeight - h;
      return `<g>
        <rect class="bar-frame" x="${x.toFixed(1)}" y="${top}" width="${barWidth.toFixed(1)}" height="${chartHeight}" />
        <rect class="bar-fill" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}"><title>${escapeHtml(point.label)} ${point.reason}: ${point.value} (${percent(ratio)} ${sc.label})</title></rect>
        <text class="bar-reason" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 26}" text-anchor="middle">${escapeHtml(point.reason)}</text>
        <text class="bar-percent" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 10}" text-anchor="middle">${percent(ratio)}</text>
      </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(card.title)}">
    <text class="scale-label" x="${width - 32}" y="20" text-anchor="end">scale: ${escapeHtml(sc.label)}</text>
    <line class="axis" x1="32" y1="${top + chartHeight}" x2="${width - 32}" y2="${top + chartHeight}" />
    ${bars}
  </svg>`;
}

function renderCard(card) {
  const current = card.points.at(-1)?.value ?? 0;
  const base = card.points[0]?.value ?? 0;
  const denominator = card.denominator ? ` / ${card.denominator}` : "";
  const directionLabel = card.goodWhenHigh ? "Higher is better" : "Lower is better";
  const directionRest = card.goodWhenHigh
    ? "Percent = value divided by possible total."
    : "Percent = value divided by the base value, so improvement moves toward 0%.";

  return `<article class="metric ${trendClass(card)}">
    <div class="metric-head">
      <h2>${escapeHtml(card.title)}</h2>
      <p>${escapeHtml(card.source)}</p>
    </div>
    ${svgChart(card)}
    <div class="stats">
      <span>Base <strong>${base}</strong></span>
      <span>Current <strong>${current}${denominator}</strong></span>
      <span>Shown <strong>${selectedPoints(card.points).length} of ${card.points.length}</strong></span>
      <span>Status <strong>${escapeHtml(trendText(card))}</strong></span>
    </div>
    <p class="note">${escapeHtml(previousNote(card))}</p>
    <p class="note"><strong class="direction">${escapeHtml(directionLabel)}</strong>. ${escapeHtml(directionRest)}</p>
    <p class="note">${escapeHtml(card.note)}</p>
  </article>`;
}

function renderHtml(cards) {
  const generated = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const changed = cards.filter((card) => trendClass(card) !== "same").length;
  const same = cards.length - changed;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IndexPriceParsing</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f8fb; color: #172033; }
    main { max-width: 1220px; margin: 0 auto; padding: 26px; }
    header { background: #ffffff; border: 1px solid #d8dee8; border-radius: 8px; padding: 18px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    .lede { margin: 6px 0; color: #526071; line-height: 1.45; }
    .dashboard-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 10px; }
    .dashboard-nav a { display: inline-block; border: 1px solid #98a2b3; border-radius: 6px; padding: 7px 10px; background: #fff; color: #123d66; font-size: 13px; font-weight: 700; text-decoration: none; }
    .dashboard-nav a[aria-current="page"] { background: #123d66; color: #fff; border-color: #123d66; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .summary div { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; background: #fbfcfd; }
    .summary strong { display: block; margin-top: 4px; font-size: 22px; color: #123d66; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; align-items: start; }
    .metric { background: #ffffff; border: 1px solid #d8dee8; border-left: 5px solid #607085; border-radius: 8px; padding: 14px; }
    .metric.better { border-left-color: #188038; }
    .metric.worse { border-left-color: #c0272d; }
    .metric.same { border-left-color: #667085; }
    .metric-head h2 { margin: 0 0 4px; font-size: 17px; letter-spacing: 0; }
    .metric-head p { margin: 0 0 8px; color: #667085; font-size: 13px; }
    svg { width: 100%; height: 218px; background: #fff; border: 1px solid #e6ebf1; border-radius: 6px; }
    .axis { stroke: #98a2b3; stroke-width: 1; }
    .bar-frame { fill: #fff; stroke: #172033; stroke-width: 1; opacity: 0.65; }
    .bar-fill { fill: #176b87; }
    .better .bar-fill { fill: #188038; }
    .worse .bar-fill { fill: #c0272d; }
    .same .bar-fill { fill: #667085; }
    .scale-label, .bar-reason, .bar-percent { fill: #475467; font-size: 12px; font-weight: 700; }
    .bar-percent { fill: #172033; }
    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0; color: #667085; font-size: 12px; text-align: center; }
    .stats strong { display: block; color: #172033; font-size: 15px; margin-top: 2px; }
    .better .stats strong { color: #188038; font-weight: 800; }
    .worse .stats strong { color: #c0272d; font-weight: 800; }
    .note { margin: 7px 0 0; color: #526071; font-size: 13px; line-height: 1.4; }
    .direction { color: #123d66; font-weight: 800; }
    @media (max-width: 900px) {
      main { padding: 16px; }
      .grid, .summary { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>IndexPriceParsing</h1>
      <nav class="dashboard-nav" aria-label="Dashboard pages">
        <a href="../tsweb-dashboard/index.html">Sparse Change Dashboard</a>
        <a href="alpha-problem-dashboard.html">Problem Dashboard</a>
        <a href="IndexPriceParcing.html" aria-current="page">IndexPriceParsing</a>
      </nav>
      <p class="lede">Parsing-only visual index for option price work. It uses existing saved local and live benchmark artifacts; it does not call the live API.</p>
      <p class="lede">Rule remembered and reused: higher-good metrics are percent of possible total; lower-good metrics are percent of base score. If the latest score is unchanged from the previous period, the previous duplicate bar is hidden and the card says it was the same score.</p>
      <p class="lede">Generated ${escapeHtml(generated)}.</p>
      <div class="summary">
        <div>Metrics shown<strong>${cards.length}</strong></div>
        <div>Changed vs previous<strong>${changed}</strong></div>
        <div>Same as previous<strong>${same}</strong></div>
      </div>
    </header>
    <section class="grid">
      ${cards.map(renderCard).join("\n")}
    </section>
  </main>
</body>
</html>
`;
}

mkdirSync(REPORT_DIR, { recursive: true });
const cards = allCards();
writeFileSync(OUTPUT_DATA, JSON.stringify({ generated_at: new Date().toISOString(), cards }, null, 2));
writeFileSync(OUTPUT_HTML, renderHtml(cards));
console.log(`Wrote ${OUTPUT_HTML}`);
console.log(`Wrote ${OUTPUT_DATA}`);
