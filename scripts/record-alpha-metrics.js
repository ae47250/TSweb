import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const FIXTURE_DIR = "tests/fixtures";
const REPORT_DIR = "reports";
const HISTORY_PATH = join(REPORT_DIR, "alpha-metrics-history.jsonl");
const REPORT_PATH = join(REPORT_DIR, "alpha-metrics-report.md");

function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function easternTimestamp(date) {
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

function isBlank(value) {
  return value == null || value === "";
}

function runPipeline(customerText) {
  return validateAlphaJson(normalizeToAlphaJsonV14({}, customerText));
}

function includesAll(haystack, needles) {
  const text = haystack.join(" | ").toLowerCase();
  return needles.every((needle) => text.includes(String(needle).toLowerCase()));
}

function actualSummary(validation) {
  const alphaJson = validation.alphaJson;
  return {
    name: alphaJson.customer?.name || "",
    phone: alphaJson.customer?.phone_display || "",
    email: alphaJson.customer?.email || "",
    address: alphaJson.job?.service_address?.display || "",
    treeCount: alphaJson.job?.tree_details?.tree_count || "",
    prices: (alphaJson.service_options?.items || []).map((option) => option.price?.display || ""),
    correctedInterpretation: alphaJson.normalization?.corrected_interpretation || "",
  };
}

function expectedPriceWindow(testCase) {
  const prices = testCase.expected?.service_option_prices || [];
  return prices.length > 4 ? prices.slice(0, 4) : prices;
}

function parserMismatches(testCase, validation) {
  const actual = actualSummary(validation);
  const expected = testCase.expected || {};
  const mismatches = [];

  if (!isBlank(expected.customer_name) && actual.name !== expected.customer_name) mismatches.push("parser_name");
  if (!isBlank(expected.phone_display) && actual.phone !== expected.phone_display) mismatches.push("parser_contact");
  if (!isBlank(expected.email) && actual.email !== expected.email) mismatches.push("parser_contact");
  if (
    Array.isArray(expected.service_address_should_include) &&
    expected.service_address_should_include.length &&
    !includesAll([actual.address], expected.service_address_should_include)
  ) {
    mismatches.push("parser_address");
  }
  if (!isBlank(expected.tree_count) && actual.treeCount !== expected.tree_count) mismatches.push("parser_tree_count");

  const expectedPrices = expectedPriceWindow(testCase);
  if (
    expectedPrices.length &&
    (actual.prices.length !== expectedPrices.length || actual.prices.some((price, index) => price !== expectedPrices[index]))
  ) {
    mismatches.push("parser_price_options");
  }

  return [...new Set(mismatches)];
}

function syntheticPhone(testCase) {
  const numericId = Number(String(testCase.id).replace(/\D/g, "").slice(-4) || "0");
  return `812-555-${String(7000 + (numericId % 1000)).padStart(4, "0")}`;
}

function syntheticAddress(testCase) {
  const numericId = Number(String(testCase.id).replace(/\D/g, "").slice(-4) || "0");
  return `${1000 + numericId} Oak Lane Madison IN`;
}

function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

function followUpPrices(testCase, validation) {
  const expectedPrices = testCase.expected?.service_option_prices || [];
  if (expectedPrices.length) return expectedPrices.slice(0, 4);

  const currentOptions = validation.alphaJson?.service_options?.items || [];
  const optionCount = Math.max(currentOptions.length, 2);
  return Array.from({ length: optionCount }, (_, index) => `$${(1000 + index * 650).toLocaleString("en-US")}`);
}

function buildFollowUpAnswer(testCase, validation, round) {
  const expected = testCase.expected || {};
  const errors = validation.blocking_errors.join(" | ");
  const parts = [];

  if (/address/i.test(errors)) {
    const address = expected.service_address_should_include?.length
      ? expected.service_address_should_include.join(" ")
      : syntheticAddress(testCase);
    parts.push(`service address ${address}`);
  }

  if (/phone|email|contact/i.test(errors)) {
    parts.push(expected.phone_display ? `phone ${expected.phone_display}` : `phone ${syntheticPhone(testCase)}`);
  }

  if (/tree count|clear scope|description|title/i.test(errors)) {
    const treeCount = expected.tree_count || "1 tree";
    parts.push(`${treeCount} to remove`);
  }

  if (/priced service option|clear price|price/i.test(errors)) {
    const prices = followUpPrices(testCase, validation);
    prices.forEach((price, index) => {
      const work = index === 0 ? "cut and leave wood" : index === 1 ? "haul debris and cleanup" : "stump grind add-on";
      parts.push(`Option ${optionLetter(index)} ${work} ${price}`);
    });
  }

  if (!parts.length) {
    parts.push(`phone ${expected.phone_display || syntheticPhone(testCase)}`);
    parts.push(`service address ${expected.service_address_should_include?.join(" ") || syntheticAddress(testCase)}`);
    parts.push(`${expected.tree_count || "1 tree"} to remove`);
    parts.push("Option A cut and leave wood $1,000");
  }

  const messy = (Number(String(testCase.id).replace(/\D/g, "")) + round) % 2 === 0;
  return messy
    ? `yeah ${parts.join(" also ")}`
    : `Follow-up details: ${parts.join(". ")}.`;
}

function runFollowUpSimulation(testCase, maxRounds) {
  let customerText = testCase.raw_customer_input;

  for (let round = 0; round <= maxRounds; round += 1) {
    const validation = runPipeline(customerText);
    if (validation.can_generate_pdf) {
      return { finalValidation: validation, recovered: round > 0, rounds: round };
    }
    if (round === maxRounds) {
      return { finalValidation: validation, recovered: false, rounds: round };
    }
    customerText = `${customerText}\nFollow-up ${round + 1}: ${buildFollowUpAnswer(testCase, validation, round)}`;
  }

  throw new Error(`Unexpected simulation exit for ${testCase.id}`);
}

function hasSafetyOnlyExpectedBlock(testCase) {
  const expected = testCase.expected || {};
  if (expected.can_generate_pdf !== false) return false;
  if ((expected.follow_ups_should_include || []).length) return false;
  return /\b(aggressive|dog|dogs|power\s+line|wire|service\s+drop|touching|blocked\s+access|blocked|fence|gate|driveway|same-?day|emergency|hazard)\b/i.test(
    testCase.raw_customer_input || "",
  );
}

function warningMismatches(testCase, validation) {
  const warnings = (validation.warnings || []).join(" | ");
  const blockingErrors = (validation.blocking_errors || []).join(" | ");
  const mismatches = [];

  if ((testCase.expected?.service_option_prices || []).length > 4 && !/more than four options/i.test(warnings)) {
    mismatches.push("warning_policy");
  }

  if (/\b(aggressive|dog|dogs|power\s+line|wire|service\s+drop|blocked\s+access|fence|gate|driveway|hazard)\b/i.test(testCase.raw_customer_input || "")) {
    if (/safety|access|hazard/i.test(blockingErrors)) mismatches.push("warning_policy");
  }

  return mismatches;
}

function readinessMismatches(testCase, validation) {
  const expectedReady = testCase.expected?.can_generate_pdf;
  const mismatches = [];

  if ((testCase.decision === "parse" || expectedReady === true) && !validation.can_generate_pdf) {
    mismatches.push("validator_readiness");
  }

  if (expectedReady === false && validation.can_generate_pdf && !hasSafetyOnlyExpectedBlock(testCase)) {
    mismatches.push("validator_readiness");
  }

  return mismatches;
}

function customerFacingLeakage(validation) {
  const text = actualSummary(validation).correctedInterpretation;
  return /\bFollow-up\b|Customer\s+(?:name|phone|email)|Service\s+address|Exact\s+service\s+address|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}|\b(?:aggressive\s+dog|dog\s+in\s+backyard|blocked\s+access|no\s+access)\b/i.test(text);
}

function failureCategories(testCase, initialValidation, simulation) {
  const categories = new Set();

  parserMismatches(testCase, initialValidation).forEach((mismatch) => categories.add(mismatch));
  readinessMismatches(testCase, initialValidation).forEach((mismatch) => categories.add(mismatch));
  warningMismatches(testCase, initialValidation).forEach((mismatch) => categories.add(mismatch));
  if (!simulation.finalValidation.can_generate_pdf) categories.add("follow_up_unrecovered");

  return [...categories];
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function summarizeBenchmark(fixture) {
  const maxRounds = fixture.follow_up_round_limit || 3;
  const results = fixture.cases.map((testCase) => {
    const initialValidation = runPipeline(testCase.raw_customer_input);
    const simulation = runFollowUpSimulation(testCase, maxRounds);
    return {
      id: testCase.id,
      category: testCase.category,
      messiness: testCase.messiness,
      decision: testCase.decision,
      initiallyReady: initialValidation.can_generate_pdf,
      finalReady: simulation.finalValidation.can_generate_pdf,
      recovered: simulation.recovered,
      rounds: simulation.rounds,
      customerFacingLeakage: customerFacingLeakage(simulation.finalValidation),
      failureCategories: failureCategories(testCase, initialValidation, simulation),
    };
  });
  const failing = results.filter((result) => result.failureCategories.length);
  const failureCategoryCounts = {};

  failing.forEach((result) => {
    result.failureCategories.forEach((category) => {
      failureCategoryCounts[category] = (failureCategoryCounts[category] || 0) + 1;
    });
  });

  return {
    total: results.length,
    failing: failing.length,
    errorRate: Number((failing.length / results.length).toFixed(4)),
    errorRatePercentExact: Number(((failing.length / results.length) * 100).toFixed(2)),
    initiallyReady: results.filter((result) => result.initiallyReady).length,
    recoveredAfterFollowUp: results.filter((result) => result.recovered).length,
    stillBlocked: results.filter((result) => !result.finalReady).length,
    customerFacingLeakage: results.filter((result) => result.customerFacingLeakage).length,
    maxRoundsUsed: Math.max(...results.map((result) => result.rounds)),
    byMessiness: countBy(results, (result) => result.messiness || "unknown"),
    byCategory: countBy(results, (result) => result.category || "unknown"),
    byDecision: countBy(results, (result) => result.decision || "unknown"),
    failureCategories: failureCategoryCounts,
  };
}

function readHistory() {
  try {
    return readFileSync(HISTORY_PATH, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function bar(value, max = 100, width = 24) {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return `${"#".repeat(filled)}${".".repeat(width - filled)}`;
}

function metricDelta(current, previous, getter) {
  if (!previous) return "";
  const delta = getter(current) - getter(previous);
  if (Math.abs(delta) < 0.0001) return "same";
  return delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
}

function renderReport(history) {
  const latest = history.at(-1);
  const previous = history.length > 1 ? history.at(-2) : null;
  const lines = [
    "# Alpha Metrics Report",
    "",
    `Generated Eastern: ${latest.timestampEastern || latest.timestamp}`,
    `Generated UTC: ${latest.timestamp}`,
    `Commit: ${latest.commit}`,
    `Branch: ${latest.branch}`,
    "",
    "## Current Cohort Metrics",
    "",
    "| Tier | Error | Trend | Failing | Recovered | Still blocked | Customer leakage | Top failure buckets |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
  ];

  for (const [tier, summary] of Object.entries(latest.fixtures)) {
    const previousSummary = previous?.fixtures?.[tier];
    const failures = Object.entries(summary.failureCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => `${key} ${count}`)
      .join(", ") || "none";
    lines.push(
      `| ${tier} | ${summary.errorRatePercentExact.toFixed(2)}% \`${bar(summary.errorRatePercentExact)}\` | ${metricDelta(summary, previousSummary, (item) => item.errorRatePercentExact)} | ${summary.failing}/${summary.total} | ${summary.recoveredAfterFollowUp} | ${summary.stillBlocked} | ${summary.customerFacingLeakage} | ${failures} |`,
    );
  }

  lines.push("", "## Error Rate History", "");
  for (const [tier] of Object.entries(latest.fixtures)) {
    lines.push(`### ${tier}`, "");
    lines.push("| Commit | Eastern time | UTC time | Error | Failing | Still blocked | Leakage |");
    lines.push("|---|---|---|---:|---:|---:|---:|");
    for (const snapshot of history.slice(-10)) {
      const summary = snapshot.fixtures[tier];
      if (!summary) continue;
      lines.push(
        `| ${snapshot.commit.slice(0, 7)} | ${snapshot.timestampEastern || ""} | ${snapshot.timestamp} | ${summary.errorRatePercentExact.toFixed(2)}% | ${summary.failing}/${summary.total} | ${summary.stillBlocked} | ${summary.customerFacingLeakage} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## How To Read This",
    "",
    "- Error rate measures parser/readiness mismatch against the fixture expected outcomes.",
    "- Recovered means the simulated Tree Dude follow-up loop eventually produced a quote-ready AlphaJSON.",
    "- Still blocked should stay at 0 when follow-up answers contain enough information.",
    "- Customer leakage counts customer-facing summaries containing contact labels, phones, emails, follow-up labels, or internal safety/access notes.",
    "- Top failure buckets tell us what to improve next without guessing.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => /^alpha-.*-cases\.json$/i.test(name))
  .sort()
  .map((filename) => ({
    filename,
    data: JSON.parse(readFileSync(join(FIXTURE_DIR, filename), "utf8")),
  }));

const now = new Date();
const snapshot = {
  timestamp: now.toISOString(),
  timestampEastern: easternTimestamp(now),
  commit: git("rev-parse HEAD"),
  branch: git("branch --show-current"),
  fixtures: Object.fromEntries(fixtures.map(({ data }) => [data.tier, summarizeBenchmark(data)])),
};

mkdirSync(REPORT_DIR, { recursive: true });
const history = [...readHistory(), snapshot];
writeFileSync(HISTORY_PATH, `${history.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
writeFileSync(REPORT_PATH, renderReport(history));

console.log(`Recorded Alpha metrics for ${snapshot.commit.slice(0, 7)}.`);
console.log(`History: ${HISTORY_PATH}`);
console.log(`Report: ${REPORT_PATH}`);
