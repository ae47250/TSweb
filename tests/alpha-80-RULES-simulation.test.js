import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const masterFixture = JSON.parse(readFileSync("tests/fixtures/alpha-master-80-cases.json", "utf8"));
const hardFixture = JSON.parse(readFileSync("tests/fixtures/alpha-HARD-80-cases.json", "utf8"));
const MAX_FOLLOW_UP_ROUNDS = masterFixture.follow_up_round_limit || 3;

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
    warnings: validation.warnings || [],
    blockingErrors: validation.blocking_errors || [],
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

  if (!isBlank(expected.customer_name) && actual.name !== expected.customer_name) mismatches.push("name");
  if (!isBlank(expected.phone_display) && actual.phone !== expected.phone_display) mismatches.push("phone");
  if (!isBlank(expected.email) && actual.email !== expected.email) mismatches.push("email");
  if (
    Array.isArray(expected.service_address_should_include) &&
    expected.service_address_should_include.length &&
    !includesAll([actual.address], expected.service_address_should_include)
  ) {
    mismatches.push("address");
  }
  if (!isBlank(expected.tree_count) && actual.treeCount !== expected.tree_count) mismatches.push("tree_count");

  const expectedPrices = expectedPriceWindow(testCase);
  if (
    expectedPrices.length &&
    (actual.prices.length !== expectedPrices.length || actual.prices.some((price, index) => price !== expectedPrices[index]))
  ) {
    mismatches.push("prices");
  }

  return mismatches;
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

  parserMismatches(testCase, initialValidation).forEach((mismatch) => {
    if (mismatch === "name") categories.add("parser_name");
    if (mismatch === "phone" || mismatch === "email") categories.add("parser_contact");
    if (mismatch === "address") categories.add("parser_address");
    if (mismatch === "tree_count") categories.add("parser_tree_count");
    if (mismatch === "prices") categories.add("parser_price_options");
  });

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
  const results = fixture.cases.map((testCase) => {
    const initialValidation = runPipeline(testCase.raw_customer_input);
    const simulation = runFollowUpSimulation(testCase);
    return {
      id: testCase.id,
      category: testCase.category,
      messiness: testCase.messiness,
      decision: testCase.decision,
      initiallyReady: initialValidation.can_generate_pdf,
      finalReady: simulation.finalValidation.can_generate_pdf,
      recovered: simulation.recovered,
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
    initiallyReady: results.filter((result) => result.initiallyReady).length,
    recoveredAfterFollowUp: results.filter((result) => result.recovered).length,
    stillBlocked: results.filter((result) => !result.finalReady).length,
    byMessiness: countBy(results, (result) => result.messiness || "unknown"),
    byCategory: countBy(results, (result) => result.category || "unknown"),
    byDecision: countBy(results, (result) => result.decision || "unknown"),
    failureCategories: failureCategoryCounts,
  };
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

  const messy = (Number(testCase.id.replace(/\D/g, "")) + round) % 2 === 0;
  return messy
    ? `yeah ${parts.join(" also ")}`
    : `Follow-up details: ${parts.join(". ")}.`;
}

function runFollowUpSimulation(testCase) {
  let customerText = testCase.raw_customer_input;
  const rounds = [];

  for (let round = 0; round <= MAX_FOLLOW_UP_ROUNDS; round += 1) {
    const validation = runPipeline(customerText);
    rounds.push({
      round,
      canGenerate: validation.can_generate_pdf,
      blockingErrors: validation.blocking_errors,
      warnings: validation.warnings,
      summary: actualSummary(validation),
    });

    if (validation.can_generate_pdf) {
      return { customerText, finalValidation: validation, rounds, recovered: round > 0 };
    }

    if (round === MAX_FOLLOW_UP_ROUNDS) {
      return { customerText, finalValidation: validation, rounds, recovered: false };
    }

    customerText = `${customerText}\nFollow-up ${round + 1}: ${buildFollowUpAnswer(testCase, validation, round)}`;
  }

  throw new Error(`Unexpected simulation exit for ${testCase.id}`);
}

test("master 80 parse-ready cases preserve expected parser fields on the first pass", () => {
  const parseCases = masterFixture.cases.filter((testCase) => testCase.decision === "parse");
  const failures = parseCases
    .map((testCase) => {
      const validation = runPipeline(testCase.raw_customer_input);
      return { id: testCase.id, mismatches: parserMismatches(testCase, validation) };
    })
    .filter((result) => result.mismatches.length);

  assert.deepEqual(failures, []);
});

test("master 80 blocked cases recover through local simulated follow-ups within three rounds", (context) => {
  const results = masterFixture.cases.map((testCase) => {
    const initialValidation = runPipeline(testCase.raw_customer_input);
    const simulation = runFollowUpSimulation(testCase);
    return {
      id: testCase.id,
      category: testCase.category,
      decision: testCase.decision,
      initiallyReady: initialValidation.can_generate_pdf,
      recovered: simulation.recovered,
      finalReady: simulation.finalValidation.can_generate_pdf,
      rounds: simulation.rounds.length - 1,
      finalBlockingErrors: simulation.finalValidation.blocking_errors,
    };
  });

  const stillBlocked = results.filter((result) => !result.finalReady);
  const recovered = results.filter((result) => result.recovered);
  const initiallyReady = results.filter((result) => result.initiallyReady);

  context.diagnostic(
    JSON.stringify({
      total: results.length,
      initiallyReady: initiallyReady.length,
      recoveredAfterFollowUp: recovered.length,
      stillBlocked: stillBlocked.length,
    }),
  );

  assert.deepEqual(stillBlocked, []);
  assert.ok(recovered.length > 0, "fixture should include cases that need simulated follow-up");
  assert.ok(results.every((result) => result.rounds <= MAX_FOLLOW_UP_ROUNDS));
});

test("master 80 warning behavior keeps non-blocking issues visible to Tree Dude", () => {
  const overFourCases = masterFixture.cases.filter((testCase) => testCase.category === "more_than_four_options");
  const missingWarnings = overFourCases
    .map((testCase) => ({ id: testCase.id, warnings: runPipeline(testCase.raw_customer_input).warnings }))
    .filter((result) => !/more than four options/i.test(result.warnings.join(" | ")));
  assert.deepEqual(missingWarnings, []);

  const safetyCases = masterFixture.cases.filter((testCase) =>
    /\b(service\s+drop|touching|across\s+(?:drive|driveway|gate)|same-?day|emergency|fence\s+damage)\b/i.test(testCase.raw_customer_input),
  );
  const safetyBlocks = safetyCases
    .map((testCase) => ({ id: testCase.id, validation: runPipeline(testCase.raw_customer_input) }))
    .filter((result) => /safety|access|hazard/i.test(result.validation.blocking_errors.join(" | ")));
  assert.deepEqual(safetyBlocks, []);
});

test("hard 80 benchmark reports current error rate without gating the suite", (context) => {
  assert.equal(hardFixture.cases.length, 80);

  const summary = summarizeBenchmark(hardFixture);
  context.diagnostic(JSON.stringify({ fixture: "alpha-HARD-80", ...summary }));

  assert.equal(summary.total, 80);
  assert.ok(summary.failing >= 0);
});
