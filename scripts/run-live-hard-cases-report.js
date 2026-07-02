import fs from "node:fs";
import path from "node:path";

const BASE_URL =
  process.env.ALPHA_LIVE_BASE_URL || "https://tree-service-web-app.vercel.app";

const cases = [
  {
    id: "hard-001-missing-contact",
    focus: "missing customer contact",
    notes:
      "Need estimate for 2 maple trees at 412 Oak St, New Albany IN. Remove both and haul away. Option A $2400, Option B $2800 with stumps.",
    expected: { shouldBlock: true, ask: ["contact"], noLeakage: true },
  },
  {
    id: "hard-002-missing-phone-email",
    focus: "name only, missing phone/email",
    notes:
      "Customer is Brad. 8218 State Road 56, Madison IN. Remove one ash tree by barn. Removal and haul $1800.",
    expected: { shouldBlock: true, ask: ["contact"], treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-003-missing-address",
    focus: "missing service address",
    notes:
      "Molly Evans 812-555-0911 molly@example.com. Remove a maple tree over the garage. Quote $2100.",
    expected: { shouldBlock: true, ask: ["address"], treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-004-vague-address",
    focus: "vague service address",
    notes:
      "Ben Holt 812-555-1144 ben@example.com. Somewhere off River Road near the old store. Take down two walnut trees. $3200.",
    expected: { shouldBlock: true, ask: ["address"], treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-005-contact-buried-in-notes",
    focus: "customer info buried in job notes",
    notes:
      "Tree Dude note: text Diane at 812-555-8822, email diane@example.com, job is 1704 Grant Line Rd New Albany IN, remove two spruce trees, option A $2600, option B $3100 with stump grinding.",
    expected: { shouldBlock: false, treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-006-email-only-no-name",
    focus: "email only contact",
    notes:
      "customer email oaklane@example.com. 199 Oak Lane, Corydon IN. Remove one dead elm by driveway. $1450 haul away included.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-007-several-trees",
    focus: "ambiguous tree count several",
    notes:
      "Paula King 812-555-2020 paula@example.com. 55 Maple St, Salem IN. Remove several trees behind shed. Budget price $3900.",
    expected: { shouldBlock: true, ask: ["count"], noLeakage: true },
  },
  {
    id: "hard-008-one-or-several",
    focus: "ambiguous one or several",
    notes:
      "Ron Blake 812-555-3030 ron@example.com. 91 Poplar Dr, Bedford IN. Might be one tree or several trees along back fence. $2200 if simple.",
    expected: { shouldBlock: true, ask: ["count", "price"], noLeakage: true },
  },
  {
    id: "hard-009-tree-job-prior-price",
    focus: "missing count and price source unclear",
    notes:
      "Jenna Wu 812-555-4040 jenna@example.com. 300 Pine Ridge, Columbus IN. Tree job from last visit, use price from yesterday.",
    expected: { shouldBlock: true, ask: ["count", "price"], noLeakage: true },
  },
  {
    id: "hard-010-maybe-price",
    focus: "uncertain price",
    notes:
      "Owen Reed 812-555-5050 owen@example.com. 77 Birch Ave, Seymour IN. Remove two birch trees, maybe 1900, not sure if cleanup included.",
    expected: { shouldBlock: true, ask: ["price"], treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-011-a-maple-tree",
    focus: "clear article count",
    notes:
      "Tara Mills 812-555-6060 tara@example.com. 18 Maple Court, Jeffersonville IN. Remove a maple tree by front walk. $1600 haul away.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-012-an-ash-tree",
    focus: "clear article count an",
    notes:
      "Corey Hill 812-555-7070 corey@example.com. 504 Elm St, Scottsburg IN. Take down an ash tree in side yard. $1750.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-013-pine-tree",
    focus: "clear one tree by phrasing",
    notes:
      "Nina Patel 812-555-8080 nina@example.com. 212 Pine St, Madison IN. Cut down a pine tree leaning over fence. $1850.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-014-cedar-tree",
    focus: "clear one tree informal wording",
    notes:
      "Lee Brooks 812-555-9090 lee@example.com. 6 Cedar Lane, Hanover IN. Drop a cedar tree near garage and haul brush. $1400.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-015-missing-tree-type",
    focus: "missing tree type should not block",
    notes:
      "Iris Fox 812-555-1112 iris@example.com. 88 Hilltop Rd, Floyds Knobs IN. Remove one tree by garage. $1550.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-016-missing-price",
    focus: "missing price",
    notes:
      "Sam Knox 812-555-1212 sam@example.com. 421 Main St, Paoli IN. Remove two oak trees and haul away. Option A basic removal.",
    expected: { shouldBlock: true, ask: ["price"], treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-017-around-price",
    focus: "vague price",
    notes:
      "Alex Stone 812-555-1313 alex@example.com. 40 Walnut St, Corydon IN. Remove one walnut tree, around 2k, Tree Dude needs to confirm.",
    expected: { shouldBlock: true, ask: ["price"], treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-018-price-depends",
    focus: "conditional price",
    notes:
      "Kim Fox 812-555-1414 kim@example.com. 909 Ridge Rd, Salem IN. Remove a dead oak tree. Price depends if crane is needed.",
    expected: { shouldBlock: true, ask: ["price"], treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-019-cleanup-conditional",
    focus: "conditional service option",
    notes:
      "Mara Lane 812-555-1515 mara@example.com. 39 Sycamore St, Bedford IN. Remove two sycamores. $2400 leave wood, clean it up if they want.",
    expected: { shouldBlock: true, ask: ["price", "scope"], treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-020-stump-maybe",
    focus: "ambiguous stump inclusion",
    notes:
      "Frank Cole 812-555-1616 frank@example.com. 87 Cherry Lane, Charlestown IN. Remove one cherry tree for $1300, stump maybe included.",
    expected: { shouldBlock: true, ask: ["price", "scope"], treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-021-dog-note",
    focus: "safety/access note should not leak",
    notes:
      "Holly Ray 812-555-1717 holly@example.com. 404 Dogwood Dr, Jeffersonville IN. Remove one dogwood tree. $1200. Aggressive dog in yard, call before entering.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-022-power-line-note",
    focus: "safety warning should not leak as customer text",
    notes:
      "Greg Moss 812-555-1818 greg@example.com. 33 Spruce Ct, Madison IN. Remove two spruce trees for $2600. Near service drop, crew needs caution.",
    expected: { shouldBlock: false, treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-023-blocked-access",
    focus: "access note should not leak",
    notes:
      "Dana Price 812-555-1919 dana@example.com. 120 Alley Way, New Albany IN. Trim one maple over roof for $900. Gate blocked by trailer.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-024-buried-name-phone-address",
    focus: "all customer info buried",
    notes:
      "Nora says call 812-555-2222, email nora@example.com, meet at 77 Meadow Lane Seymour IN, take down two pines, $2300 haul off.",
    expected: { shouldBlock: false, treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-025-reversed-name",
    focus: "name cleanup",
    notes:
      "Garza, Kara 812-555-2323 kara@example.com. 15 Park Ave, Bedford IN. Remove a maple tree. $1650.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-026-email-label-no-name",
    focus: "email label should not become name",
    notes:
      "Email: fieldwork@example.com Phone: 812-555-2424. 66 Field Rd, Columbus IN. Remove one elm tree for $1500.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-027-state-road-several",
    focus: "route number must not become tree count",
    notes:
      "Jay Moore 812-555-2525 jay@example.com. 8218 State Road 56, Hanover IN. Remove several trees near driveway. $3500 placeholder.",
    expected: { shouldBlock: true, ask: ["count", "price"], noLeakage: true },
  },
  {
    id: "hard-028-highway-one-tree",
    focus: "route number with clear one tree",
    notes:
      "Vera Holt 812-555-2626 vera@example.com. 421 Highway 421, Madison IN. Remove a dead ash tree. $1750.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-029-route-number-a-tree",
    focus: "route number plus article count",
    notes:
      "Liam Hart 812-555-2727 liam@example.com. 56 State Road 7, North Vernon IN. Remove a tree by shed. $1350.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-030-tow-sweet-gum",
    focus: "tow typo means two when tied to tree count",
    notes:
      "Megan Clay 812-555-2828 megan@example.com. 88 Gum St, Clarksville IN. Remove tow sweet gum trees by driveway. $2600.",
    expected: { shouldBlock: false, treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-031-mple-uncertain",
    focus: "misspelled tree species uncertain",
    notes:
      "Cal Reed 812-555-2929 cal@example.com. 12 Leaf Ln, Paoli IN. Remove a mple tree by porch. $1450.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true, uncertain: true },
  },
  {
    id: "hard-032-ashy-uncertain",
    focus: "misspelled tree species uncertain",
    notes:
      "Erin Bell 812-555-3131 erin@example.com. 34 Wood St, Scottsburg IN. Remove an ashy tree close to roof. $1700.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true, uncertain: true },
  },
  {
    id: "hard-033-no-name-phone-email",
    focus: "missing name should not block if contact exists",
    notes:
      "812-555-3232 no-name@example.com. 100 Creek Rd, Salem IN. Remove one poplar tree. $1600.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-034-address-embedded",
    focus: "address embedded in note",
    notes:
      "Customer: Todd Ames, 812-555-3333, todd@example.com. Job is at 440 Walnut Street in New Albany, remove two walnut trees, $3000.",
    expected: { shouldBlock: false, treeCount: "2 trees", noLeakage: true },
  },
  {
    id: "hard-035-raw-label-leakage",
    focus: "raw labels must not leak",
    notes:
      "Customer phone 812-555-3434 Customer email riley@example.com Service address 19 Oak Trail, Corydon IN. Remove a oak tree. $1500.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-036-a-tree-maybe-more",
    focus: "a tree maybe more should block",
    notes:
      "Perry Dale 812-555-3535 perry@example.com. 74 Farm Lane, Madison IN. Remove a tree or maybe more behind barn. $2100.",
    expected: { shouldBlock: true, ask: ["count", "price"], noLeakage: true },
  },
  {
    id: "hard-037-an-maple-tree",
    focus: "bad article grammar still one tree",
    notes:
      "Sid Long 812-555-3636 sid@example.com. 27 Maple Bend, Salem IN. Remove an maple tree. $1550.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-038-trim-a-maple",
    focus: "trim one tree",
    notes:
      "June Park 812-555-3737 june@example.com. 62 Roofline Rd, New Albany IN. Trim a maple tree over roof. $900.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-039-limbs-from-one-tree",
    focus: "limb work one tree",
    notes:
      "Otis Kent 812-555-3838 otis@example.com. 83 River Ave, Jeffersonville IN. Remove limbs from one tree over driveway. $850.",
    expected: { shouldBlock: false, treeCount: "1 tree", noLeakage: true },
  },
  {
    id: "hard-040-brush-pile",
    focus: "non-tree-count brush-only job",
    notes:
      "Mae Lloyd 812-555-3939 mae@example.com. 99 Brush Rd, Bedford IN. Haul away brush pile by curb, no tree removal. $450.",
    expected: { shouldBlock: false, noLeakage: true },
  },
];

function nowStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}`;
}

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return value == null ? "" : String(value);
}

function findLeakage(summary) {
  const text = textOf(summary);
  const patterns = [
    /\bcustomer\s*(name|phone|email)\b/i,
    /\bservice\s*address\b/i,
    /\bphone\s*[:#]/i,
    /\bemail\s*[:#]/i,
    /\bTree Dude\b/i,
    /\bfollow[- ]?up\b/i,
    /\baggressive dog\b/i,
    /\bcall before entering\b/i,
    /\bgate blocked\b/i,
    /\bblocked by trailer\b/i,
    /\bcrew needs caution\b/i,
    /\bnear service drop\b/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  ];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

function containsNeedle(haystack, needle) {
  const text = haystack.toLowerCase();
  if (needle === "contact") return /\b(contact|phone|email|telephone|number)\b/.test(text);
  if (needle === "address") return /\b(address|where|location|service address)\b/.test(text);
  if (needle === "count") return /\b(count|how many|number of trees|tree count|quantity)\b/.test(text);
  if (needle === "price") return /\b(price|pricing|cost|amount|option|quote|confirm)\b/.test(text);
  if (needle === "scope") return /\b(scope|included|cleanup|stump|haul|wood|service)\b/.test(text);
  return text.includes(needle.toLowerCase());
}

function optionPrices(alphaJson) {
  const items = alphaJson?.service_options?.items || [];
  return items.map((item) => item?.price).filter(Boolean);
}

function normalizeTreeCount(value) {
  const text = textOf(value).toLowerCase().trim();
  const match = text.match(/\d+/);
  return match ? match[0] : text;
}

function evaluate(testCase, openaiResult, validateResult, productionError) {
  const alphaJson = validateResult?.alphaJson || openaiResult?.alphaJson || {};
  const validation = validateResult || {};
  const corrected = alphaJson?.normalization?.corrected_interpretation || "";
  const leakage = findLeakage(corrected);
  const combinedFollowUpText = textOf([
    validation.blocking_errors,
    validation.follow_ups,
    validation.warnings,
  ]);
  const failReasons = [];
  const passReasons = [];
  const expected = testCase.expected;
  const actualTreeCount = alphaJson?.job?.tree_count || "";
  const canGenerate = Boolean(validation.can_generate_pdf);

  if (productionError) {
    failReasons.push(`production error: ${productionError}`);
  }

  if (expected.shouldBlock) {
    if (!canGenerate) passReasons.push("blocked as expected");
    else failReasons.push("expected a block, but validation allowed PDF generation");
  } else {
    if (canGenerate) passReasons.push("allowed PDF generation as expected");
    else failReasons.push("expected PDF generation to be allowed, but validation blocked");
  }

  if (expected.treeCount) {
    if (normalizeTreeCount(actualTreeCount) === normalizeTreeCount(expected.treeCount)) {
      passReasons.push(`tree count matched ${expected.treeCount}`);
    } else {
      failReasons.push(`tree count was ${JSON.stringify(actualTreeCount)}, expected ${expected.treeCount}`);
    }
  }

  if (expected.ask) {
    for (const ask of expected.ask) {
      if (containsNeedle(combinedFollowUpText, ask)) passReasons.push(`follow-up mentions ${ask}`);
      else failReasons.push(`expected follow-up to mention ${ask}`);
    }
  }

  if (expected.noLeakage) {
    if (leakage.length === 0) passReasons.push("no customer-facing leakage detected");
    else failReasons.push(`customer-facing leakage patterns detected: ${leakage.join(", ")}`);
  }

  const prices = optionPrices(alphaJson);
  return {
    pass: failReasons.length === 0,
    confidence: expected.uncertain || failReasons.some((r) => r.includes("expected follow-up"))
      ? "uncertain"
      : "definite",
    fail_reasons: failReasons,
    pass_reasons: passReasons,
    leakage_patterns: leakage,
    actual: {
      customer: alphaJson.customer || {},
      service_address: alphaJson?.job?.service_address?.display || "",
      tree_count: actualTreeCount,
      tree_type: alphaJson?.job?.tree_type || "",
      job_description: alphaJson?.job?.job_description || "",
      option_prices: prices,
      can_generate_pdf: canGenerate,
      blocking_errors: validation.blocking_errors || [],
      follow_ups: validation.follow_ups || [],
      warnings: validation.warnings || [],
      corrected_interpretation: corrected,
    },
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: response.status, ok: response.ok, json };
}

function synthesizeResults(record) {
  const actual = record.evaluation.actual;
  const alphaJson = {
    customer: actual.customer,
    job: {
      service_address: { display: actual.service_address },
      tree_count: actual.tree_count,
      tree_type: actual.tree_type,
      job_description: actual.job_description,
    },
    normalization: { corrected_interpretation: actual.corrected_interpretation },
    service_options: {
      items: (actual.option_prices || []).map((price, index) => ({
        label: `Option ${index + 1}`,
        price,
      })),
    },
  };
  return {
    openaiResult: { alphaJson },
    validateResult: {
      alphaJson,
      can_generate_pdf: actual.can_generate_pdf,
      blocking_errors: actual.blocking_errors,
      follow_ups: actual.follow_ups,
      warnings: actual.warnings,
    },
  };
}

function mdEscape(value) {
  return textOf(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# Live Hard Cases Review ${payload.timestamp}`);
  lines.push("");
  lines.push(`Base URL: ${payload.base_url}`);
  lines.push(`Execution: live production /api/openai followed by live production /api/validate`);
  lines.push(`Safety: no PDF generation, no estimate link creation, no notifications`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total cases: ${payload.summary.total}`);
  lines.push(`- Passed: ${payload.summary.passed}`);
  lines.push(`- Failed: ${payload.summary.failed}`);
  lines.push(`- Uncertain recommendations: ${payload.summary.uncertain}`);
  lines.push(`- Customer-facing leakage cases: ${payload.summary.leakage_cases}`);
  lines.push(`- Mocked OpenAI responses: ${payload.summary.mocked}`);
  lines.push(`- Production errors: ${payload.summary.production_errors}`);
  lines.push("");
  lines.push("## Case Results");
  lines.push("");
  lines.push("| # | Case | Focus | Result | Confidence | Key finding |");
  lines.push("|---:|---|---|---|---|---|");
  for (const record of payload.records) {
    const finding = record.evaluation.pass
      ? record.evaluation.pass_reasons.slice(0, 3).join("; ")
      : record.evaluation.fail_reasons.join("; ");
    lines.push(
      `| ${record.n} | ${record.id} | ${mdEscape(record.focus)} | ${
        record.evaluation.pass ? "PASS" : "FAIL"
      } | ${record.evaluation.confidence} | ${mdEscape(finding)} |`
    );
  }
  lines.push("");
  lines.push("## Case Details");
  for (const record of payload.records) {
    lines.push("");
    lines.push(`### ${record.n}. ${record.id}`);
    lines.push("");
    lines.push(`Focus: ${record.focus}`);
    lines.push("");
    lines.push(`Expected: ${JSON.stringify(record.expected)}`);
    lines.push("");
    lines.push(`Result: ${record.evaluation.pass ? "PASS" : "FAIL"} (${record.evaluation.confidence})`);
    lines.push("");
    if (record.evaluation.fail_reasons.length) {
      lines.push("Fail reasons:");
      for (const reason of record.evaluation.fail_reasons) lines.push(`- ${reason}`);
    }
    lines.push("Actual:");
    lines.push(`- Customer: ${JSON.stringify(record.evaluation.actual.customer)}`);
    lines.push(`- Service address: ${record.evaluation.actual.service_address}`);
    lines.push(`- Tree count: ${record.evaluation.actual.tree_count}`);
    lines.push(`- Tree type: ${record.evaluation.actual.tree_type}`);
    lines.push(`- Can generate PDF: ${record.evaluation.actual.can_generate_pdf}`);
    lines.push(`- Blocking errors: ${JSON.stringify(record.evaluation.actual.blocking_errors)}`);
    lines.push(`- Follow-ups: ${JSON.stringify(record.evaluation.actual.follow_ups)}`);
    lines.push(`- Warnings: ${JSON.stringify(record.evaluation.actual.warnings)}`);
    lines.push(`- Corrected summary: ${record.evaluation.actual.corrected_interpretation}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const fromIndex = process.argv.indexOf("--from");
  if (fromIndex !== -1) {
    const sourcePath = process.argv[fromIndex + 1];
    if (!sourcePath) throw new Error("--from requires a JSON report path");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const records = source.records.map((record) => {
      const testCase = cases.find((item) => item.id === record.id);
      if (!testCase) return record;
      const { openaiResult, validateResult } = synthesizeResults(record);
      return {
        ...record,
        expected: testCase.expected,
        evaluation: evaluate(testCase, openaiResult, validateResult, record.production_error),
      };
    });
    const timestamp = nowStamp();
    const payload = {
      ...source,
      timestamp,
      reevaluated_from: path.basename(sourcePath),
      summary: {
        total: records.length,
        passed: records.filter((r) => r.evaluation.pass).length,
        failed: records.filter((r) => !r.evaluation.pass).length,
        uncertain: records.filter((r) => r.evaluation.confidence === "uncertain").length,
        leakage_cases: records.filter((r) => r.evaluation.leakage_patterns.length).length,
        mocked: records.filter((r) => r.mocked).length,
        production_errors: records.filter((r) => r.production_error).length,
      },
      records,
    };
    const jsonPath = path.join(process.cwd(), `live-hard-cases-review-data-${timestamp}.json`);
    const mdPath = path.join(process.cwd(), `Live Hard Cases Review ${timestamp}.md`);
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(mdPath, renderMarkdown(payload));
    console.log(JSON.stringify({ jsonPath, mdPath, summary: payload.summary }, null, 2));
    return;
  }

  const records = [];
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    let openai;
    let validate;
    let productionError = "";
    try {
      openai = await postJson(`${BASE_URL}/api/openai`, {
        case_id: testCase.id,
        customer_text: testCase.notes,
      });
      if (!openai.ok) {
        productionError = `/api/openai ${openai.status}`;
      } else {
        validate = await postJson(`${BASE_URL}/api/validate`, {
          alphaJson: openai.json.alphaJson,
          customer_text: testCase.notes,
        });
        if (!validate.ok) productionError = `/api/validate ${validate.status}`;
      }
    } catch (error) {
      productionError = error && error.message ? error.message : String(error);
    }
    const evaluation = evaluate(
      testCase,
      openai?.json || {},
      validate?.json || {},
      productionError
    );
    records.push({
      n: index + 1,
      id: testCase.id,
      focus: testCase.focus,
      notes: testCase.notes,
      expected: testCase.expected,
      openai_status: openai?.status || null,
      validate_status: validate?.status || null,
      mocked: Boolean(openai?.json?.mocked),
      production_error: productionError,
      evaluation,
    });
    console.log(`${index + 1}/${cases.length} ${testCase.id} ${evaluation.pass ? "PASS" : "FAIL"}`);
  }

  const timestamp = nowStamp();
  const payload = {
    timestamp,
    base_url: BASE_URL,
    summary: {
      total: records.length,
      passed: records.filter((r) => r.evaluation.pass).length,
      failed: records.filter((r) => !r.evaluation.pass).length,
      uncertain: records.filter((r) => r.evaluation.confidence === "uncertain").length,
      leakage_cases: records.filter((r) => r.evaluation.leakage_patterns.length).length,
      mocked: records.filter((r) => r.mocked).length,
      production_errors: records.filter((r) => r.production_error).length,
    },
    records,
  };

  const jsonPath = path.join(process.cwd(), `live-hard-cases-review-data-${timestamp}.json`);
  const mdPath = path.join(process.cwd(), `Live Hard Cases Review ${timestamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(payload));
  console.log(JSON.stringify({ jsonPath, mdPath, summary: payload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
