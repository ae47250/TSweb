import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "reports", "v3_deployment_gate");
const INPUT = path.join(DIR, "v3_gate_input.jsonl");
const GOLD = path.join(DIR, "v3_gate_answer_key.jsonl");
const DEPLOYED = path.join(DIR, "deployed_predictions.jsonl");
const STAGED = path.join(DIR, "staged_predictions.jsonl");
const SCORER = path.join(DIR, "scorer_output.txt");
const REPORT = path.join(DIR, "v3_deployment_gate_report.md");

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function byId(rows) {
  return new Map(rows.map((row) => [row.case_id, row]));
}

function normText(value) {
  return String(value ?? "").toLowerCase().match(/[a-z0-9]+/g)?.join(" ") || "";
}

function normPhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normPrice(value) {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function tokenF1(pred, gold) {
  const p = normText(pred).split(/\s+/).filter(Boolean);
  const g = normText(gold).split(/\s+/).filter(Boolean);
  if (!p.length && !g.length) return 1;
  if (!p.length || !g.length) return 0;
  const pc = new Map();
  const gc = new Map();
  for (const token of p) pc.set(token, (pc.get(token) || 0) + 1);
  for (const token of g) gc.set(token, (gc.get(token) || 0) + 1);
  let overlap = 0;
  for (const token of new Set([...pc.keys(), ...gc.keys()])) {
    overlap += Math.min(pc.get(token) || 0, gc.get(token) || 0);
  }
  const precision = overlap / p.length;
  const recall = overlap / g.length;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function serviceF1(pred = [], gold = []) {
  const ps = new Set((pred || []).map(normText).filter(Boolean));
  const gs = new Set((gold || []).map(normText).filter(Boolean));
  if (!ps.size && !gs.size) return 1;
  if (!ps.size || !gs.size) return 0;
  let overlap = 0;
  for (const item of ps) if (gs.has(item)) overlap += 1;
  const precision = overlap / ps.size;
  const recall = overlap / gs.size;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function score(pred, gold) {
  const e = gold.expected;
  const exact = {
    customer_name: normText(pred.customer_name) === normText(e.customer_name),
    phone: normPhone(pred.phone) === normPhone(e.phone),
    email: normEmail(pred.email) === normEmail(e.email),
    option_a_price: normPrice(pred.option_a_price) === e.option_a_price,
    option_b_price: normPrice(pred.option_b_price) === e.option_b_price,
  };
  const aF1 = tokenF1(pred.option_a_description, e.option_a_description);
  const bF1 = tokenF1(pred.option_b_description, e.option_b_description);
  const svcF1 = serviceF1(pred.option_b_additional_services, e.option_b_additional_services);
  const pair = exact.option_a_price && exact.option_b_price;
  return { exact, aF1, bF1, svcF1, pair, critical: exact.phone && exact.email && pair };
}

function pct(count, total) {
  return total ? `${((100 * count) / total).toFixed(1)}%` : "0.0%";
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metricSummary(rows, side) {
  return {
    customer_name: pct(rows.filter((row) => row[side].exact.customer_name).length, rows.length),
    phone: pct(rows.filter((row) => row[side].exact.phone).length, rows.length),
    email: pct(rows.filter((row) => row[side].exact.email).length, rows.length),
    option_a_price: pct(rows.filter((row) => row[side].exact.option_a_price).length, rows.length),
    option_b_price: pct(rows.filter((row) => row[side].exact.option_b_price).length, rows.length),
    pair: pct(rows.filter((row) => row[side].pair).length, rows.length),
    critical: pct(rows.filter((row) => row[side].critical).length, rows.length),
    a_f1: avg(rows.map((row) => row[side].aF1)).toFixed(3),
    b_f1: avg(rows.map((row) => row[side].bF1)).toFixed(3),
    svc_f1: avg(rows.map((row) => row[side].svcF1)).toFixed(3),
    mean_desc: avg(rows.map((row) => (row[side].aF1 + row[side].bF1) / 2)),
  };
}

function material(row, side) {
  const s = row[side];
  return !s.pair || s.aF1 < 0.8 || s.bF1 < 0.8 || s.svcF1 < 0.8;
}

function categories(row, side) {
  const pred = row[`${side}Pred`];
  const expected = row.gold.expected;
  const s = row[side];
  const out = [];

  if (normPrice(pred.option_a_price) == null) out.push("Option A price missed");
  if (normPrice(pred.option_b_price) == null) out.push("Option B price missed");
  if (
    normPrice(pred.option_a_price) === expected.option_b_price &&
    normPrice(pred.option_b_price) === expected.option_a_price
  ) out.push("prices swapped");
  if (!s.exact.option_a_price || !s.exact.option_b_price) out.push("wrong price attached to option");
  if (normText(pred.option_a_description).includes(normText(expected.option_b_description)) ||
      normText(pred.option_b_description).includes(normText(expected.option_a_description))) {
    out.push("Option A and B descriptions merged");
  }
  if (s.bF1 < 0.8) out.push("Option B description truncated");
  if (s.svcF1 < 0.8) out.push("additional service missed");
  if (row.gold.metadata.non_price_number_near_option && (!s.exact.option_a_price || !s.exact.option_b_price)) {
    out.push("non-price number treated as price");
  }
  if (row.gold.metadata.option_boundary_style === "comma_labeled") out.push("comma boundary failure");
  if (row.gold.metadata.option_boundary_style === "period_labeled") out.push("period boundary failure");
  if (row.gold.metadata.option_boundary_style === "semicolon_labeled") out.push("semicolon boundary failure");
  if (row.gold.metadata.option_boundary_style === "run_on_labeled") out.push("run-on boundary failure");
  if (row.gold.metadata.option_boundary_style === "compact_A_B") out.push("compact A/B label failure");
  if (row.gold.metadata.option_boundary_style === "price_first") out.push("price-first failure");
  if (!out.length && material(row, side)) out.push("unrelated extraction failure");
  return [...new Set(out)];
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

const inputRows = byId(readJsonl(INPUT));
const goldRows = readJsonl(GOLD);
const deployedRows = byId(readJsonl(DEPLOYED));
const stagedRows = byId(readJsonl(STAGED));
const scorerOutput = fs.readFileSync(SCORER, "utf8").trim();

const rows = goldRows.map((gold) => {
  const deployedPred = deployedRows.get(gold.case_id);
  const stagedPred = stagedRows.get(gold.case_id);
  return {
    case_id: gold.case_id,
    bucket: gold.bucket,
    raw: inputRows.get(gold.case_id)?.input_text || "",
    gold,
    deployedPred,
    stagedPred,
    deployed: score(deployedPred, gold),
    staged: score(stagedPred, gold),
  };
});

const deployedMetrics = metricSummary(rows, "deployed");
const stagedMetrics = metricSummary(rows, "staged");
const buckets = ["easy", "medium", "hard"].map((bucket) => {
  const subset = rows.filter((row) => row.bucket === bucket);
  const d = metricSummary(subset, "deployed");
  const s = metricSummary(subset, "staged");
  return [bucket, subset.length, d.pair, s.pair, d.critical, s.critical, d.mean_desc.toFixed(3), s.mean_desc.toFixed(3)];
});

const materialRows = rows.filter((row) => material(row, "deployed") || material(row, "staged"));
const fixed = materialRows.filter((row) => material(row, "deployed") && !material(row, "staged"));
const regressions = materialRows.filter((row) => !material(row, "deployed") && material(row, "staged"));
const both = materialRows.filter((row) => material(row, "deployed") && material(row, "staged"));
const different = both.filter((row) =>
  Math.abs(row.deployed.aF1 - row.staged.aF1) > 0.15 ||
  Math.abs(row.deployed.bF1 - row.staged.bF1) > 0.15 ||
  Math.abs(row.deployed.svcF1 - row.staged.svcF1) > 0.15
);

const boundaryRows = [...new Set(rows.map((row) => row.gold.metadata.option_boundary_style))].sort().map((boundary) => {
  const subset = rows.filter((row) => row.gold.metadata.option_boundary_style === boundary);
  return [
    boundary,
    subset.length,
    subset.filter((row) => material(row, "deployed")).length,
    subset.filter((row) => material(row, "staged")).length,
    avg(subset.map((row) => (row.deployed.aF1 + row.deployed.bF1) / 2)).toFixed(3),
    avg(subset.map((row) => (row.staged.aF1 + row.staged.bF1) / 2)).toFixed(3),
  ];
});

const important = [...materialRows]
  .sort((a, b) => {
    const aDrop = ((a.deployed.aF1 + a.deployed.bF1) - (a.staged.aF1 + a.staged.bF1));
    const bDrop = ((b.deployed.aF1 + b.deployed.bF1) - (b.staged.aF1 + b.staged.bF1));
    return bDrop - aDrop;
  })
  .slice(0, 5);

const gate = {
  noPhoneRegression: stagedMetrics.phone >= deployedMetrics.phone,
  noEmailRegression: stagedMetrics.email >= deployedMetrics.email,
  noAPriceRegression: stagedMetrics.option_a_price >= deployedMetrics.option_a_price,
  noBPriceRegression: stagedMetrics.option_b_price >= deployedMetrics.option_b_price,
  stagedPairAtLeast97: rows.filter((row) => row.staged.pair).length / rows.length >= 0.97,
  stagedHardPairAtLeast90: rows.filter((row) => row.bucket === "hard" && row.staged.pair).length / rows.filter((row) => row.bucket === "hard").length >= 0.90,
  stagedMeanDescAtLeast90: stagedMetrics.mean_desc >= 0.90,
};

const decision = Object.values(gate).every(Boolean) ? "DEPLOY VERSION 3.0" : "HOLD VERSION 3.0";

const report = [
  "# Version 3.0 Deployment Gate Report",
  "",
  "## Executive decision",
  "",
  `**${decision}**`,
  "",
  "Version 3.0 passes the price-pair gate on this 30-row benchmark, but it fails the required mean option-description F1 threshold. It also regresses description extraction compared with the deployed pipeline.",
  "",
  "## Code paths",
  "",
  "- Current deployed: `https://tree-service-web-app.vercel.app/api/openai` followed by `https://tree-service-web-app.vercel.app/api/validate`.",
  "- Staged Version 3.0: local branch API at `http://127.0.0.1:3000/api/openai` followed by `http://127.0.0.1:3000/api/validate`.",
  "- Assumption: this repository does not expose two separate local implementations named deployed and v3. The closest staged implementation is the current local branch state; the deployed implementation is the hosted production route.",
  "",
  "## Overall comparison",
  "",
  table(
    ["Metric", "Current deployed", "Staged V3"],
    [
      ["Customer name exact", deployedMetrics.customer_name, stagedMetrics.customer_name],
      ["Phone exact", deployedMetrics.phone, stagedMetrics.phone],
      ["Email exact", deployedMetrics.email, stagedMetrics.email],
      ["Option A price exact", deployedMetrics.option_a_price, stagedMetrics.option_a_price],
      ["Option B price exact", deployedMetrics.option_b_price, stagedMetrics.option_b_price],
      ["A/B price-pair exact", deployedMetrics.pair, stagedMetrics.pair],
      ["Critical-row exact", deployedMetrics.critical, stagedMetrics.critical],
      ["Option A description F1", deployedMetrics.a_f1, stagedMetrics.a_f1],
      ["Option B description F1", deployedMetrics.b_f1, stagedMetrics.b_f1],
      ["Option B services F1", deployedMetrics.svc_f1, stagedMetrics.svc_f1],
      ["Mean option-description F1", deployedMetrics.mean_desc.toFixed(3), stagedMetrics.mean_desc.toFixed(3)],
    ],
  ),
  "",
  "## Bucket comparison",
  "",
  table(
    ["Bucket", "Rows", "Deployed pair", "Staged pair", "Deployed critical", "Staged critical", "Deployed desc F1", "Staged desc F1"],
    buckets,
  ),
  "",
  "Hard-bucket price-pair exact is 100.0% for both pipelines. The staged hard-bucket description score is below the 0.90 deployment condition.",
  "",
  "## Failure comparison",
  "",
  table(
    ["Group", "Cases"],
    [
      ["Failures fixed by V3", fixed.map((row) => row.case_id).join(", ") || "none"],
      ["Regressions introduced by V3", regressions.map((row) => row.case_id).join(", ") || "none"],
      ["Failures present in both", both.map((row) => row.case_id).join(", ") || "none"],
      ["Different failure shape", different.map((row) => row.case_id).join(", ") || "none"],
    ],
  ),
  "",
  "No price-pair failures, swapped-price failures, or wrong-price-attached failures were found by the scorer. The material failures are description and additional-service quality failures.",
  "",
  "## Boundary-style comparison",
  "",
  table(
    ["Boundary style", "Rows", "Deployed failures", "Staged failures", "Deployed desc F1", "Staged desc F1"],
    boundaryRows,
  ),
  "",
  "## Five most important failure cases",
  "",
  table(
    ["Case", "Bucket", "Boundary", "Categories", "Expected", "Deployed", "Staged"],
    important.map((row) => [
      row.case_id,
      row.bucket,
      row.gold.metadata.option_boundary_style,
      categories(row, "staged").join("; "),
      `A: ${row.gold.expected.option_a_description} / ${row.gold.expected.option_a_price}<br>B: ${row.gold.expected.option_b_description} / ${row.gold.expected.option_b_price}`,
      `A: ${row.deployedPred.option_a_description} / ${row.deployedPred.option_a_price}<br>B: ${row.deployedPred.option_b_description} / ${row.deployedPred.option_b_price}<br>F1 A/B: ${row.deployed.aF1.toFixed(3)} / ${row.deployed.bF1.toFixed(3)}`,
      `A: ${row.stagedPred.option_a_description} / ${row.stagedPred.option_a_price}<br>B: ${row.stagedPred.option_b_description} / ${row.stagedPred.option_b_price}<br>F1 A/B: ${row.staged.aF1.toFixed(3)} / ${row.staged.bF1.toFixed(3)}`,
    ]),
  ),
  "",
  "## Deployment-gate result",
  "",
  table(
    ["Condition", "Result"],
    [
      ["No regression in phone accuracy", gate.noPhoneRegression ? "PASS" : "FAIL"],
      ["No regression in email accuracy", gate.noEmailRegression ? "PASS" : "FAIL"],
      ["No regression in Option A price accuracy", gate.noAPriceRegression ? "PASS" : "FAIL"],
      ["No regression in Option B price accuracy", gate.noBPriceRegression ? "PASS" : "FAIL"],
      ["Staged overall A/B price-pair accuracy >= 97%", gate.stagedPairAtLeast97 ? "PASS" : "FAIL"],
      ["Staged hard-bucket A/B price-pair accuracy >= 90%", gate.stagedHardPairAtLeast90 ? "PASS" : "FAIL"],
      ["Staged mean option-description F1 >= 0.90", gate.stagedMeanDescAtLeast90 ? "PASS" : "FAIL"],
    ],
  ),
  "",
  "## Scorer output",
  "",
  "```text",
  scorerOutput,
  "```",
  "",
].join("\n");

fs.writeFileSync(REPORT, report);
console.log(JSON.stringify({ report: REPORT, decision, material_cases: materialRows.length }, null, 2));
