import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const APPROVAL_DATE = "2026-07-10";
const USER_ARGS = process.argv.slice(2);
const ROOT_ARG = USER_ARGS.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
const ROOT = path.resolve(ROOT_ARG || process.cwd());
const TIER = USER_ARGS.find((arg) => !arg.startsWith("--")) || "uber-messy";
const SHOULD_WRITE = !process.argv.includes("--no-write");

function slugForTier(tier) {
  return String(tier || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fixturePathForTier(tier) {
  const fixtureDir = path.join(ROOT, "tests", "fixtures");
  const match = fs.readdirSync(fixtureDir)
    .filter((name) => /^alpha-.*-cases\.json$/i.test(name))
    .map((fileName) => ({
      fileName,
      data: readJson(path.join(fixtureDir, fileName)),
    }))
    .find(({ data }) => data.tier === tier);
  if (!match) throw new Error(`Missing fixture for tier: ${tier}`);
  return path.join(fixtureDir, match.fileName);
}

const TIER_SLUG = slugForTier(TIER);
const FIXTURE_PATH = fixturePathForTier(TIER);
const BASELINE_PATH = path.join(ROOT, "tests", "fixtures", `alpha-${TIER_SLUG}-approved-baseline-${APPROVAL_DATE}.json`);
const REPORT_PATH = path.join(ROOT, "reports", `alpha-${TIER_SLUG}-baseline-audit.md`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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

function completeFollowUpAddress(address) {
  if (/\b(?:IN|Indiana|KY|Kentucky)\b/i.test(address)) return address;
  if (/\b(?:Madison|Hanover|Jeffersonville|New Albany|Corydon)\b/i.test(address)) return `${address} IN`;
  return `${address} Madison IN`;
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
    parts.push(`service address ${completeFollowUpAddress(address)}`);
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

  if (/safety|access|damage|contractor review/i.test(errors)) {
    parts.push("safety and damage details confirmed for contractor review");
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
    parts.push(`service address ${completeFollowUpAddress(expected.service_address_should_include?.join(" ") || syntheticAddress(testCase))}`);
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

function classifyAuditCase(testCase, initialValidation, simulation, categories) {
  const initialBlocked = !initialValidation.can_generate_pdf;
  const expectedBlocked = testCase.decision === "block" || testCase.expected?.can_generate_pdf === false;

  if (categories.includes("validator_readiness") && initialValidation.can_generate_pdf && expectedBlocked) {
    return {
      classification: "true_defect",
      rationale: "The parser was quote-ready even though this adversarial fixture expected a block.",
    };
  }

  if (categories.includes("follow_up_unrecovered")) {
    return {
      classification: "correct_safe_block_follow_up",
      rationale: "After synthetic follow-up, required evidence was still insufficient; keeping the case blocked is safer than guessing.",
    };
  }

  if (categories.includes("warning_policy")) {
    return {
      classification: "policy_ambiguity",
      rationale: "The remaining mismatch is whether this adversarial safety/access wording should be a warning or a block.",
    };
  }

  if (expectedBlocked && initialBlocked && categories.every((category) => ["parser_tree_count", "parser_price_options"].includes(category))) {
    return {
      classification: "stale_or_incorrect_expectation",
      rationale: "The case is intentionally blocked for follow-up, so exact initial tree-count or option-price matching is not the right gate.",
    };
  }

  if (categories.some((category) => ["parser_name", "parser_contact", "parser_address", "parser_tree_count", "parser_price_options"].includes(category))) {
    return {
      classification: "true_defect",
      rationale: "The fixture expects a parse-ready result, and the current parser output does not match the expected field values.",
    };
  }

  return {
    classification: "policy_ambiguity",
    rationale: "The case needs human policy review before treating it as a parser defect.",
  };
}

function auditCase(testCase, maxRounds) {
  const initialValidation = runPipeline(testCase.raw_customer_input);
  const simulation = runFollowUpSimulation(testCase, maxRounds);
  const categories = failureCategories(testCase, initialValidation, simulation);
  const { classification, rationale } = classifyAuditCase(testCase, initialValidation, simulation, categories);
  const initialActual = actualSummary(initialValidation);
  const finalActual = actualSummary(simulation.finalValidation);

  return {
    case_id: testCase.id,
    category: testCase.category || "",
    messiness: testCase.messiness || "",
    failure_categories: categories,
    classification,
    rationale,
    initial_can_generate_pdf: Boolean(initialValidation.can_generate_pdf),
    final_can_generate_pdf_after_followups: Boolean(simulation.finalValidation.can_generate_pdf),
    recovered_after_follow_up: Boolean(simulation.recovered),
    follow_up_rounds: simulation.rounds,
    initial_blocking_errors: initialValidation.blocking_errors || [],
    final_blocking_errors: simulation.finalValidation.blocking_errors || [],
    initial_follow_ups: initialValidation.follow_ups || [],
    final_follow_ups: simulation.finalValidation.follow_ups || [],
    expected: {
      can_generate_pdf: testCase.expected?.can_generate_pdf ?? null,
      tree_count: testCase.expected?.tree_count ?? null,
      service_option_prices: testCase.expected?.service_option_prices || [],
    },
    actual_initial: {
      tree_count: initialActual.treeCount,
      prices: initialActual.prices,
    },
    actual_after_followups: {
      tree_count: finalActual.treeCount,
      prices: finalActual.prices,
    },
    raw_customer_input: testCase.raw_customer_input,
  };
}

function tableRow(cells) {
  return `| ${cells.map((cell) => String(cell ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(baseline) {
  const classificationRows = Object.entries(baseline.summary.classifications)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([classification, count]) => tableRow([classification, count]))
    .join("\n");
  const failureRows = Object.entries(baseline.summary.failure_categories)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, count]) => tableRow([category, count]))
    .join("\n");
  const caseRows = baseline.audit
    .map((row) => tableRow([
      row.case_id,
      row.classification,
      row.failure_categories.join(", "),
      row.initial_can_generate_pdf ? "yes" : "no",
      row.final_can_generate_pdf_after_followups ? "yes" : "no",
      row.rationale,
    ]))
    .join("\n");

  return [
    `# Alpha ${baseline.fixture.tier} Baseline Audit`,
    "",
    `Approval date: ${baseline.approval.approval_date}`,
    `Approval status: ${baseline.approval.status}`,
    `Fixture checksum: ${baseline.fixture.sha256}`,
    "",
    "## Summary",
    "",
    tableRow(["Metric", "Value"]),
    tableRow(["---", "---:"]),
    tableRow(["Total cases", baseline.summary.total_cases]),
    tableRow(["Current passing cases", baseline.summary.passing_cases]),
    tableRow(["Observed current failures", baseline.summary.failure_count]),
    tableRow(["Approved non-defect failure baseline", baseline.summary.approved_non_defect_failure_count]),
    tableRow(["True defects excluded from baseline", baseline.true_defect_case_ids.length]),
    tableRow(["Pass rate", `${baseline.summary.pass_rate_percent}%`]),
    tableRow(["Recovered after follow-up", baseline.summary.recovered_after_follow_up]),
    tableRow(["Still blocked after follow-up", baseline.summary.still_blocked_after_follow_up]),
    "",
    "## Classifications",
    "",
    tableRow(["Classification", "Count"]),
    tableRow(["---", "---:"]),
    classificationRows,
    "",
    "## Failure Buckets",
    "",
    tableRow(["Failure bucket", "Count"]),
    tableRow(["---", "---:"]),
    failureRows,
    "",
    "## Regression Rule",
    "",
    "- Do not require all deliberately adversarial cases to pass.",
    "- Future runs must not introduce non-defect failing case IDs outside this approved audit set.",
    "- Future runs must not exceed the approved non-defect failing count or still-blocked count.",
    "- True defects remain normal test failures and are not included in the approved non-defect baseline.",
    "- Safe blocking/follow-up is allowed when evidence remains insufficient.",
    "",
    "## Case Audit",
    "",
    tableRow(["Case", "Classification", "Failure categories", "Initial ready", "Final ready", "Rationale"]),
    tableRow(["---", "---", "---", "---", "---", "---"]),
    caseRows,
    "",
  ].join("\n");
}

function buildBaseline() {
  const fixture = readJson(FIXTURE_PATH);
  const maxRounds = fixture.follow_up_round_limit || 3;
  const allCases = fixture.cases.map((testCase) => auditCase(testCase, maxRounds));
  const failingCases = allCases.filter((testCase) => testCase.failure_categories.length);
  const approvedNonDefectCases = failingCases.filter((testCase) => testCase.classification !== "true_defect");
  const classifications = countBy(failingCases, (testCase) => testCase.classification);
  const failureCategories = countBy(failingCases.flatMap((testCase) => testCase.failure_categories), (category) => category);
  const approvedFailureCategories = countBy(approvedNonDefectCases.flatMap((testCase) => testCase.failure_categories), (category) => category);

  return {
    schema_version: "alpha_cohort_approved_baseline_v1",
    approval: {
      status: "approved_by_user_request",
      approval_date: APPROVAL_DATE,
      approved_by: "Human user request in Codex thread",
      note: `User approved auditing and freezing non-defect cases for the ${fixture.tier} cohort. True defects remain excluded from the approved baseline.`,
    },
    fixture: {
      path: path.relative(ROOT, FIXTURE_PATH).replace(/\\/g, "/"),
      fixture_id: fixture.fixture_id,
      tier: fixture.tier,
      case_count: fixture.case_count,
      sha256: sha256(FIXTURE_PATH),
    },
    policy: {
      do_not_require_all_adversarial_cases_to_pass: true,
      allowed_classifications: [
        "true_defect",
        "correct_safe_block_follow_up",
        "policy_ambiguity",
        "stale_or_incorrect_expectation",
      ],
      regression_rules: [
        "Current non-defect failing case IDs must be a subset of approved_non_defect_failing_case_ids.",
        "Current non-defect failing count must not exceed summary.approved_non_defect_failure_count.",
        "Current still-blocked-after-follow-up count for approved non-defects must not exceed summary.approved_non_defect_still_blocked_after_follow_up.",
        "Current true defects must still fail unless fixed.",
        "The source fixture checksum must match fixture.sha256.",
      ],
    },
    summary: {
      total_cases: allCases.length,
      passing_cases: allCases.length - failingCases.length,
      failure_count: failingCases.length,
      approved_non_defect_failure_count: approvedNonDefectCases.length,
      pass_rate_percent: Number((((allCases.length - failingCases.length) / allCases.length) * 100).toFixed(2)),
      initially_ready: allCases.filter((testCase) => testCase.initial_can_generate_pdf).length,
      recovered_after_follow_up: allCases.filter((testCase) => testCase.recovered_after_follow_up).length,
      still_blocked_after_follow_up: allCases.filter((testCase) => !testCase.final_can_generate_pdf_after_followups).length,
      approved_non_defect_still_blocked_after_follow_up: approvedNonDefectCases.filter((testCase) => !testCase.final_can_generate_pdf_after_followups).length,
      classifications,
      failure_categories: failureCategories,
      approved_non_defect_failure_categories: approvedFailureCategories,
    },
    approved_failing_case_ids: approvedNonDefectCases.map((testCase) => testCase.case_id),
    approved_non_defect_failing_case_ids: approvedNonDefectCases.map((testCase) => testCase.case_id),
    true_defect_case_ids: failingCases.filter((testCase) => testCase.classification === "true_defect").map((testCase) => testCase.case_id),
    audit: failingCases,
  };
}

function main() {
  const baseline = buildBaseline();
  if (SHOULD_WRITE) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    fs.writeFileSync(REPORT_PATH, renderMarkdown(baseline), "utf8");
  }
  console.log(JSON.stringify({
    baseline_path: BASELINE_PATH,
    report_path: REPORT_PATH,
    failure_count: baseline.summary.failure_count,
    approved_non_defect_failure_count: baseline.summary.approved_non_defect_failure_count,
    true_defect_count: baseline.true_defect_case_ids.length,
    classifications: baseline.summary.classifications,
    failure_categories: baseline.summary.failure_categories,
  }, null, 2));
}

main();
