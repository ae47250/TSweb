#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveCustomerPipeline } from "../lib/customerPipeline.js";

const POLICY_PATH = "config/customer-pipeline-release-policy.json";
const FIXTURE_DIR = "tests/fixtures";
const REPORT_PATH = "reports/customer-pipeline-stress-gate-report.json";
const REQUIRED_COHORT_COUNT = 7;
const REQUIRED_CASES_PER_COHORT = 150;
const REQUIRED_FALSE_BLOCK_DENOMINATOR = 600;
const REQUIRED_MAXIMUM_FALSE_BLOCKS = 6;
const REQUIRED_MAXIMUM_UNSAFE_READY = 0;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    throw new Error(`Unable to read valid JSON from ${path}: ${error.message}`);
  }
}

function validateProductionStressPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error(`${POLICY_PATH} must contain a JSON object`);
  }
  const stress = policy.production_stress;
  if (!stress || typeof stress !== "object" || Array.isArray(stress)) {
    throw new Error(`${POLICY_PATH} is missing the production_stress object`);
  }
  if (stress.expected_ready_key !== "can_generate_pdf") {
    throw new Error(`${POLICY_PATH} production_stress.expected_ready_key must be can_generate_pdf`);
  }
  if (!Array.isArray(stress.false_block_denominator_tiers) ||
      stress.false_block_denominator_tiers.length === 0 ||
      stress.false_block_denominator_tiers.some((tier) => typeof tier !== "string" || !tier.trim())) {
    throw new Error(`${POLICY_PATH} production_stress.false_block_denominator_tiers must be a non-empty string array`);
  }
  if (!Number.isInteger(stress.maximum_false_blocks_600) ||
      stress.maximum_false_blocks_600 < 0 ||
      stress.maximum_false_blocks_600 > REQUIRED_MAXIMUM_FALSE_BLOCKS) {
    throw new Error(`${POLICY_PATH} production_stress.maximum_false_blocks_600 must be an integer from 0 through ${REQUIRED_MAXIMUM_FALSE_BLOCKS}`);
  }
  if (stress.maximum_unsafe_ready !== REQUIRED_MAXIMUM_UNSAFE_READY) {
    throw new Error(`${POLICY_PATH} production_stress.maximum_unsafe_ready must be ${REQUIRED_MAXIMUM_UNSAFE_READY} for the production policy`);
  }
  return stress;
}

function productionResolutionEnv() {
  return {
    TSWEB_DEPLOYMENT_STAGE: "production",
    CUSTOMER_DELIVERY_ENABLED: "true",
    CUSTOMER_RESOLUTION_ROLLOUT: "full",
    CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
    CUSTOMER_ASSEMBLER_ROLLOUT: "off",
    CUSTOMER_ASSEMBLER_RELEASE_APPROVED: "false",
    ENABLE_READINESS_SAFETY_BLOCKING: "true",
    CUSTOMER_PIPELINE_TELEMETRY: "false",
  };
}

function fixtureFiles() {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => /^alpha-.*-cases\.json$/i.test(name))
    .sort();
}

function evaluateFixture(filename, expectedReadyKey, env) {
  const fixture = readJson(`${FIXTURE_DIR}/${filename}`);
  const cases = fixture.cases || [];
  const results = cases.map((row) => {
    const pipeline = resolveCustomerPipeline({
      alphaJson: {},
      customer_text: row.raw_customer_input,
    }, {
      documentId: row.id,
      env,
      telemetry: false,
    });
    const expectedReady = row.expected?.[expectedReadyKey];
    const ready = pipeline?.validation?.can_generate_pdf === true;
    return {
      id: row.id,
      expected_ready: expectedReady,
      ready,
      unsafe_ready: expectedReady === false && ready,
      false_block: expectedReady === true && !ready,
      parity_classification: pipeline?.parity?.classification || "not_evaluated",
    };
  });
  return {
    tier: fixture.tier,
    case_count: results.length,
    ready_count: results.filter((row) => row.ready).length,
    unsafe_ready_count: results.filter((row) => row.unsafe_ready).length,
    unsafe_ready_case_ids: results.filter((row) => row.unsafe_ready).map((row) => row.id),
    false_block_count: results.filter((row) => row.false_block).length,
    false_block_case_ids: results.filter((row) => row.false_block).map((row) => row.id),
    unexpected_parity_count: results.filter((row) => row.parity_classification === "unexpected_difference").length,
  };
}

function main() {
  const check = process.argv.includes("--check");
  const policy = readJson(POLICY_PATH);
  const stress = validateProductionStressPolicy(policy);
  const expectedReadyKey = stress.expected_ready_key || "can_generate_pdf";
  const cohorts = fixtureFiles().map((filename) => evaluateFixture(filename, expectedReadyKey, productionResolutionEnv()));
  const denominatorTiers = new Set(stress.false_block_denominator_tiers || []);
  const denominatorCohorts = cohorts.filter((cohort) => denominatorTiers.has(cohort.tier));
  const falseBlockDenominator = denominatorCohorts.reduce((sum, cohort) => sum + cohort.case_count, 0);
  const falseBlocks = denominatorCohorts.reduce((sum, cohort) => sum + cohort.false_block_count, 0);
  const unsafeReady = cohorts.reduce((sum, cohort) => sum + cohort.unsafe_ready_count, 0);
  const failures = [];
  if (cohorts.length !== REQUIRED_COHORT_COUNT || cohorts.some((cohort) => cohort.case_count !== REQUIRED_CASES_PER_COHORT)) {
    failures.push(`the production stress set must contain ${REQUIRED_COHORT_COUNT} complete ${REQUIRED_CASES_PER_COHORT}-case cohorts`);
  }
  if (falseBlockDenominator !== REQUIRED_FALSE_BLOCK_DENOMINATOR) {
    failures.push(`false-block denominator is ${falseBlockDenominator}, expected ${REQUIRED_FALSE_BLOCK_DENOMINATOR}`);
  }
  if (falseBlocks > Number(stress.maximum_false_blocks_600)) {
    failures.push(`production resolution false blocks are ${falseBlocks}/600, maximum ${stress.maximum_false_blocks_600}`);
  }
  if (unsafeReady > Number(stress.maximum_unsafe_ready)) {
    failures.push(`production resolution unsafe-ready cases are ${unsafeReady}, maximum ${stress.maximum_unsafe_ready}`);
  }
  const report = {
    report_version: "customer-pipeline-stress-gate-report-v2",
    generated_at: new Date().toISOString(),
    status: failures.length ? "FAIL" : "PASS",
    active_pipeline: "resolution",
    readiness_blocking_enabled: true,
    cohort_count: cohorts.length,
    case_count: cohorts.reduce((sum, cohort) => sum + cohort.case_count, 0),
    false_block_denominator: falseBlockDenominator,
    false_block_count: falseBlocks,
    unsafe_ready_count: unsafeReady,
    cohorts,
    failures,
  };
  if (!check) writeFileSync(resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Production resolution stress release gate: ${report.status}`);
  console.log(`  Unsafe ready: ${unsafeReady}`);
  console.log(`  600-case false blocks: ${falseBlocks}/${falseBlockDenominator}`);
  for (const cohort of cohorts) {
    console.log(`  ${cohort.tier}: unsafe=${cohort.unsafe_ready_count}, false_blocks=${cohort.false_block_count}`);
  }
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  if (failures.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Production resolution stress release gate failed closed: ${error?.stack || error}`);
  process.exitCode = 1;
}
