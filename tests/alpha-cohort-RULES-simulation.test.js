import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const FIXTURE_DIR = "tests/fixtures";
const EXPECTED_TIERS = ["easy", "medium", "medium-messy", "very-messy", "uber-messy", "uber-plus-messy", "hard-knownfail"];
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => /^alpha-.*-cases\.json$/i.test(name))
  .sort()
  .map((filename) => ({
    filename,
    data: JSON.parse(readFileSync(join(FIXTURE_DIR, filename), "utf8")),
  }));

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

  if (/property responsibility|work scope/i.test(errors)) {
    parts.push("scope confirmed and customer is responsible for this property work");
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
    maxRoundsUsed: Math.max(...results.map((result) => result.rounds)),
    byMessiness: countBy(results, (result) => result.messiness || "unknown"),
    byCategory: countBy(results, (result) => result.category || "unknown"),
    byDecision: countBy(results, (result) => result.decision || "unknown"),
    failureCategories: failureCategoryCounts,
  };
}

test("alpha cohort fixtures are complete, named with initial rate, and non-overlapping", () => {
  assert.equal(fixtures.length, EXPECTED_TIERS.length);
  assert.deepEqual(
    fixtures.map(({ data }) => data.tier).sort(),
    [...EXPECTED_TIERS].sort(),
  );

  const seenIds = new Set();
  for (const { filename, data } of fixtures) {
    assert.equal(data.case_count, 150, `${filename} should declare 150 cases`);
    assert.equal(data.cases.length, 150, `${filename} should contain 150 cases`);
    assert.equal(data.initial_baseline.total, 150, `${filename} should store a 150-case baseline`);
    assert.match(filename, /^alpha-.+-150-initial-\d+pct-2026-06-30-cases\.json$/);

    const expectedPct = Math.round(data.initial_baseline.error_rate * 100);
    assert.ok(filename.includes(`initial-${expectedPct}pct`), `${filename} should include its rounded initial failure rate`);

    for (const testCase of data.cases) {
      assert.ok(!seenIds.has(testCase.id), `${testCase.id} appears in more than one generated cohort`);
      seenIds.add(testCase.id);
    }
  }
});

test("alpha cohort current error rates do not exceed stored initial baselines", (context) => {
  for (const { filename, data } of fixtures) {
    const summary = summarizeBenchmark(data);
    context.diagnostic(JSON.stringify({ fixture: filename, tier: data.tier, ...summary }));

    assert.equal(summary.total, data.initial_baseline.total, `${filename} total case count changed`);
    assert.ok(
      summary.failing <= data.initial_baseline.failing_cases,
      `${filename} regressed from ${data.initial_baseline.failing_cases} to ${summary.failing} failing cases`,
    );
    assert.ok(
      summary.stillBlocked <= data.initial_baseline.still_blocked_after_follow_up,
      `${filename} has more unrecovered follow-up cases than its initial baseline`,
    );
    assert.ok(summary.maxRoundsUsed <= (data.follow_up_round_limit || 3), `${filename} exceeded follow-up round limit`);
  }
});

test("hard-knownfail cohort is explicitly labeled as an improvement backlog", () => {
  const hardFixture = fixtures.find(({ data }) => data.tier === "hard-knownfail");
  assert.ok(hardFixture, "hard-knownfail fixture should exist");
  assert.equal(hardFixture.data.initial_baseline.failing_cases, 150);
  assert.equal(hardFixture.data.initial_baseline.error_rate, 1);
  assert.match(hardFixture.data.tier_role, /Known-failure improvement backlog/i);
});
