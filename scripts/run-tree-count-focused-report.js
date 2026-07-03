import fs from "node:fs";
import path from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures");
const REPORT_DIR = path.join(process.cwd(), "reports");

const SPECIES = "(?:pine|oak|maple|elm|ash|cedar|sycamore|hickory|locust|birch|spruce|walnut|cherry|pear|gum)";
const TREE_COUNT_WORDS = "(?:one|two|three|four|five|six|seven|eight|nine|ten)";
const TREE_COUNT_REGEX = new RegExp(`\\b(?:\\d+|${TREE_COUNT_WORDS}|on)\\s+(?:tree|trees|${SPECIES}s?)\\b`, "i");
const SPECIES_PAIR_REGEX = new RegExp(`\\b${SPECIES}s?\\b\\s+(?:and|or)\\s+\\b${SPECIES}s?\\b`, "i");

const probeCases = [
  {
    id: "probe-on-tree-cedar-oak",
    raw_customer_input: "Caller says on tree and cedar and oak 1500 removal only",
    expected: { tree_count: "", tree_type: "cedar and oak", should_block_tree_count: true },
  },
  {
    id: "probe-one-tree-cedar-oak",
    raw_customer_input: "Caller says one tree cedar and oak 1500 removal only",
    expected: { tree_count: "", tree_type: "cedar and oak", should_block_tree_count: true },
  },
  {
    id: "probe-three-trees-cedar-oak",
    raw_customer_input: "Caller says three trees cedar and oak 1500 removal only",
    expected: { tree_count: "", tree_type: "cedar and oak", should_block_tree_count: true },
  },
  {
    id: "probe-two-trees-cedar-oak",
    raw_customer_input: "Caller says two trees cedar and oak 1500 removal only",
    expected: { tree_count: "2 trees", tree_type: "cedar and oak", should_block_tree_count: false },
  },
  {
    id: "probe-address-walnut-street",
    raw_customer_input: "Cara Mills 812-555-0103 cara@example.com. 2970 Walnut St Madison Indiana. Remove oak and maple near power line. Option A remove trees $2,400.",
    expected: { tree_count: "2 trees", tree_type: "oak and maple", should_block_tree_count: false },
  },
  {
    id: "probe-oak-or-maple",
    raw_customer_input: "Cara Mills 812-555-0103 cara@example.com. 2970 Walnut St Madison Indiana. Remove oak or maple near power line. Option A remove tree $2,400.",
    expected: { tree_count: "1 tree", tree_type: "oak or maple", should_block_tree_count: false },
  },
];

function timestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`;
}

function fixtureFiles() {
  return fs.readdirSync(FIXTURE_DIR)
    .filter((name) => name.startsWith("alpha-") && name.endsWith(".json"))
    .map((name) => path.join(FIXTURE_DIR, name));
}

function expectedTreeCount(item) {
  return item.expected?.tree_count || item.expected?.treeCount || "";
}

function selectFixtureCase(item) {
  const raw = item.raw_customer_input || item.raw_input || "";
  const category = item.category || item.fixture_category || "";
  const tags = [
    ...(item.fault_tags || []),
    ...(item.current_failure_categories || []),
    ...(item.initial_failure_categories || []),
  ].join(" ");

  return Boolean(
    expectedTreeCount(item) ||
      /tree_counts|tree_count_tree_detail/i.test(category) ||
      /tree_count|parser_tree_count/i.test(tags) ||
      (TREE_COUNT_REGEX.test(raw) && /tree/i.test(raw)) ||
      SPECIES_PAIR_REGEX.test(raw),
  );
}

function loadFixtureCases() {
  const cases = [];
  for (const filePath of fixtureFiles()) {
    const fixture = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const item of fixture.cases || []) {
      if (!selectFixtureCase(item)) continue;
      cases.push({
        source: path.basename(filePath),
        id: item.id || item.case_id,
        raw_customer_input: item.raw_customer_input || item.raw_input || "",
        expected: item.expected || {},
        category: item.category || "",
        current_initial_can_generate_pdf: item.current_initial_can_generate_pdf,
      });
    }
  }
  return cases;
}

function hasTreeCountBlocker(validation) {
  return [...(validation.blocking_errors || []), ...(validation.follow_ups || []), ...(validation.structured_follow_ups || [])]
    .map((item) => typeof item === "string" ? item : `${item.id || ""} ${item.message || ""} ${item.field || ""}`)
    .join(" ")
    .match(/tree count|how many trees|vague_tree_count|missing_tree_count/i);
}

function runCase(item, source) {
  const raw = item.raw_customer_input || "";
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, raw));
  const alphaJson = validation.alphaJson;
  const actualCount = alphaJson.job?.tree_details?.tree_count || "";
  const actualType = alphaJson.job?.tree_details?.tree_type || "";
  const expectedCount = expectedTreeCount(item);
  const expectedType = item.expected?.tree_type || item.expected?.treeType || "";
  const treeBlocker = Boolean(hasTreeCountBlocker(validation));
  const shouldBlock = Boolean(item.expected?.should_block_tree_count);
  const findings = [];

  if (expectedCount && actualCount !== expectedCount) {
    findings.push(`expected tree_count ${JSON.stringify(expectedCount)}, got ${JSON.stringify(actualCount)}`);
  }
  if (Object.hasOwn(item.expected || {}, "should_block_tree_count") && treeBlocker !== shouldBlock) {
    findings.push(`expected tree-count blocker ${shouldBlock}, got ${treeBlocker}`);
  }
  if (expectedType && actualType !== expectedType) {
    findings.push(`expected tree_type ${JSON.stringify(expectedType)}, got ${JSON.stringify(actualType)}`);
  }

  return {
    source,
    id: item.id,
    category: item.category || "",
    raw_customer_input: raw,
    expected_tree_count: expectedCount,
    actual_tree_count: actualCount,
    expected_tree_type: expectedType,
    actual_tree_type: actualType,
    tree_count_blocker: treeBlocker,
    can_generate_pdf: validation.can_generate_pdf,
    pass: findings.length === 0,
    findings,
  };
}

function summarize(results) {
  const withExpectedCount = results.filter((item) => item.expected_tree_count);
  const expectedCountCorrect = withExpectedCount.filter((item) => item.actual_tree_count === item.expected_tree_count);
  const blockerExpectations = results.filter((item) => item.source === "explicit-probes");
  const blockerCorrect = blockerExpectations.filter((item) => item.pass);
  const failures = results.filter((item) => !item.pass);
  const fixtureFalseTreeBlockers = results.filter(
    (item) => item.source !== "explicit-probes" && item.tree_count_blocker && item.expected_tree_count,
  );

  return {
    total: results.length,
    fixture_cases: results.filter((item) => item.source !== "explicit-probes").length,
    explicit_probes: blockerExpectations.length,
    failures: failures.length,
    expected_count_cases: withExpectedCount.length,
    expected_count_correct: expectedCountCorrect.length,
    expected_count_rate: withExpectedCount.length ? expectedCountCorrect.length / withExpectedCount.length : null,
    explicit_probe_passes: blockerCorrect.length,
    explicit_probe_rate: blockerExpectations.length ? blockerCorrect.length / blockerExpectations.length : null,
    fixture_false_tree_blockers: fixtureFalseTreeBlockers.length,
  };
}

function renderMarkdown(summary, failures, reportJsonl) {
  const pct = (value) => value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
  const lines = [
    "# Tree Count Focused Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Total local cases: ${summary.total}`,
    `- Fixture cases: ${summary.fixture_cases}`,
    `- Explicit probes: ${summary.explicit_probes}`,
    `- Expected tree-count cases: ${summary.expected_count_cases}`,
    `- Expected tree-count correct: ${summary.expected_count_correct}/${summary.expected_count_cases} (${pct(summary.expected_count_rate)})`,
    `- Explicit probe pass rate: ${summary.explicit_probe_passes}/${summary.explicit_probes} (${pct(summary.explicit_probe_rate)})`,
    `- Fixture false tree-count blockers among expected-count cases: ${summary.fixture_false_tree_blockers}`,
    `- Failures: ${summary.failures}`,
    "",
    "## Failure Sample",
    "",
  ];

  if (!failures.length) {
    lines.push("No focused failures found.");
  } else {
    for (const failure of failures.slice(0, 20)) {
      lines.push(`- ${failure.id} (${failure.source}): ${failure.findings.join("; ")}`);
      lines.push(`  - Raw: ${failure.raw_customer_input}`);
    }
  }

  lines.push("", `JSONL detail: ${reportJsonl}`);
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const fixtureCases = loadFixtureCases();
const results = [
  ...fixtureCases.map((item) => runCase(item, item.source)),
  ...probeCases.map((item) => runCase(item, "explicit-probes")),
];
const summary = summarize(results);
const stamp = timestamp();
const jsonlPath = path.join(REPORT_DIR, `tree-count-focused-report-${stamp}.jsonl`);
const mdPath = path.join(REPORT_DIR, `tree-count-focused-report-${stamp}.md`);

fs.writeFileSync(jsonlPath, results.map((item) => JSON.stringify(item)).join("\n") + "\n");
fs.writeFileSync(mdPath, renderMarkdown(summary, results.filter((item) => !item.pass), path.basename(jsonlPath)));

console.log(JSON.stringify({ summary, report: mdPath, detail: jsonlPath }, null, 2));
