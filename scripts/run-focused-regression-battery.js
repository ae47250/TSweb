import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { buildCustomerJobSummary, normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const CASES = [
  {
    id: "full-address-jeffersonville-service-label",
    category: "full_address_city_state",
    objective: "Street plus Jeffersonville IN should stay in service address.",
    input:
      "Cara Mills 812-555-0103 cara@example.com. service address 83 River Ave Jeffersonville IN. option 1 remove only 1100. option 2 remove plus haila way and cleen up 2100. big tree by shed.",
    expected: {
      shouldBlock: false,
      addressIncludes: ["83 River Ave", "Jeffersonville", "IN"],
      noAddressCityStateWarning: true,
    },
  },
  {
    id: "full-address-corydon-remuved-at",
    category: "full_address_city_state",
    objective: "Street plus Corydon IN should not be reduced to street-only.",
    input:
      "Gina Price 812-555-0107 gina@example.com. needs walnut tree remuved at 707 Walnut Street Corydon IN. big tree by garage. option 1 cut only 1500. option 2 cut plus hual away and cleanup 9150.",
    expected: {
      shouldBlock: false,
      addressIncludes: ["707 Walnut Street", "Corydon", "IN"],
      noAddressCityStateWarning: true,
    },
  },
  {
    id: "full-address-new-albany-two-word-city",
    category: "full_address_city_state",
    objective: "Two-word city New Albany should stay attached to the address.",
    input:
      "Hank Bell 812-555-0108 hank@example.com. needs spruce tree remuved at 62 Roofline Rd New Albany IN. big tree by garage. option 1 drop only 1550. option 2 drop plus hall away and clean up 9175.",
    expected: {
      shouldBlock: false,
      addressIncludes: ["62 Roofline Rd", "New Albany", "IN"],
      noAddressCityStateWarning: true,
    },
  },
  {
    id: "incomplete-address-typed-street-only",
    category: "incomplete_address_blocking",
    objective: "Street-only address should not be quote-ready.",
    input:
      "Ella Knox 812-555-0105 ella@example.com. service address 148 mapel st. option 1 remove only 1220. option 2 remove plus haila way and cleen up 2280. big tree by shed.",
    expected: {
      shouldBlock: true,
      addressIncludes: ["148 maple st"],
      followUpsInclude: ["city", "state"],
    },
  },
  {
    id: "incomplete-intake-address-old-note-wrong-address",
    category: "incomplete_address_blocking",
    objective: "Typed intake wins over old note, but incomplete intake address should still block.",
    input:
      "Ella Knox 812-555-0105 ella@example.com. old note says 999 Wrong Way Hanover IN, but job is remove a pine tree by garage. option 1 cut only 1720. option 2 cut haul away 2620.",
    intake: { address: "148 mapel st" },
    expected: {
      shouldBlock: true,
      addressIncludes: ["148 maple st"],
      addressExcludes: ["999 Wrong Way", "Hanover"],
      followUpsInclude: ["city", "state"],
    },
  },
  {
    id: "option-package-and-cleanup-not-or",
    category: "option_scope_semantics",
    objective: "Bundled option scope with haul away and cleanup should not become 'or cleanup'.",
    input:
      "Drew Moss 812-555-0104 drew@example.com. 410 Spruce Ct Madison IN. needs big tree by garage removed. option 1 remove only 1400. option 2 remove plus haul away and cleanup 2800.",
    expected: {
      shouldBlock: false,
      addressIncludes: ["410 Spruce Ct", "Madison", "IN"],
      optionDescriptionsInclude: ["haul away", "cleanup"],
      summaryMustNotMatch: ["haul away or cleanup"],
    },
  },
  {
    id: "uncertain-prices-evidence-not-final",
    category: "uncertain_price_evidence",
    objective: "Non-firm prices should block and not populate final-looking price displays.",
    input:
      "Ivy Stone 812-555-0109 ivy@example.com. 220 Oak Lane Madison IN. remove a maple tree by garage. option 1 around 1700. option 2 cleanup maybe 2900.",
    expected: {
      shouldBlock: true,
      blockingIncludes: ["Price is not firm"],
      finalPricesEmpty: true,
      followUpsInclude: ["firm", "price"],
    },
  },
  {
    id: "fallen-tree-singular-count-one",
    category: "fallen_tree_counting",
    objective: "Singular fallen tree should count as one tree.",
    input:
      "Ava Reed 812-555-0101 ava@example.com. 410 Spruce Ct Madison IN. remove fallen tree by driveway. option 1 remove only 1200.",
    expected: {
      shouldBlock: false,
      treeCount: "1 tree",
      summaryIncludes: ["one", "tree"],
    },
  },
  {
    id: "fallen-trees-plural-count-unclear",
    category: "fallen_tree_counting",
    objective: "Plural fallen trees should ask for count unless an exact count is given.",
    input:
      "Ava Reed 812-555-0101 ava@example.com. 410 Spruce Ct Madison IN. remove fallen trees by driveway. option 1 remove only 1200.",
    expected: {
      shouldBlock: true,
      followUpsInclude: ["how many"],
    },
  },
  {
    id: "species-and-count-two",
    category: "species_conjunctions",
    objective: "Oak and maple means two trees.",
    input:
      "Ava Reed 812-555-0101 ava@example.com. 410 Spruce Ct Madison IN. remove oak and maple by garage. option 1 remove only 1200.",
    expected: {
      shouldBlock: false,
      treeCount: "2 trees",
      treeTypeIncludes: ["oak", "maple"],
    },
  },
  {
    id: "species-or-count-one-uncertain-species",
    category: "species_conjunctions",
    objective: "Oak or maple means one tree with uncertain species, not two trees.",
    input:
      "Ava Reed 812-555-0101 ava@example.com. 410 Spruce Ct Madison IN. remove oak or maple by garage. option 1 remove only 1200.",
    expected: {
      shouldBlock: false,
      treeCount: "1 tree",
      treeTypeIncludes: ["oak", "maple"],
    },
  },
  {
    id: "couple-trees-count-ambiguous",
    category: "ambiguous_count_terms",
    objective: "Couple trees should block unless we explicitly decide couple means two.",
    input:
      "Ben Clay 812-555-0102 ben@example.com. 410 Spruce Ct Madison IN. remove couple trees by garage. option 1 remove only 1700.",
    expected: {
      shouldBlock: true,
      followUpsInclude: ["how many"],
    },
  },
  {
    id: "few-trees-count-ambiguous",
    category: "ambiguous_count_terms",
    objective: "Few trees should block as vague count.",
    input:
      "Ben Clay 812-555-0102 ben@example.com. 410 Spruce Ct Madison IN. remove a few trees by garage. option 1 remove only 1700.",
    expected: {
      shouldBlock: true,
      followUpsInclude: ["how many"],
    },
  },
  {
    id: "current-address-wins-over-old-note",
    category: "source_priority",
    objective: "Current service address should beat old/wrong note address and keep city/state.",
    input:
      "Ava Reed 812-555-0101 ava@example.com. old note says 999 Wrong Way Hanover IN. current service address 410 Spruce Ct Madison IN. remove one maple by garage. option 1 remove only 1200.",
    expected: {
      shouldBlock: false,
      addressIncludes: ["410 Spruce Ct", "Madison", "IN"],
      addressExcludes: ["999 Wrong Way", "Hanover"],
    },
  },
];

function timestampParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    now,
    stamp: `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`,
    eastern: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now),
  };
}

function gitValue(args, fallback = "") {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function textIncludesAll(text, values = []) {
  const normalized = String(text || "").toLowerCase();
  return values.every((value) => normalized.includes(String(value).toLowerCase()));
}

function textExcludesAll(text, values = []) {
  const normalized = String(text || "").toLowerCase();
  return values.every((value) => !normalized.includes(String(value).toLowerCase()));
}

function optionText(alphaJson) {
  return (alphaJson.service_options?.items || [])
    .map((option) => [option.title, option.description].filter(Boolean).join(" "))
    .join(" ");
}

function priceDisplays(alphaJson) {
  return (alphaJson.service_options?.items || []).map((option) => option.price?.display).filter(Boolean);
}

function evaluate(testCase) {
  const alphaJson = normalizeToAlphaJsonV14({}, testCase.input, testCase.intake || {});
  const validation = validateAlphaJson(alphaJson);
  const finalAlphaJson = validation.alphaJson || alphaJson;
  const td2JobSummary = buildCustomerJobSummary(finalAlphaJson);
  const combinedFollowUpText = `${validation.blocking_errors.join(" ")} ${validation.follow_ups.join(" ")}`;
  const address = finalAlphaJson.job?.service_address?.display || "";
  const treeCount = finalAlphaJson.job?.tree_details?.tree_count || "";
  const treeType = finalAlphaJson.job?.tree_details?.tree_type || "";
  const prices = priceDisplays(finalAlphaJson);
  const options = optionText(finalAlphaJson);
  const failures = [];
  const expected = testCase.expected || {};

  if (expected.shouldBlock === true && validation.can_generate_pdf) {
    failures.push({
      code: "unexpected_ready",
      message: "Expected PDF generation to block, but it was allowed.",
    });
  }
  if (expected.shouldBlock === false && !validation.can_generate_pdf) {
    failures.push({
      code: "unexpected_block",
      message: `Expected quote-ready, but blocked: ${validation.blocking_errors.join("; ")}`,
    });
  }
  if (expected.addressIncludes?.length && !textIncludesAll(address, expected.addressIncludes)) {
    failures.push({
      code: "address_missing_component",
      message: `Address ${JSON.stringify(address)} did not include ${expected.addressIncludes.join(", ")}.`,
    });
  }
  if (expected.addressExcludes?.length && !textExcludesAll(address, expected.addressExcludes)) {
    failures.push({
      code: "address_wrong_source",
      message: `Address ${JSON.stringify(address)} included excluded source text ${expected.addressExcludes.join(", ")}.`,
    });
  }
  if (expected.noAddressCityStateWarning && validation.warnings.some((warning) => /Service address may need city or state/i.test(warning))) {
    failures.push({
      code: "unexpected_address_city_state_warning",
      message: "Address city/state warning appeared for an input that should contain complete city/state.",
    });
  }
  if (expected.followUpsInclude?.length && !textIncludesAll(combinedFollowUpText, expected.followUpsInclude)) {
    failures.push({
      code: "followup_missing",
      message: `Follow-up text did not include ${expected.followUpsInclude.join(", ")}.`,
    });
  }
  if (expected.blockingIncludes?.length && !textIncludesAll(validation.blocking_errors.join(" "), expected.blockingIncludes)) {
    failures.push({
      code: "blocking_reason_missing",
      message: `Blocking reasons did not include ${expected.blockingIncludes.join(", ")}.`,
    });
  }
  if (expected.treeCount && treeCount !== expected.treeCount) {
    failures.push({
      code: "tree_count_wrong",
      message: `Tree count was ${JSON.stringify(treeCount)}, expected ${expected.treeCount}.`,
    });
  }
  if (expected.treeTypeIncludes?.length && !textIncludesAll(treeType, expected.treeTypeIncludes)) {
    failures.push({
      code: "tree_type_missing_component",
      message: `Tree type was ${JSON.stringify(treeType)}, expected ${expected.treeTypeIncludes.join(", ")}.`,
    });
  }
  if (expected.optionDescriptionsInclude?.length && !textIncludesAll(options, expected.optionDescriptionsInclude)) {
    failures.push({
      code: "option_scope_missing_component",
      message: `Option text did not include ${expected.optionDescriptionsInclude.join(", ")}.`,
    });
  }
  for (const pattern of expected.summaryMustNotMatch || []) {
    if (new RegExp(pattern, "i").test(td2JobSummary)) {
      failures.push({
        code: "summary_misleading_option_scope",
        message: `TD2 summary matched forbidden wording ${JSON.stringify(pattern)}.`,
      });
    }
  }
  if (expected.summaryIncludes?.length && !textIncludesAll(td2JobSummary, expected.summaryIncludes)) {
    failures.push({
      code: "summary_missing_component",
      message: `TD2 summary did not include ${expected.summaryIncludes.join(", ")}.`,
    });
  }
  if (expected.finalPricesEmpty && prices.length > 0) {
    failures.push({
      code: "uncertain_price_finalized",
      message: `Expected no final price displays for uncertain prices; got ${prices.join(", ")}.`,
    });
  }

  return {
    ...testCase,
    pass: failures.length === 0,
    failures,
    actual: {
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors,
      follow_ups: validation.follow_ups,
      warnings: validation.warnings,
      service_address: address,
      tree_count: treeCount,
      tree_type: treeType,
      prices,
      option_descriptions: (finalAlphaJson.service_options?.items || []).map((option) => option.description || ""),
      td2_job_summary: td2JobSummary,
      job_description: finalAlphaJson.job?.description || "",
      corrected_interpretation: finalAlphaJson.normalization?.corrected_interpretation || "",
    },
  };
}

function summarize(results) {
  const byCategory = {};
  const byFailure = {};

  for (const result of results) {
    const category = result.category || "uncategorized";
    byCategory[category] ||= { total: 0, passing: 0, failing: 0 };
    byCategory[category].total += 1;
    if (result.pass) {
      byCategory[category].passing += 1;
    } else {
      byCategory[category].failing += 1;
    }
    for (const failure of result.failures) {
      byFailure[failure.code] = (byFailure[failure.code] || 0) + 1;
    }
  }

  return {
    total: results.length,
    passing: results.filter((result) => result.pass).length,
    failing: results.filter((result) => !result.pass).length,
    byCategory,
    byFailure,
  };
}

function markdownReport(run) {
  const lines = [];
  lines.push("# Focused Regression Battery - Latest Baseline");
  lines.push("");
  lines.push(`Generated Eastern: ${run.metadata.timestampEastern}`);
  lines.push(`Generated UTC: ${run.metadata.timestampUtc}`);
  lines.push(`Commit: ${run.metadata.commit}`);
  lines.push(`Branch: ${run.metadata.branch}`);
  lines.push(`Dirty files: ${run.metadata.dirtyFiles.length}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Total | Passing | Failing |");
  lines.push("|---:|---:|---:|");
  lines.push(`| ${run.summary.total} | ${run.summary.passing} | ${run.summary.failing} |`);
  lines.push("");
  lines.push("## Category Results");
  lines.push("");
  lines.push("| Category | Total | Passing | Failing |");
  lines.push("|---|---:|---:|---:|");
  for (const [category, stats] of Object.entries(run.summary.byCategory)) {
    lines.push(`| ${category} | ${stats.total} | ${stats.passing} | ${stats.failing} |`);
  }
  lines.push("");
  lines.push("## Failure Buckets");
  lines.push("");
  if (Object.keys(run.summary.byFailure).length) {
    lines.push("| Failure code | Count |");
    lines.push("|---|---:|");
    for (const [code, count] of Object.entries(run.summary.byFailure).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${code} | ${count} |`);
    }
  } else {
    lines.push("No failures.");
  }
  lines.push("");
  lines.push("## Case Details");
  lines.push("");
  lines.push("| Case | Category | Result | Main failures | Address | Tree count/type | Prices | TD2 summary |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const result of run.results) {
    const failureText = result.failures.map((failure) => failure.code).join(", ") || "none";
    const treeText = [result.actual.tree_count, result.actual.tree_type].filter(Boolean).join(" / ");
    lines.push(
      `| ${result.id} | ${result.category} | ${result.pass ? "PASS" : "FAIL"} | ${failureText} | ${result.actual.service_address.replace(/\|/g, "\\|")} | ${treeText.replace(/\|/g, "\\|")} | ${result.actual.prices.join(", ") || "none"} | ${result.actual.td2_job_summary.replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push("");
  lines.push("## Data Captured For Future Analysis");
  lines.push("");
  lines.push("- Input text, intake fields, expected behavior, actual validation state, address, tree count/type, prices, options, TD2 summary, job description, corrected interpretation, commit, branch, timestamp, and dirty file count are stored in the JSONL history.");
  lines.push("- This battery intentionally records desired future behavior, so failing cases are baseline evidence before parser/validation changes.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const { now, stamp, eastern } = timestampParts();
const results = CASES.map(evaluate);
const run = {
  metadata: {
    id: `focused-regression-${stamp}`,
    timestampUtc: now.toISOString(),
    timestampEastern: eastern,
    commit: gitValue(["rev-parse", "HEAD"], "unknown"),
    branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"], "unknown"),
    dirtyFiles: gitValue(["status", "--short"], "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  },
  summary: summarize(results),
  results,
};

fs.mkdirSync("reports", { recursive: true });
fs.appendFileSync("reports/focused-regression-battery-history.jsonl", `${JSON.stringify(run)}\n`);
fs.writeFileSync("reports/focused-regression-battery-latest.md", markdownReport(run));

console.log(`Focused regression battery: ${run.summary.passing}/${run.summary.total} passing, ${run.summary.failing} failing`);
console.log(`Report: reports/focused-regression-battery-latest.md`);
console.log(`History: reports/focused-regression-battery-history.jsonl`);
