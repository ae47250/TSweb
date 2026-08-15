#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POLICY_PATH = "config/customer-pipeline-observability-policy.json";

function parseArgs(argv) {
  const inputIndex = argv.indexOf("--input");
  const baselineIndex = argv.indexOf("--baseline-correction-rate");
  return {
    input: inputIndex >= 0 ? argv[inputIndex + 1] : "",
    baselineCorrectionRate: baselineIndex >= 0 ? Number(argv[baselineIndex + 1]) : null,
    live: argv.includes("--live"),
    telemetryHealthUrl: valueAfter(argv, "--telemetry-health-url"),
    alertHealthUrl: valueAfter(argv, "--alert-health-url"),
  };
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? asString(argv[index + 1]) : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return value == null ? "" : String(value).trim();
}

function readEvents(path) {
  const text = readFileSync(resolve(path), "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid telemetry JSON on line ${index + 1}: ${error.message}`);
    }
  });
}

function validateEventSchema(events, policy) {
  const failures = [];
  const required = Array.isArray(policy.required_event_fields) ? policy.required_event_fields : [];
  const requiredVersion = asString(policy.required_event_version);
  const forbidden = new Set(Array.isArray(policy.forbidden_event_fields) ? policy.forbidden_event_fields : []);
  for (const [index, event] of events.entries()) {
    if (!Object.hasOwn(event, "event")) failures.push(`event ${index + 1} is missing event`);
    if (!["customer_pipeline_validation", "customer_pipeline_delivery"].includes(event.event)) {
      failures.push(`event ${index + 1} has unsupported event type`);
    }
    if (asString(event.telemetry_version) !== requiredVersion) {
      failures.push(`event ${index + 1} has unsupported telemetry_version; expected ${requiredVersion}`);
    }
    for (const field of required) {
      if (!Object.hasOwn(event, field)) failures.push(`event ${index + 1} is missing ${field}`);
    }
    for (const field of Object.keys(event)) {
      if (forbidden.has(field)) failures.push(`event ${index + 1} contains forbidden field ${field}`);
    }
    for (const field of [
      "blocking_count",
      "safety_finding_count",
      "semantic_error_count",
      "reviewer_override_count",
      "correction_eligible_count",
      "correction_applied_count",
      "parity_difference_count",
    ]) {
      if (!Number.isInteger(event[field]) || event[field] < 0) {
        failures.push(`event ${index + 1} has invalid non-negative integer ${field}`);
      }
    }
    if (typeof event.false_ready_escape !== "boolean") {
      failures.push(`event ${index + 1} has invalid false_ready_escape`);
    }
    if (typeof event.correction_applied !== "boolean") {
      failures.push(`event ${index + 1} has invalid correction_applied`);
    }
    if (event.latency_ms != null && (!Number.isFinite(event.latency_ms) || event.latency_ms < 0)) {
      failures.push(`event ${index + 1} has invalid latency_ms`);
    }
  }
  return failures;
}

async function probeHealth(url, token = "", timeoutMs = 5000) {
  try {
    const parsed = new URL(url);
    const response = await fetch(parsed, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      status: response.ok ? "PASS" : "FAIL",
      http_status: response.status,
      origin: parsed.origin,
    };
  } catch (error) {
    return {
      status: "FAIL",
      reason: error?.name === "TimeoutError" ? "timeout" : "request_failed",
    };
  }
}

async function liveChecks(args, policy) {
  if (!args.live) return { status: "NOT_ATTEMPTED" };
  if (!args.telemetryHealthUrl || !args.alertHealthUrl) {
    return {
      status: "FAIL",
      reason: "--live requires both --telemetry-health-url and --alert-health-url",
    };
  }
  const timeoutMs = Number(policy.live_probe?.timeout_ms || 5000);
  const telemetry = await probeHealth(args.telemetryHealthUrl, asString(process.env.CUSTOMER_PIPELINE_TELEMETRY_TOKEN), timeoutMs);
  const alerts = await probeHealth(args.alertHealthUrl, "", timeoutMs);
  return {
    status: telemetry.status === "PASS" && alerts.status === "PASS" ? "PASS" : "FAIL",
    telemetry,
    alerts,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("Use --input with a structured customer pipeline JSONL log.");
  const policy = JSON.parse(readFileSync(resolve(POLICY_PATH), "utf8"));
  const events = readEvents(args.input);
  const pipelineEvents = events.filter((event) => [
    "customer_pipeline_validation",
    "customer_pipeline_delivery",
  ].includes(event?.event));
  const validations = pipelineEvents.filter((event) => event.event === "customer_pipeline_validation");
  const deliveries = pipelineEvents.filter((event) => event.event === "customer_pipeline_delivery");
  const all = [...validations, ...deliveries];
  const blocked = all.filter((event) => Number(event.blocking_count) > 0).length;
  const safetyFlags = all.filter((event) => Number(event.safety_finding_count) > 0).length;
  const eligibleCorrections = all.reduce((sum, event) => sum + Number(event.correction_eligible_count || 0), 0);
  const appliedCorrections = all.reduce((sum, event) => sum + Number(event.correction_applied_count || 0), 0);
  const correctionRate = eligibleCorrections ? appliedCorrections / eligibleCorrections : null;
  const reasonMix = all.reduce((counts, event) => {
    for (const [reason, count] of Object.entries(event.reviewer_reason_counts || {})) {
      counts[reason] = (counts[reason] || 0) + Number(count || 0);
    }
    return counts;
  }, {});
  const falseReadyEscapes = all.reduce((sum, event) => sum + (event.false_ready_escape ? 1 : 0), 0);
  const failures = validateEventSchema(pipelineEvents, policy);
  if (pipelineEvents.length < Number(policy.minimum_event_count || 1)) {
    failures.push(`telemetry stream contains ${pipelineEvents.length} pipeline events; minimum is ${policy.minimum_event_count}`);
  }
  if (!validations.length) failures.push("telemetry stream contains no validation events");
  if (falseReadyEscapes > policy.maximum_false_ready_escapes) {
    failures.push(`false-ready escapes: ${falseReadyEscapes}`);
  }
  if (eligibleCorrections >= Number(policy.minimum_correction_samples || 0) && !Number.isFinite(args.baselineCorrectionRate)) {
    failures.push("--baseline-correction-rate is required once the correction sample minimum is met");
  }
  if (
    Number.isFinite(args.baselineCorrectionRate) &&
    eligibleCorrections >= policy.minimum_correction_samples &&
    correctionRate < args.baselineCorrectionRate * (1 - policy.correction_rate_drop_fraction)
  ) {
    failures.push(`correction-apply rate ${correctionRate.toFixed(4)} is below the allowed baseline floor`);
  }
  const live = await liveChecks(args, policy);
  if (live.status === "FAIL") failures.push(live.reason || "live monitoring health probes failed");
  const report = {
    report_version: "customer-pipeline-observability-report-v1",
    event_count: pipelineEvents.length,
    validation_count: validations.length,
    delivery_count: deliveries.length,
    safety_flag_rate: all.length ? safetyFlags / all.length : null,
    block_rate: all.length ? blocked / all.length : null,
    reviewer_override_rate: all.length ? eligibleCorrections / all.length : null,
    reason_mix: reasonMix,
    false_ready_escapes: falseReadyEscapes,
    correction_eligible_count: eligibleCorrections,
    correction_applied_count: appliedCorrections,
    correction_apply_rate: correctionRate,
    schema_failures: [...new Set(failures.filter((failure) => /event \d+|telemetry stream/i.test(failure)))],
    live,
    status: failures.length ? "FAIL" : "PASS",
    failures: [...new Set(failures)],
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`Customer pipeline observability check failed: ${error?.stack || error}`);
  process.exitCode = 1;
}
