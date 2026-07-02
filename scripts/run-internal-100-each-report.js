import fs from "node:fs";
import path from "node:path";
import { buildCustomerJobSummary, normalizeToAlphaJsonV14, normalizeTreeServiceText } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const REPORT_DIR = path.join(process.cwd(), "reports");
const PRIOR_FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "alpha-hard-knownfail-150-initial-100pct-2026-06-30-cases.json",
);
const RUN_VARIANT = Number(process.env.INTERNAL_TEST_VARIANT || "0");
const INCLUDE_PRIOR_REGRESSION = process.env.INCLUDE_PRIOR_REGRESSION !== "false";
const RUN_LABEL = process.env.INTERNAL_TEST_LABEL || (RUN_VARIANT ? `variant-${RUN_VARIANT}` : "");

const customers = [
  ["Ava Reed", "812-555-0101", "ava.reed@example.com"],
  ["Ben Clay", "812-555-0102", "ben.clay@example.com"],
  ["Cara Mills", "812-555-0103", "cara.mills@example.com"],
  ["Drew Moss", "812-555-0104", "drew.moss@example.com"],
  ["Ella Knox", "812-555-0105", "ella.knox@example.com"],
  ["Finn Hale", "812-555-0106", "finn.hale@example.com"],
  ["Gina Price", "812-555-0107", "gina.price@example.com"],
  ["Hank Bell", "812-555-0108", "hank.bell@example.com"],
  ["Ivy Stone", "812-555-0109", "ivy.stone@example.com"],
  ["Jake Fox", "812-555-0110", "jake.fox@example.com"],
];

const towns = ["Madison", "Hanover", "North Vernon", "Salem", "Seymour", "Austin", "Scottsburg", "Paoli", "Bedford", "Charlestown"];
const streets = ["Walnut St", "Oak Lane", "Maple Ave", "Pine Road", "Cedar Dr", "Elm Street", "Main St", "River Road", "Cherry Lane", "Spruce Ct"];
const species = ["maple", "oak", "pine", "ash", "cedar", "walnut", "spruce", "elm", "sycamore", "hickory"];
const workLocations = ["by garage", "over roof", "near driveway", "beside shed", "in back yard", "near fence", "by power line", "front yard", "leaning toward house", "over deck"];

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

function money(value) {
  return `$${Number(value).toLocaleString("en-US")}`;
}

function customer(index) {
  return customers[(index + RUN_VARIANT * 3) % customers.length];
}

function address(index, options = {}) {
  const variantIndex = index + RUN_VARIANT * 137;
  const house = String(100 + variantIndex * 7);
  const street = streets[variantIndex % streets.length];
  const town = towns[variantIndex % towns.length];
  const state = options.noState ? "" : variantIndex % 2 === 0 ? "Indiana" : "IN";
  return [house, street, town, state].filter(Boolean).join(" ");
}

function gluedAddress(index) {
  const variantIndex = index + RUN_VARIANT * 137;
  const house = String(200 + variantIndex * 11);
  const street = streets[variantIndex % streets.length];
  const town = towns[variantIndex % towns.length];
  const state = variantIndex % 3 === 0 ? "" : variantIndex % 2 === 0 ? "Indiana" : "IN";
  const gluedStreet = variantIndex % 4 === 0
    ? `${house}${street.replace(/\s+/g, "")}`
    : variantIndex % 4 === 1
      ? `${house}${street}`
      : variantIndex % 4 === 2
        ? `${house}${street.replace(/\b(Walnut|Oak|Maple|Pine|Cedar|Elm|Main|River|Cherry|Spruce)\b/i, (match) => match[0].toLowerCase() + match.slice(1))}`
        : `${house}${street.replace(/\s+(St|Street|Road|Rd|Lane|Ave|Dr|Ct)$/i, "")}`;
  return [gluedStreet, town, state].filter(Boolean).join(" ");
}

function expectedAddressParts(inputAddress) {
  const normalized = normalizeTreeServiceText(inputAddress)
    .replace(/^(\d+)([A-Za-z])/i, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const house = normalized.match(/\b\d+\b/)?.[0] || "";
  const town = towns.find((item) => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(normalized)) || "";
  return [house, town].filter(Boolean);
}

function optionText(a, b, third = null) {
  const parts = [`Option A cut and leave wood ${money(a)}`, `Option B remove, haul away, and cleanup ${money(b)}`];
  if (third != null) parts.push(`Option C stump grind and final cleanup ${money(third)}`);
  return parts.join(". ");
}

function baseExpectation(overrides = {}) {
  return {
    ready: true,
    addressIncludes: [],
    prices: [],
    treeCount: "",
    treeType: "",
    warningRegexes: [],
    followUpRegexes: [],
    noCustomerLeakage: true,
    noAddressAsJobSummary: true,
    ...overrides,
  };
}

function makeCleanBaseline() {
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index);
    const addr = address(index);
    const tree = species[index % species.length];
    const priceA = 900 + index * 10;
    const priceB = 1450 + index * 12;
    return {
      case_id: `clean-baseline-${String(index + 1).padStart(3, "0")}`,
      category: "clean_baseline",
      raw_input: `${name}. Phone ${phone}. Email ${email}. Service address ${addr}. Remove 1 ${tree} tree ${workLocations[index % workLocations.length]}. ${optionText(priceA, priceB)}.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB)],
        treeCount: "1 tree",
        treeType: tree,
      }),
    };
  });
}

function makeMessyJobDescription() {
  const typoSpecies = ["mapel", "oke", "pin", "ashy", "ceder", "walnutt", "spruse", "elm", "sycamor", "hickry"];
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 2);
    const addr = address(index + 20);
    const priceA = 1100 + index * 13;
    const priceB = 1900 + index * 17;
    return {
      case_id: `messy-job-${String(index + 1).padStart(3, "0")}`,
      category: "messy_job_description",
      raw_input: `${name} ${phone} ${email} - job is ${typoSpecies[index % typoSpecies.length]} tree kinda big ${workLocations[index % workLocations.length]} need remuv, hual away maybe cleen up too. addr ${addr}. ${optionText(priceA, priceB)}. cust typed fast.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB)],
        treeCount: "1 tree",
      }),
    };
  });
}

function makeMessyAddress() {
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 4);
    const addr = gluedAddress(index);
    const priceA = 1000 + index * 9;
    const priceB = 1750 + index * 11;
    return {
      case_id: `messy-address-${String(index + 1).padStart(3, "0")}`,
      category: "messy_service_address",
      raw_input: `${name} ${phone} ${email}. service address ${addr}. remove one ${species[index % species.length]} tree ${workLocations[index % workLocations.length]}. ${optionText(priceA, priceB)}.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB)],
        treeCount: "1 tree",
      }),
    };
  });
}

function makeIncompleteAddress() {
  const fragments = [
    "Walnut St",
    "near Main",
    "Madison",
    "behind garage",
    "Oak Lane no number",
    "town is Hanover but street missing",
    "at the old farm",
    "address later",
    "North Vernon no street",
    "service address unknown",
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 6);
    const priceA = 1200 + index * 8;
    const priceB = 1800 + index * 9;
    return {
      case_id: `incomplete-address-${String(index + 1).padStart(3, "0")}`,
      category: "incomplete_ambiguous_address",
      raw_input: `${name} ${phone} ${email}. Service address ${fragments[index % fragments.length]}. Remove one ${species[index % species.length]} tree. ${optionText(priceA, priceB)}.`,
      expected: baseExpectation({
        ready: false,
        prices: [money(priceA), money(priceB)],
        treeCount: "1 tree",
        followUpRegexes: [/address|service address|where/i],
      }),
    };
  });
}

function makeLargePriceSpread() {
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 8);
    const addr = address(index + 40);
    const priceA = 700 + index * 5;
    const priceB = priceA * 4;
    const priceC = index % 2 === 0 ? priceB + 900 : null;
    return {
      case_id: `price-spread-${String(index + 1).padStart(3, "0")}`,
      category: "large_price_spread",
      raw_input: `${name}. ${phone}. ${email}. ${addr}. Remove one ${species[index % species.length]} tree ${workLocations[index % workLocations.length]}. ${optionText(priceA, priceB, priceC)}.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB), ...(priceC == null ? [] : [money(priceC)])],
        treeCount: "1 tree",
        warningRegexes: [/large price spread|price spread|3x/i],
      }),
    };
  });
}

function makeTreeDetails() {
  const detailPatterns = [
    { text: "two maples and one oak", count: "3 trees", type: "" },
    { text: "2 spruce trees", count: "2 trees", type: "spruce" },
    { text: "one bradford pear", count: "1 tree", type: "bradford pear" },
    { text: "three pine trees", count: "3 trees", type: "pine" },
    { text: "1 large oak", count: "1 tree", type: "oak" },
    { text: "two sweet gum trees", count: "2 trees", type: "sweet gum" },
    { text: "one maple and one ash", count: "2 trees", type: "" },
    { text: "4 cedars", count: "4 trees", type: "cedar" },
    { text: "two walnut trees", count: "2 trees", type: "walnut" },
    { text: "one river birch", count: "1 tree", type: "river birch" },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 10);
    const addr = address(index + 60);
    const detail = detailPatterns[index % detailPatterns.length];
    const priceA = 1500 + index * 12;
    const priceB = 2300 + index * 14;
    return {
      case_id: `tree-details-${String(index + 1).padStart(3, "0")}`,
      category: "tree_count_tree_detail",
      raw_input: `${name} ${phone} ${email}. Service address ${addr}. Remove ${detail.text} ${workLocations[index % workLocations.length]}; include cleanup. ${optionText(priceA, priceB)}.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB)],
        treeCount: detail.count,
        treeType: detail.type,
      }),
    };
  });
}

function makeNoiseHeavy() {
  const noise = [
    "text only, customer works nights",
    "dog in yard, call before entering",
    "gate sticks, crew should use side path",
    "customer asks about next Tuesday but not confirmed",
    "neighbor may move car before crew arrives",
    "do not block mailbox",
    "customer wants wood left by driveway",
    "stump optional, not sure yet",
    "old note says call office but use listed phone",
    "access from alley is easier",
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const [name, phone, email] = customer(index + 12);
    const addr = address(index + 80);
    const priceA = 1300 + index * 11;
    const priceB = 2100 + index * 15;
    return {
      case_id: `noise-heavy-${String(index + 1).padStart(3, "0")}`,
      category: "noise_heavy_notes",
      raw_input: `Tree Dude note. ${name} ${phone}, email ${email}. service address ${addr}. ${noise[index % noise.length]}. main work: remove one ${species[index % species.length]} tree ${workLocations[index % workLocations.length]}. ${optionText(priceA, priceB)}. thanks, sent from phone.`,
      expected: baseExpectation({
        addressIncludes: expectedAddressParts(addr),
        prices: [money(priceA), money(priceB)],
        treeCount: "1 tree",
      }),
    };
  });
}

function makePriorRegression() {
  const fixture = JSON.parse(fs.readFileSync(PRIOR_FIXTURE_PATH, "utf8"));
  return fixture.cases.slice(0, 100).map((item, index) => ({
    case_id: `prior-regression-${String(index + 1).padStart(3, "0")}-${item.id}`,
    category: "prior_regression_failures",
    raw_input: item.raw_customer_input,
    expected: baseExpectation({
      ready: item.expected?.can_generate_pdf,
      addressIncludes: item.expected?.service_address_should_include || [],
      prices: item.expected?.service_option_prices || [],
      treeCount: item.expected?.tree_count || "",
      followUpRegexes: (item.expected?.follow_ups_should_include || []).map((text) => new RegExp(escapeRegExp(text.split(/\s+/)[0] || text), "i")),
      warningRegexes: (item.expected?.warnings_should_include || []).map((text) => new RegExp(escapeRegExp(text.split(/\s+/)[0] || text), "i")),
    }),
    fixture_expected: item.expected,
    fixture_category: item.category,
    fixture_messiness: item.messiness,
    fixture_decision: item.decision,
  }));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeCases() {
  const cases = [
    ...makeCleanBaseline(),
    ...makeMessyJobDescription(),
    ...makeMessyAddress(),
    ...makeIncompleteAddress(),
    ...makeLargePriceSpread(),
    ...makeTreeDetails(),
    ...makeNoiseHeavy(),
    ...(INCLUDE_PRIOR_REGRESSION ? makePriorRegression() : []),
  ];
  return RUN_LABEL
    ? cases.map((item) => ({ ...item, case_id: `${item.case_id}-${RUN_LABEL}` }))
    : cases;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function includesAll(haystack, needles) {
  const text = String(haystack || "").toLowerCase();
  return needles.every((needle) => text.includes(String(needle).toLowerCase()));
}

function priceDisplays(alphaJson) {
  return (alphaJson.service_options?.items || []).map((option) => option.price?.display || "").filter(Boolean);
}

function customerFacingText(alphaJson, td2JobSummary) {
  return [
    alphaJson.normalization?.corrected_interpretation || "",
    alphaJson.job?.description || "",
    td2JobSummary || "",
    ...(alphaJson.service_options?.items || []).flatMap((option) => [option.title || "", option.description || ""]),
  ].join(" ");
}

function isAddressContaminatedSummary(summary, addressDisplay) {
  if (!summary || !addressDisplay) return false;
  const houseNumber = addressDisplay.match(/\b\d+\b/)?.[0];
  return Boolean(houseNumber && summary.includes(houseNumber));
}

function evaluate(testCase) {
  let validation;
  let alphaJson;
  const normalized_input = normalizeTreeServiceText(testCase.raw_input);
  const findings = [];

  try {
    alphaJson = normalizeToAlphaJsonV14({}, testCase.raw_input, testCase.intake || {});
    validation = validateAlphaJson(alphaJson);
  } catch (error) {
    return {
      ...testCase,
      normalized_input,
      pass: false,
      findings: [{ severity: 100, code: "pipeline_exception", message: error?.stack || String(error) }],
    };
  }

  const finalAlphaJson = validation.alphaJson || alphaJson;
  const td2JobSummary = buildCustomerJobSummary(finalAlphaJson);
  const addressDisplay = finalAlphaJson.job?.service_address?.display || "";
  const prices = priceDisplays(finalAlphaJson);
  const warningsText = (validation.warnings || []).join(" | ");
  const followUpText = [...(validation.follow_ups || []), ...(validation.blocking_errors || [])].join(" | ");
  const publicText = customerFacingText(finalAlphaJson, td2JobSummary);

  if (typeof testCase.expected.ready === "boolean" && validation.can_generate_pdf !== testCase.expected.ready) {
    findings.push({
      severity: 90,
      code: testCase.expected.ready ? "unexpected_block" : "unexpected_ready",
      message: `Expected can_generate_pdf=${testCase.expected.ready}, got ${validation.can_generate_pdf}.`,
    });
  }

  if (testCase.expected.addressIncludes?.length && !includesAll(addressDisplay, testCase.expected.addressIncludes)) {
    findings.push({
      severity: 85,
      code: "address_mismatch",
      message: `Expected address to include ${testCase.expected.addressIncludes.join(", ")}; got ${JSON.stringify(addressDisplay)}.`,
    });
  }

  for (const expectedPrice of testCase.expected.prices || []) {
    if (!prices.includes(expectedPrice)) {
      findings.push({
        severity: 75,
        code: "price_missing",
        message: `Expected price ${expectedPrice}; got ${prices.join(", ") || "no prices"}.`,
      });
    }
  }

  const treeCount = finalAlphaJson.job?.tree_details?.tree_count || "";
  if (testCase.expected.treeCount && treeCount !== testCase.expected.treeCount) {
    findings.push({
      severity: 75,
      code: "tree_count_mismatch",
      message: `Expected tree_count ${JSON.stringify(testCase.expected.treeCount)}; got ${JSON.stringify(treeCount)}.`,
    });
  }

  const treeType = finalAlphaJson.job?.tree_details?.tree_type || "";
  if (testCase.expected.treeType && treeType !== testCase.expected.treeType) {
    findings.push({
      severity: 60,
      code: "tree_type_mismatch",
      message: `Expected tree_type ${JSON.stringify(testCase.expected.treeType)}; got ${JSON.stringify(treeType)}.`,
    });
  }

  for (const pattern of testCase.expected.warningRegexes || []) {
    if (!pattern.test(warningsText)) {
      findings.push({
        severity: 55,
        code: "warning_missing",
        message: `Expected warning matching ${pattern}; got ${JSON.stringify(validation.warnings || [])}.`,
      });
    }
  }

  for (const pattern of testCase.expected.followUpRegexes || []) {
    if (!pattern.test(followUpText)) {
      findings.push({
        severity: 55,
        code: "followup_missing",
        message: `Expected follow-up/blocker matching ${pattern}; got ${JSON.stringify(validation.follow_ups || [])} / ${JSON.stringify(validation.blocking_errors || [])}.`,
      });
    }
  }

  if (testCase.expected.noCustomerLeakage && /Tree Dude note|sent from phone|text only|customer works nights|listed phone|example\.com|812-555|Follow-up/i.test(publicText)) {
    findings.push({
      severity: 65,
      code: "customer_facing_noise_leakage",
      message: "TD2-facing text appears to include contact, raw-note, or workflow noise.",
    });
  }

  if (testCase.expected.noAddressAsJobSummary && isAddressContaminatedSummary(td2JobSummary, addressDisplay)) {
    findings.push({
      severity: 60,
      code: "summary_address_contamination",
      message: `TD2 job summary appears to contain the service address: ${JSON.stringify(td2JobSummary)}.`,
    });
  }

  if (!td2JobSummary && testCase.expected.ready !== false) {
    findings.push({
      severity: 70,
      code: "td2_job_summary_missing",
      message: "TD2 job summary is blank for a case expected to be quote-ready.",
    });
  }

  const extraction_fields = {
    customer: {
      name: finalAlphaJson.customer?.name || "",
      phone_display: finalAlphaJson.customer?.phone_display || "",
      email: finalAlphaJson.customer?.email || "",
    },
    service_address: {
      display: addressDisplay,
    },
    job: {
      description: finalAlphaJson.job?.description || "",
      tree_details: finalAlphaJson.job?.tree_details || {},
    },
    service_options: {
      items: (finalAlphaJson.service_options?.items || []).map((option) => ({
        label: option.label || "",
        title: option.title || "",
        description: option.description || "",
        price: option.price || {},
      })),
    },
    normalization: {
      corrected_interpretation: finalAlphaJson.normalization?.corrected_interpretation || "",
      field_evidence: finalAlphaJson.normalization?.field_evidence || {},
    },
  };

  const td2_rendered_fields = {
    customer_name: extraction_fields.customer.name,
    customer_phone: extraction_fields.customer.phone_display,
    customer_email: extraction_fields.customer.email,
    service_address: addressDisplay,
    job_summary: td2JobSummary,
    quote_options: extraction_fields.service_options.items.map((option) => ({
      label: option.label,
      title: option.title,
      description: option.description,
      price_display: option.price.display || "",
    })),
    warnings: validation.warnings || [],
    needs_more_info: validation.follow_ups?.length ? validation.follow_ups : validation.blocking_errors || [],
  };

  findings.sort((a, b) => b.severity - a.severity || a.code.localeCompare(b.code));

  return {
    ...testCase,
    normalized_input,
    pass: findings.length === 0,
    max_severity: findings[0]?.severity || 0,
    findings,
    validation: {
      can_generate_pdf: validation.can_generate_pdf,
      blocking_errors: validation.blocking_errors || [],
      follow_ups: validation.follow_ups || [],
      warnings: validation.warnings || [],
    },
    extraction_fields,
    td2_rendered_fields,
  };
}

function summarize(records) {
  const categories = [...new Set(records.map((record) => record.category))];
  return {
    total: records.length,
    passed: records.filter((record) => record.pass).length,
    failed: records.filter((record) => !record.pass).length,
    by_category: Object.fromEntries(
      categories.map((category) => {
        const categoryRecords = records.filter((record) => record.category === category);
        const failureCounts = {};
        for (const record of categoryRecords) {
          for (const finding of record.findings || []) {
            failureCounts[finding.code] = (failureCounts[finding.code] || 0) + 1;
          }
        }
        return [
          category,
          {
            total: categoryRecords.length,
            passed: categoryRecords.filter((record) => record.pass).length,
            failed: categoryRecords.filter((record) => !record.pass).length,
            top_findings: Object.entries(failureCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([code, count]) => ({ code, count })),
          },
        ];
      }),
    ),
  };
}

function renderMarkdown(summary, records, paths) {
  const lines = [];
  lines.push("# Internal 100 Each Report");
  lines.push("");
  lines.push("Local-only run. No OpenAI calls, no production calls, no PDFs, no notifications.");
  if (RUN_LABEL) lines.push(`Run label: ${RUN_LABEL}.`);
  if (!INCLUDE_PRIOR_REGRESSION) lines.push("Legacy prior-regression backlog bucket excluded.");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push(`- Internal tracking JSONL: ${paths.jsonlPath}`);
  lines.push(`- GPT raw-input CSV: ${paths.csvPath}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cases: ${summary.total}`);
  lines.push(`- Passed: ${summary.passed}`);
  lines.push(`- Failed: ${summary.failed}`);
  lines.push("");
  lines.push("## Category Results");
  lines.push("");
  lines.push("| Category | Passed | Failed | Top findings |");
  lines.push("|---|---:|---:|---|");
  for (const [category, item] of Object.entries(summary.by_category)) {
    const top = item.top_findings.map((finding) => `${finding.code} ${finding.count}`).join(", ") || "none";
    lines.push(`| ${category} | ${item.passed}/${item.total} | ${item.failed}/${item.total} | ${top} |`);
  }
  lines.push("");
  lines.push("## Top Failing Cases");
  lines.push("");
  lines.push("| Case | Category | Severity | Top finding | TD2 job summary | Service address |");
  lines.push("|---|---|---:|---|---|---|");
  records
    .filter((record) => !record.pass)
    .sort((a, b) => b.max_severity - a.max_severity || a.case_id.localeCompare(b.case_id))
    .slice(0, 50)
    .forEach((record) => {
      const finding = record.findings?.[0];
      lines.push(
        [
          record.case_id,
          record.category,
          record.max_severity,
          (finding ? `${finding.code}: ${finding.message}` : "").replace(/\|/g, "\\|"),
          String(record.td2_rendered_fields?.job_summary || "").replace(/\|/g, "\\|"),
          String(record.td2_rendered_fields?.service_address || "").replace(/\|/g, "\\|"),
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
      );
    });
  lines.push("");
  lines.push("## How To Use");
  lines.push("");
  lines.push("- Use the JSONL tracking file for our internal comparison over time.");
  lines.push("- Use the CSV file for GPT comparison because it contains only case_id and raw_input.");
  lines.push("- Treat failures as test findings, not necessarily app bugs; some expected outcomes are intentionally strict.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const stamp = RUN_LABEL ? `${timestamp()}-${RUN_LABEL}` : timestamp();
const cases = makeCases();
const records = cases.map(evaluate);
const summary = summarize(records);
const jsonlPath = path.join(REPORT_DIR, `internal-100-each-tracking-${stamp}.jsonl`);
const csvPath = path.join(REPORT_DIR, `internal-100-each-gpt-inputs-${stamp}.csv`);
const mdPath = path.join(REPORT_DIR, `internal-100-each-summary-${stamp}.md`);

fs.writeFileSync(jsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
fs.writeFileSync(csvPath, `case_id,raw_input\n${cases.map((item) => `${csvEscape(item.case_id)},${csvEscape(item.raw_input)}`).join("\n")}\n`);
fs.writeFileSync(mdPath, renderMarkdown(summary, records, { jsonlPath, csvPath }));

console.log(JSON.stringify({ summary, files: { jsonlPath, csvPath, mdPath } }, null, 2));
