import fs from "node:fs";
import path from "node:path";
import { buildCustomerJobSummary, normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const leakagePattern =
  /\b(?:aggressive|dog|bite|gate|do not go|don't go|dont go|do not enter|customer wants text|text no call|no call|cust wants|messd|aggresiv|mite bite|safety|access warning|crew|Tree Dude|Customer phone|Customer email|Service address|Follow-up)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/i;

const jobSummaryBadFragmentPattern =
  /\b(?:at\s*,|by\s+at|at\s+by|located\s+at\s*[.]|with\s+and|and\s+are\s+provided|can\s+be\s+(?:reached|contacted)\s+(?:by\s+at|at\s+the|at)\b|customer\s+with\s+number\s+and\s+at|tree\s+needing\s+removal\s+is|note\s+lists|but\s+the\s+work|The\s*,|IN\s+(?:remove|trim|cut|drop|take\s+down|haul|cleanup|tree)|Perform\s+(?:one|two|three|four|\d+)?\s*(?:[a-z]+\s+)?trees?)\b/i;

const jobSummaryRawLabelPattern =
  /\b(?:Tree Dude|raw notes?|customer name|customer phone|customer email|service address|parser|evidence|follow-up|internal)\b/i;

const jobSummarySafetyPattern =
  /\b(?:aggressive\s+dog|dog\s+in\s+yard|dog|bite|gate\s+blocked|blocked\s+by\s+trailer|trailer\s+blocking\s+access|power\s*line|service\s+drop|crew\s+caution|call\s+before\s+entering|do\s+not\s+(?:enter|go\s+in)|access warning)\b/i;

const jobSummaryTypoPattern =
  /\b(?:remuv|remuved|mapel|haila|hual|hawl|cleen|messd|aggresiv|mite bite|treess|treee)\b/i;

const jobSummaryAddressPattern =
  /\b(?:State\s+Road|State\s+Route|Route|County\s+Road|Highway|Hwy)\s+\d+\b|\b\d+\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Bend)\b/i;

const seriousWords = {
  contact: /\b(phone|email|contact)\b/i,
  address: /\b(address|where|location)\b/i,
  count: /\b(count|how many|number of trees|tree count)\b/i,
  price: /\b(price|priced|cost|amount|option)\b/i,
  scope: /\b(scope|cleanup|haul|stump|included|service)\b/i,
};

const customers = [
  ["Ava Reed", "812-555-0101", "ava@example.com"],
  ["Ben Clay", "812-555-0102", "ben@example.com"],
  ["Cara Mills", "812-555-0103", "cara@example.com"],
  ["Drew Moss", "812-555-0104", "drew@example.com"],
  ["Ella Knox", "812-555-0105", "ella@example.com"],
  ["Finn Hale", "812-555-0106", "finn@example.com"],
  ["Gina Price", "812-555-0107", "gina@example.com"],
  ["Hank Bell", "812-555-0108", "hank@example.com"],
  ["Ivy Stone", "812-555-0109", "ivy@example.com"],
  ["Jake Fox", "812-555-0110", "jake@example.com"],
];

const addresses = [
  "148 mapel st",
  "220 Oak Lane Madison IN",
  "91 Cedar Dr Hanover Indiana",
  "305 River Road Madison IN",
  "44 Pine Court Hanover IN",
  "18 Maple Bend Salem IN",
  "707 Walnut Street Corydon IN",
  "62 Roofline Rd New Albany IN",
  "83 River Ave Jeffersonville IN",
  "410 Spruce Ct Madison IN",
];

const species = ["tree", "mapel tree", "oak tree", "pine tree", "ash tree", "cedar tree", "walnut tree", "spruce tree"];

const safetyNotes = [
  "gate messd up and dog is real aggresiv, barks hard and mite bite, dont go in yard till cust puts dog up",
  "aggressive dog in back yard, text only and do not enter until customer secures dog",
  "gate broken and access is bad, crew should call before entering",
  "dog might bite and customer wants text no call",
  "blocked access near side gate, do not go in yard until customer opens it",
];

const typoPairs = [
  ["remuv only", "remuv plus haila way and cleen up"],
  ["remove only", "remove plus haul away and cleanup"],
  ["cut only", "cut plus hual away and cleanup"],
  ["drop only", "drop plus hall away and clean up"],
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

function expectedBase(overrides = {}) {
  return {
    shouldBlock: false,
    addressIncludes: [],
    treeCount: "",
    prices: [],
    requireWarning: false,
    noLeakage: true,
    followUps: [],
    ...overrides,
  };
}

function makeCases() {
  const cases = [];

  for (let i = 0; i < 20; i += 1) {
    const [name, phone, email] = customers[i % customers.length];
    const address = addresses[i % addresses.length];
    const tree = species[i % species.length];
    const [optA, optB] = typoPairs[i % typoPairs.length];
    cases.push({
      id: `safety-typo-ready-${String(i + 1).padStart(3, "0")}`,
      focus: "messy typo job with internal safety note should parse and stay customer-safe",
      input: `${name} ${phone} ${email}. needs ${tree} remuved at ${address}. big tree by garage. option 1 ${optA} ${1200 + i * 50}. option 2 ${optB} ${9000 + i * 25}. ${safetyNotes[i % safetyNotes.length]}.`,
      expected: expectedBase({
        addressIncludes: [address.split(" ")[0]],
        treeCount: "1 tree",
        prices: [`$${(1200 + i * 50).toLocaleString("en-US")}`, `$${(9000 + i * 25).toLocaleString("en-US")}`],
        requireWarning: true,
      }),
    });
  }

  for (let i = 0; i < 15; i += 1) {
    const address = addresses[(i + 2) % addresses.length];
    cases.push({
      id: `missing-contact-${String(i + 1).padStart(3, "0")}`,
      focus: "missing customer contact should block but still extract job",
      input: `needs tree remuved at ${address}. big tree by garage. option 1 remuv only ${1300 + i * 40}. option 2 remuv plus haila way and cleen up ${2400 + i * 70}. ${safetyNotes[i % safetyNotes.length]}.`,
      expected: expectedBase({
        shouldBlock: true,
        addressIncludes: [address.split(" ")[0]],
        treeCount: "1 tree",
        prices: [`$${(1300 + i * 40).toLocaleString("en-US")}`, `$${(2400 + i * 70).toLocaleString("en-US")}`],
        requireWarning: true,
        followUps: ["contact"],
      }),
    });
  }

  for (let i = 0; i < 15; i += 1) {
    const [name, phone, email] = customers[(i + 3) % customers.length];
    cases.push({
      id: `missing-address-${String(i + 1).padStart(3, "0")}`,
      focus: "missing service address should block and not use option text as address",
      input: `${name} ${phone} ${email}. needs big tree by garage removed. option 1 remove only ${1400 + i * 20}. option 2 remove plus haul away and cleanup ${2800 + i * 60}. ${safetyNotes[i % safetyNotes.length]}.`,
      expected: expectedBase({
        shouldBlock: true,
        treeCount: "1 tree",
        prices: [`$${(1400 + i * 20).toLocaleString("en-US")}`, `$${(2800 + i * 60).toLocaleString("en-US")}`],
        requireWarning: true,
        followUps: ["address"],
      }),
    });
  }

  for (let i = 0; i < 15; i += 1) {
    const [name, phone, email] = customers[(i + 5) % customers.length];
    const address = addresses[(i + 4) % addresses.length];
    cases.push({
      id: `ambiguous-count-${String(i + 1).padStart(3, "0")}`,
      focus: "ambiguous count should block",
      input: `${name} ${phone} ${email}. ${address}. remove several trees near garage. option 1 drop only ${1600 + i * 30}. option 2 drop plus haul away ${2600 + i * 50}.`,
      expected: expectedBase({
        shouldBlock: true,
        addressIncludes: [address.split(" ")[0]],
        prices: [`$${(1600 + i * 30).toLocaleString("en-US")}`, `$${(2600 + i * 50).toLocaleString("en-US")}`],
        followUps: ["count"],
      }),
    });
  }

  for (let i = 0; i < 15; i += 1) {
    const [name, phone, email] = customers[(i + 7) % customers.length];
    const address = addresses[(i + 1) % addresses.length];
    cases.push({
      id: `uncertain-price-${String(i + 1).padStart(3, "0")}`,
      focus: "uncertain price/scope should block",
      input: `${name} ${phone} ${email}. ${address}. remove a maple tree by garage. option 1 around ${1700 + i * 20}. option 2 cleanup maybe ${2900 + i * 45}.`,
      expected: expectedBase({
        shouldBlock: true,
        addressIncludes: [address.split(" ")[0]],
        treeCount: "1 tree",
        followUps: ["price"],
      }),
    });
  }

  for (let i = 0; i < 10; i += 1) {
    const [name, phone, email] = customers[i % customers.length];
    const address = addresses[(i + 6) % addresses.length];
    cases.push({
      id: `typed-intake-wins-${String(i + 1).padStart(3, "0")}`,
      focus: "typed intake address should win over messy job note address",
      input: `${name} ${phone} ${email}. old note says 999 Wrong Way Hanover IN, but job is remove a pine tree by garage. option 1 cut only ${1500 + i * 55}. option 2 cut haul away ${2300 + i * 80}.`,
      intake: { address },
      expected: expectedBase({
        addressIncludes: [address.split(" ")[0]],
        treeCount: "1 tree",
        prices: [`$${(1500 + i * 55).toLocaleString("en-US")}`, `$${(2300 + i * 80).toLocaleString("en-US")}`],
      }),
    });
  }

  for (let i = 0; i < 10; i += 1) {
    const [name, phone, email] = customers[(i + 2) % customers.length];
    const address = addresses[(i + 8) % addresses.length];
    cases.push({
      id: `option-address-confusion-${String(i + 1).padStart(3, "0")}`,
      focus: "option wording with way/haul away should not become address",
      input: `${name} ${phone} ${email}. service address ${address}. option 1 remove only ${1100 + i * 60}. option 2 remove plus haila way and cleen up ${2100 + i * 90}. big tree by shed.`,
      expected: expectedBase({
        addressIncludes: [address.split(" ")[0]],
        treeCount: "1 tree",
        prices: [`$${(1100 + i * 60).toLocaleString("en-US")}`, `$${(2100 + i * 90).toLocaleString("en-US")}`],
      }),
    });
  }

  const baseCases = cases.slice(0, 100);
  const variants = [
    { id: "base", prefix: "", suffix: "" },
    { id: "td-short", prefix: "TD note: ", suffix: " txt only pls." },
    { id: "speech", prefix: "voice note said ", suffix: " customer said thanks." },
    { id: "extra-spaces", prefix: "  ", suffix: "   " },
    { id: "followup-label", prefix: "", suffix: " Follow-up 1: no extra customer-facing notes." },
  ];

  return variants.flatMap((variant, variantIndex) =>
    baseCases.map((testCase, caseIndex) => ({
      ...testCase,
      id: `${testCase.id}-${variant.id}`,
      input: `${variant.prefix}${testCase.input}${variant.suffix}`,
      focus: `${testCase.focus}; synthetic variant ${variant.id}`,
      variantIndex,
      caseIndex,
    })),
  );
}

function publicText(alphaJson) {
  return [
    alphaJson.normalization?.corrected_interpretation || "",
    alphaJson.job?.description || "",
    ...(alphaJson.service_options?.items || []).map((option) => option.description || ""),
  ].join(" ");
}

function priceDisplays(alphaJson) {
  return (alphaJson.service_options?.items || []).map((option) => option.price?.display).filter(Boolean);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text || "").toLowerCase().includes(String(needle).toLowerCase()));
}

function hasFollowUp(validation, kind) {
  const text = `${(validation.blocking_errors || []).join(" ")} ${(validation.follow_ups || []).join(" ")}`;
  return seriousWords[kind]?.test(text) || false;
}

function jobSummaryQualityFailures(summary, alphaJson) {
  const failures = [];
  const text = String(summary || "").replace(/\s+/g, " ").trim();
  const address = String(alphaJson?.job?.service_address?.display || "").trim();

  if (!text) {
    failures.push({ severity: 95, code: "summary_missing", message: "TD2 Job Summary is blank." });
    return failures;
  }
  if (!/^[A-Z]/.test(text)) {
    failures.push({ severity: 70, code: "summary_not_capitalized", message: `TD2 Job Summary does not start with a capital letter: ${JSON.stringify(text)}.` });
  }
  if (!/[.!?]$/.test(text)) {
    failures.push({ severity: 70, code: "summary_not_sentence", message: `TD2 Job Summary does not end with sentence punctuation: ${JSON.stringify(text)}.` });
  }
  if (/;/.test(text)) {
    failures.push({ severity: 70, code: "summary_option_list_fragment", message: `TD2 Job Summary looks like a list of option fragments: ${JSON.stringify(text)}.` });
  }
  if (/\b([A-Za-z]+)(?:\s+\1\b)+/i.test(text)) {
    failures.push({ severity: 65, code: "summary_duplicate_word", message: `TD2 Job Summary has a duplicated word: ${JSON.stringify(text)}.` });
  }
  if (/\b(?:at|by|in|for|with|and|but|as|is)\s*[,.!?]?\s*$/i.test(text.replace(/[.!?]$/, ""))) {
    failures.push({ severity: 75, code: "summary_dangling_connector", message: `TD2 Job Summary ends with a dangling connector: ${JSON.stringify(text)}.` });
  }
  if (jobSummaryBadFragmentPattern.test(text)) {
    failures.push({ severity: 90, code: "summary_broken_fragment", message: `TD2 Job Summary contains broken parser prose: ${JSON.stringify(text)}.` });
  }
  if (/^(?:Drop|Cut|Remove|Trim|Haul|Cleanup|Clean up)(?:\s+only)?[.!?]$/i.test(text)) {
    failures.push({ severity: 70, code: "summary_option_only_fragment", message: `TD2 Job Summary is only an option fragment, not a coherent job summary: ${JSON.stringify(text)}.` });
  }
  if (/^(?:Drop|Cut|Remove|Trim)(?:\s+(?:plus\s+)?(?:haul(?:\s+away)?|cleanup|clean\s+up|leave\s+wood|stack\s+wood|stump(?:\s+grind)?))*[.!?]$/i.test(text)) {
    failures.push({ severity: 70, code: "summary_action_addon_fragment", message: `TD2 Job Summary is an option action/add-on fragment without a work object: ${JSON.stringify(text)}.` });
  }
  if (jobSummaryRawLabelPattern.test(text)) {
    failures.push({ severity: 100, code: "summary_raw_label", message: `TD2 Job Summary contains raw/internal labels: ${JSON.stringify(text)}.` });
  }
  if (jobSummarySafetyPattern.test(text)) {
    failures.push({ severity: 100, code: "summary_safety_leakage", message: `TD2 Job Summary contains safety/access wording: ${JSON.stringify(text)}.` });
  }
  if (jobSummaryTypoPattern.test(text)) {
    failures.push({ severity: 60, code: "summary_typo_leftover", message: `TD2 Job Summary contains likely typo leftovers: ${JSON.stringify(text)}.` });
  }
  if (leakagePattern.test(text)) {
    failures.push({ severity: 100, code: "summary_contact_or_internal_leakage", message: `TD2 Job Summary contains contact/internal leakage: ${JSON.stringify(text)}.` });
  }
  if (jobSummaryAddressPattern.test(text) || (address && text.toLowerCase().includes(address.toLowerCase()))) {
    failures.push({ severity: 80, code: "summary_address_contamination", message: `TD2 Job Summary contains address-like text: ${JSON.stringify(text)}.` });
  }
  if (!/\b(remove|trim|perform|tree service|tree|trees|limb|brush|stump|haul|cleanup|cut|drop|grind)\b/i.test(text)) {
    failures.push({ severity: 65, code: "summary_no_work_scope", message: `TD2 Job Summary does not clearly describe tree-service work: ${JSON.stringify(text)}.` });
  }
  return failures;
}

function evaluate(testCase) {
  const alphaJson = normalizeToAlphaJsonV14({}, testCase.input, testCase.intake || {});
  const validation = validateAlphaJson(alphaJson);
  const publicFacing = publicText(validation.alphaJson || alphaJson);
  const actualPrices = priceDisplays(validation.alphaJson || alphaJson);
  const actualAddress = validation.alphaJson?.job?.service_address?.display || "";
  const actualTreeCount = validation.alphaJson?.job?.tree_details?.tree_count || "";
  const td2JobSummary = buildCustomerJobSummary(validation.alphaJson || alphaJson);
  const failures = [];

  if (testCase.expected.shouldBlock && validation.can_generate_pdf) {
    failures.push({ severity: 100, code: "false_ready", message: "Expected the case to block, but validation allowed PDF generation." });
  }
  if (!testCase.expected.shouldBlock && !validation.can_generate_pdf) {
    failures.push({ severity: 65, code: "overblocked", message: `Expected ready, but validation blocked: ${validation.blocking_errors.join("; ")}` });
  }
  if (testCase.expected.noLeakage && leakagePattern.test(publicFacing)) {
    failures.push({ severity: 100, code: "customer_leakage", message: "Customer-facing summary/job/options contain internal contact, safety, access, or raw-note wording." });
  }
  if (testCase.expected.addressIncludes.length && !includesAll(actualAddress, testCase.expected.addressIncludes)) {
    failures.push({ severity: 85, code: "address_wrong", message: `Service address ${JSON.stringify(actualAddress)} did not include ${testCase.expected.addressIncludes.join(", ")}.` });
  }
  if (!testCase.expected.addressIncludes.length && /(?:remove|haul|cleanup|haila|option|remuv)/i.test(actualAddress)) {
    failures.push({ severity: 85, code: "address_option_fragment", message: `Service address looks like option/job text: ${JSON.stringify(actualAddress)}.` });
  }
  if (testCase.expected.treeCount && actualTreeCount !== testCase.expected.treeCount) {
    failures.push({ severity: 75, code: "tree_count_wrong", message: `Tree count was ${JSON.stringify(actualTreeCount)}, expected ${testCase.expected.treeCount}.` });
  }
  for (const price of testCase.expected.prices) {
    if (!actualPrices.includes(price)) {
      failures.push({ severity: 70, code: "price_missing", message: `Missing expected price ${price}; actual prices: ${actualPrices.join(", ") || "none"}.` });
    }
  }
  if (testCase.expected.requireWarning && !/(safety|access|dog|gate)/i.test((validation.warnings || []).join(" "))) {
    failures.push({ severity: 45, code: "warning_missing", message: "Expected internal safety/access warning, but none was present." });
  }
  for (const followUp of testCase.expected.followUps) {
    if (!hasFollowUp(validation, followUp)) {
      failures.push({ severity: 55, code: "followup_missing", message: `Expected follow-up about ${followUp}.` });
    }
  }
  failures.push(...jobSummaryQualityFailures(td2JobSummary, validation.alphaJson || alphaJson));

  const maxSeverity = failures.length ? Math.max(...failures.map((failure) => failure.severity)) : 0;
  return {
    id: testCase.id,
    focus: testCase.focus,
    input: testCase.input,
    intake: testCase.intake || {},
    expected: testCase.expected,
    pass: failures.length === 0,
    severity: maxSeverity,
    seriousness: maxSeverity >= 100 ? "critical" : maxSeverity >= 80 ? "high" : maxSeverity >= 60 ? "medium" : maxSeverity > 0 ? "low" : "none",
    failures: failures.sort((a, b) => b.severity - a.severity),
    actual: {
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors || [],
      follow_ups: validation.follow_ups || [],
      warnings: validation.warnings || [],
      service_address: actualAddress,
      tree_count: actualTreeCount,
      td2_job_summary: td2JobSummary,
      prices: actualPrices,
      corrected_interpretation: validation.alphaJson?.normalization?.corrected_interpretation || "",
      job_description: validation.alphaJson?.job?.description || "",
      option_descriptions: (validation.alphaJson?.service_options?.items || []).map((option) => option.description || ""),
    },
  };
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# Synthetic Messy Input Review ${payload.timestamp}`);
  lines.push("");
  lines.push("Local-only parser/validator review. No OpenAI calls, no production calls, no PDFs, no notifications.");
  lines.push("");
  lines.push("TD2 Job Summary quality checks are conservative heuristic checks for complete sentence shape, capitalization, dangling connectors, duplicated words, raw/internal labels, safety/access leakage, contact leakage, typo leftovers, and address contamination.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cases: ${payload.summary.total}`);
  lines.push(`- Passed: ${payload.summary.passed}`);
  lines.push(`- Failed: ${payload.summary.failed}`);
  lines.push(`- Critical: ${payload.summary.critical}`);
  lines.push(`- High: ${payload.summary.high}`);
  lines.push(`- Medium: ${payload.summary.medium}`);
  lines.push(`- Low: ${payload.summary.low}`);
  lines.push("");
  lines.push("## Ranked Cases");
  lines.push("");
  lines.push("| Rank | Case | Seriousness | Result | Top finding |");
  lines.push("|---:|---|---|---|---|");
  payload.records.forEach((record, index) => {
    const top = record.failures[0]?.message || "Passed expected behavior.";
    lines.push(`| ${index + 1} | ${record.id} | ${record.seriousness} | ${record.pass ? "PASS" : "FAIL"} | ${top.replace(/\|/g, "\\|")} |`);
  });
  lines.push("");
  lines.push("## Case Details");
  for (const record of payload.records) {
    lines.push("");
    lines.push(`### ${record.id}`);
    lines.push("");
    lines.push(`Seriousness: ${record.seriousness}`);
    lines.push("");
    lines.push(`Focus: ${record.focus}`);
    lines.push("");
    lines.push(`Result: ${record.pass ? "PASS" : "FAIL"}`);
    lines.push("");
    if (record.failures.length) {
      lines.push("Findings:");
      record.failures.forEach((failure) => lines.push(`- [${failure.severity}] ${failure.code}: ${failure.message}`));
      lines.push("");
    }
    lines.push("Actual:");
    lines.push(`- Can generate PDF: ${record.actual.can_generate_pdf}`);
    lines.push(`- Blocking errors: ${JSON.stringify(record.actual.blocking_errors)}`);
    lines.push(`- Follow-ups: ${JSON.stringify(record.actual.follow_ups)}`);
    lines.push(`- Warnings: ${JSON.stringify(record.actual.warnings)}`);
    lines.push(`- Service address: ${record.actual.service_address}`);
    lines.push(`- Tree count: ${record.actual.tree_count}`);
    lines.push(`- TD2 Job Summary: ${record.actual.td2_job_summary}`);
    lines.push(`- Prices: ${record.actual.prices.join(", ")}`);
    lines.push(`- Corrected summary: ${record.actual.corrected_interpretation}`);
    lines.push(`- Option descriptions: ${JSON.stringify(record.actual.option_descriptions)}`);
  }
  return `${lines.join("\n")}\n`;
}

const records = makeCases().map(evaluate).sort((a, b) => {
  if (b.severity !== a.severity) return b.severity - a.severity;
  if (a.pass !== b.pass) return a.pass ? 1 : -1;
  return a.id.localeCompare(b.id);
});

const stamp = timestamp();
const payload = {
  timestamp: stamp,
  execution: "local normalizeToAlphaJsonV14 followed by validateAlphaJson",
  summary: {
    total: records.length,
    passed: records.filter((record) => record.pass).length,
    failed: records.filter((record) => !record.pass).length,
    critical: records.filter((record) => record.seriousness === "critical").length,
    high: records.filter((record) => record.seriousness === "high").length,
    medium: records.filter((record) => record.seriousness === "medium").length,
    low: records.filter((record) => record.seriousness === "low").length,
  },
  records,
};

const jsonPath = path.join(process.cwd(), `synthetic-messy-input-review-data-${stamp}.json`);
const mdPath = path.join(process.cwd(), `Synthetic Messy Input Review ${stamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(payload));
console.log(JSON.stringify({ jsonPath, mdPath, summary: payload.summary }, null, 2));
