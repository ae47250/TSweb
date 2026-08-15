#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { resolveCustomerPipeline } from "../lib/customerPipeline.js";
import { validateAlphaJsonRoutePayload } from "../lib/validateRoutePayload.js";

const FIXTURE_PATH = "tests/fixtures/tree-dude-service-classification-60.json";

function parseArgs(argv) {
  const iterationsIndex = argv.indexOf("--iterations");
  const iterations = iterationsIndex >= 0 ? Number(argv[iterationsIndex + 1]) : 1;
  return {
    iterations: Number.isInteger(iterations) && iterations > 0 ? iterations : 1,
    failOnRegression: argv.includes("--fail-on-regression"),
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return value == null ? "" : String(value).trim();
}

function rowText(row) {
  return [row?.raw_note, row?.raw_customer_input, row?.raw, row?.input, row?.text, row?.customer_text]
    .map(asString)
    .find(Boolean) || "";
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)];
}

function measure(rows, iterations, fn) {
  const durations = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const row of rows) {
      const started = performance.now();
      fn(row);
      durations.push(performance.now() - started);
    }
  }
  return {
    samples: durations.length,
    p50_ms: Number(percentile(durations, 0.5).toFixed(2)),
    p95_ms: Number(percentile(durations, 0.95).toFixed(2)),
    max_ms: Number(Math.max(...durations).toFixed(2)),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const parsed = JSON.parse(readFileSync(resolve(FIXTURE_PATH), "utf8"));
  const rows = Array.isArray(parsed) ? parsed : asArray(parsed?.cases);
  if (!rows.length) throw new Error("The locked 60-case fixture is empty.");

  const baseEnv = {
    ...process.env,
    CUSTOMER_PIPELINE_TELEMETRY: "false",
  };
  const legacy = measure(rows, args.iterations, (row) => {
    validateAlphaJsonRoutePayload({ alphaJson: row.raw_draft || {}, customer_text: rowText(row) }, {
      enforceFieldResolution: false,
      applyAssembler: false,
      pipelineName: "load-legacy",
    });
  });
  const dualRun = measure(rows, args.iterations, (row) => {
    resolveCustomerPipeline({ alphaJson: row.raw_draft || {}, customer_text: rowText(row) }, {
      documentId: row.case_id || row.id || "load-case",
      env: baseEnv,
      telemetry: false,
    });
  });
  const allowedP95 = legacy.p95_ms * 1.2;
  const report = {
    report_version: "customer-pipeline-load-report-v1",
    fixture: FIXTURE_PATH,
    case_count: rows.length,
    iterations: args.iterations,
    legacy,
    dual_run: dualRun,
    allowed_dual_run_p95_ms: Number(allowedP95.toFixed(2)),
    p95_regression: dualRun.p95_ms > allowedP95,
  };
  console.log(JSON.stringify(report, null, 2));
  if (args.failOnRegression && report.p95_regression) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Customer pipeline load check failed: ${error?.stack || error}`);
  process.exitCode = 1;
}

