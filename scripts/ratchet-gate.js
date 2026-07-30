#!/usr/bin/env node
/**
 * Semantic ratchet gate over the 60-case offline eval reports.
 *
 * Splits gates into three classes rather than one aggregate pass/fail score:
 *   - ratchet:  a metric's rate/count may never regress past its recorded
 *               floor/ceiling. When a run improves a metric, `--update`
 *               permanently lowers/raises that ceiling/floor.
 *   - safety:   the incorrect-but-ready count may never increase, and no
 *               case ID outside the known baseline set may newly appear as
 *               incorrect-but-ready, even if the aggregate count does not
 *               increase (a swap is still a new safety failure).
 *
 * Usage:
 *   node scripts/ratchet-gate.js                 # check current reports against baseline
 *   node scripts/ratchet-gate.js --update         # also tighten the baseline on improvement
 *   node scripts/ratchet-gate.js --baseline path  # use an alternate baseline file
 */
import { readFileSync, writeFileSync } from "node:fs";

const DEFAULT_BASELINE_PATH = "reports/ratchet-baseline.json";

function parseArgs(argv) {
  const args = { update: false, baseline: DEFAULT_BASELINE_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--update") args.update = true;
    else if (token === "--baseline") args.baseline = argv[++i];
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readAtPath(root, path = []) {
  let current = root;
  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

function evaluateRateOrCountMetric(name, metric, reports) {
  const value = readAtPath(reports, metric.path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      name,
      category: metric.category,
      ok: false,
      message: `metric value missing or non-numeric at ${metric.path.join(".")}`,
    };
  }

  if (metric.direction === "higher_is_better") {
    const floor = metric.floor;
    const ok = value >= floor - 1e-9;
    return {
      name,
      category: metric.category,
      ok,
      value,
      bound: floor,
      boundKind: "floor",
      improved: value > floor + 1e-9,
      message: ok
        ? `${value.toFixed(4)} >= floor ${floor.toFixed(4)}`
        : `REGRESSION: ${value.toFixed(4)} < floor ${floor.toFixed(4)}`,
    };
  }

  const ceiling = metric.ceiling;
  const ok = value <= ceiling + 1e-9;
  return {
    name,
    category: metric.category,
    ok,
    value,
    bound: ceiling,
    boundKind: "ceiling",
    improved: value < ceiling - 1e-9,
    message: ok
      ? `${value.toFixed(4)} <= ceiling ${ceiling.toFixed(4)}`
      : `REGRESSION: ${value.toFixed(4)} > ceiling ${ceiling.toFixed(4)}`,
  };
}

function evaluateSafetyMetric(name, metric, reports) {
  const rateResult = evaluateRateOrCountMetric(name, metric, reports);
  const currentIds = new Set(readAtPath(reports, metric.case_id_path) || []);
  const knownIds = new Set(metric.known_case_ids || []);
  const newlyIntroduced = [...currentIds].filter((id) => !knownIds.has(id));

  return {
    ...rateResult,
    ok: rateResult.ok && newlyIntroduced.length === 0,
    newlyIntroduced,
    message: newlyIntroduced.length
      ? `${rateResult.message}; SAFETY FAILURE: new incorrect-but-ready case(s): ${newlyIntroduced.join(", ")}`
      : rateResult.message,
  };
}

function loadReports(baseline) {
  const cache = {};
  for (const [key, path] of Object.entries(baseline.source_reports)) {
    cache[key] = readJson(path);
  }
  return cache;
}

function updateBaselineIfImproved(baseline, results) {
  let changed = false;
  for (const result of results) {
    if (!result.improved) continue;
    const metric = baseline.metrics[result.name];
    if (result.boundKind === "floor") metric.floor = result.value;
    else metric.ceiling = result.value;
    if (result.name === "incorrect_but_ready_count") {
      metric.known_case_ids = result.newlyIntroduced?.length
        ? [...new Set([...metric.known_case_ids, ...result.newlyIntroduced])]
        : metric.known_case_ids;
    }
    changed = true;
  }
  return changed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = readJson(args.baseline);
  const reports = loadReports(baseline);

  const results = Object.entries(baseline.metrics).map(([name, metric]) =>
    metric.category === "safety"
      ? evaluateSafetyMetric(name, metric, reports)
      : evaluateRateOrCountMetric(name, metric, reports),
  );

  console.log("Ratchet gate results:");
  for (const result of results) {
    const tag = result.ok ? "PASS" : "FAIL";
    console.log(`  [${tag}] (${result.category}) ${result.name}: ${result.message}`);
  }

  const failures = results.filter((result) => !result.ok);
  const improvements = results.filter((result) => result.improved);

  if (args.update && improvements.length) {
    const changed = updateBaselineIfImproved(baseline, results);
    if (changed) {
      writeFileSync(args.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
      console.log(`\nBaseline tightened for: ${improvements.map((r) => r.name).join(", ")}`);
    }
  } else if (improvements.length) {
    console.log(
      `\nImproved without tightening baseline (re-run with --update to lock in): ${improvements.map((r) => r.name).join(", ")}`,
    );
  }

  if (failures.length) {
    console.error(`\n${failures.length} ratchet/safety gate(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll ratchet and safety gates passed.");
}

main();
