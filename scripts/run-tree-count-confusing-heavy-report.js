import fs from "node:fs";
import path from "node:path";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const REPORT_DIR = path.join(process.cwd(), "reports");

const names = ["Alex Reed", "Dana Cole", "Morgan Hale", "Riley Ford", "Casey Lane"];
const phones = ["812-555-1001", "812-555-1002", "812-555-1003", "812-555-1004", "812-555-1005"];
const addresses = [
  "2970 Walnut St Madison Indiana",
  "118 Maple Avenue Hanover Indiana",
  "55 Cherry Street Madison IN",
  "420 Cedar Drive Hanover IN",
  "88 Oak Lane Madison Indiana",
];

const patterns = [
  { text: "on tree and cedar and oak", count: "", type: "cedar and oak", blocker: true },
  { text: "one tree cedar and oak", count: "", type: "cedar and oak", blocker: true },
  { text: "three trees cedar and oak", count: "", type: "cedar and oak", blocker: true },
  { text: "two trees cedar and oak", count: "2 trees", type: "cedar and oak", blocker: false },
  { text: "oak and maple", count: "2 trees", type: "oak and maple", blocker: false },
  { text: "oak or maple", count: "1 tree", type: "oak or maple", blocker: false },
  { text: "tow trees oak and maple", count: "2 trees", type: "oak and maple", blocker: false },
  { text: "some trees behind shed", count: "", type: "", blocker: true },
  { text: "tree or maybe more behind barn", count: "", type: "", blocker: true },
  { text: "tree stuff done", count: "", type: "", blocker: true },
  { text: "one maple and one ash", count: "2 trees", type: "maple and ash", blocker: false },
  { text: "two maples and one oak", count: "3 trees", type: "maple and oak", blocker: false },
  { text: "4 cedars", count: "4 trees", type: "cedar", blocker: false },
  { text: "one large oak", count: "1 tree", type: "oak", blocker: false },
  { text: "one tree or several", count: "", type: "", blocker: true },
  { text: "a tree or maybe more", count: "", type: "", blocker: true },
  { text: "remove maple avenue limb near driveway", count: "", type: "maple", blocker: true },
  { text: "remove cherry street limb near roof", count: "", type: "cherry", blocker: true },
  { text: "one walnut tree at 2970 Walnut St", count: "1 tree", type: "walnut", blocker: false },
  { text: "2 trees at 55 Cherry Street", count: "2 trees", type: "", blocker: false },
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

function cases() {
  return Array.from({ length: 100 }, (_, index) => {
    const pattern = patterns[index % patterns.length];
    const name = names[index % names.length];
    const phone = phones[index % phones.length];
    const address = addresses[index % addresses.length];
    const price = 1200 + index * 25;
    return {
      case_id: `tree-confusing-${String(index + 1).padStart(3, "0")}`,
      raw_input: `${name} ${phone}. Service address ${address}. Remove ${pattern.text}. Option A removal only $${price}.`,
      expected: pattern,
    };
  });
}

function hasTreeCountBlocker(validation) {
  return [...(validation.blocking_errors || []), ...(validation.follow_ups || []), ...(validation.structured_follow_ups || [])]
    .map((item) => typeof item === "string" ? item : `${item.id || ""} ${item.message || ""} ${item.field || ""}`)
    .join(" ")
    .match(/tree count|how many trees|vague_tree_count|missing_tree_count/i);
}

function runCase(item) {
  const validation = validateAlphaJson(normalizeToAlphaJsonV14({}, item.raw_input));
  const alphaJson = validation.alphaJson;
  const actualCount = alphaJson.job?.tree_details?.tree_count || "";
  const actualType = alphaJson.job?.tree_details?.tree_type || "";
  const actualBlocker = Boolean(hasTreeCountBlocker(validation));
  const findings = [];

  if (actualCount !== item.expected.count) {
    findings.push(`tree_count expected ${JSON.stringify(item.expected.count)}, got ${JSON.stringify(actualCount)}`);
  }
  if (item.expected.type && actualType !== item.expected.type) {
    findings.push(`tree_type expected ${JSON.stringify(item.expected.type)}, got ${JSON.stringify(actualType)}`);
  }
  if (actualBlocker !== item.expected.blocker) {
    findings.push(`tree-count blocker expected ${item.expected.blocker}, got ${actualBlocker}`);
  }

  return {
    case_id: item.case_id,
    raw_input: item.raw_input,
    expected: item.expected,
    actual_tree_count: actualCount,
    actual_tree_type: actualType,
    actual_tree_count_blocker: actualBlocker,
    can_generate_pdf: validation.can_generate_pdf,
    pass: findings.length === 0,
    findings,
  };
}

function summarize(records) {
  const failures = records.filter((record) => !record.pass);
  const shouldBlock = records.filter((record) => record.expected.blocker);
  const shouldProceed = records.filter((record) => !record.expected.blocker);
  return {
    total: records.length,
    passed: records.length - failures.length,
    failed: failures.length,
    unclear_expected: shouldBlock.length,
    unclear_correct: shouldBlock.filter((record) => record.actual_tree_count_blocker).length,
    clear_expected: shouldProceed.length,
    clear_correct: shouldProceed.filter((record) => !record.actual_tree_count_blocker && record.pass).length,
  };
}

function renderMarkdown(summary, records, detailPath) {
  const lines = [
    "# Tree Count Confusing Heavy Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Total cases: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Unclear-count cases correctly blocked: ${summary.unclear_correct}/${summary.unclear_expected}`,
    `- Clear-count cases correctly allowed and assigned: ${summary.clear_correct}/${summary.clear_expected}`,
    "",
    "## Failures",
    "",
  ];

  const failures = records.filter((record) => !record.pass);
  if (!failures.length) {
    lines.push("No failures.");
  } else {
    for (const failure of failures.slice(0, 30)) {
      lines.push(`- ${failure.case_id}: ${failure.findings.join("; ")}`);
      lines.push(`  - Raw: ${failure.raw_input}`);
    }
  }

  lines.push("", `JSONL detail: ${path.basename(detailPath)}`);
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const records = cases().map(runCase);
const summary = summarize(records);
const stamp = timestamp();
const detailPath = path.join(REPORT_DIR, `tree-count-confusing-heavy-${stamp}.jsonl`);
const mdPath = path.join(REPORT_DIR, `tree-count-confusing-heavy-${stamp}.md`);

fs.writeFileSync(detailPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
fs.writeFileSync(mdPath, renderMarkdown(summary, records, detailPath));

console.log(JSON.stringify({ summary, files: { mdPath, detailPath } }, null, 2));
