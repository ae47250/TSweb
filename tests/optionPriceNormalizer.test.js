import test from "node:test";
import assert from "node:assert/strict";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { normalizeContactFields } from "../lib/contactNormalizer.js";

function cluesFor(rawInput) {
  return buildOptionPriceCandidateView(rawInput).pre_ai_option_price_candidate_clues;
}

function protectedPhoneSpans(rawInput) {
  return normalizeContactFields({ rawText: rawInput }).phone.candidates
    .filter((candidate) => candidate.span)
    .map((candidate) => ({
      start: candidate.span.start,
      end: candidate.span.end,
      kind: "phone",
      raw: candidate.raw,
    }));
}

test("pre-AI option-price view keeps raw note unchanged and only emits clue categories", () => {
  const raw =
    "Kevin Cox call/text 8125555377. 6097 Poplar Ridge Road, Madison, IN. one river birch tree removal. gate code 1234, dog in back. drop $850 cleanup $1250";
  const view = buildOptionPriceCandidateView(raw);

  assert.equal(view.raw_customer_note, raw);
  assert.deepEqual(Object.keys(view).sort(), [
    "pre_ai_option_price_candidate_clues",
    "raw_customer_note",
    "rendered_view",
  ]);
  assert.equal("service_options" in view, false);
  assert.equal("option_groups" in view, false);
  assert.equal("customer" in view, false);
  assert.match(view.rendered_view, /Raw customer note:\nKevin Cox/);
  assert.match(view.rendered_view, /Pre-AI option-price candidate clues:/);
});

test("money-like numbers exclude phone address and gate-code numbers", () => {
  const clues = cluesFor(
    "Kevin Cox call/text 8125555377. 6097 Poplar Ridge Road, Madison, IN. gate code 1234. drop $850 cleanup $1250",
  );

  assert.deepEqual(clues.money_like_numbers.map((item) => item.normalized_money_like), ["$850", "$1,250"]);
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "phone" && item.normalized_display === "812-555-5377"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "address" && /6097 Poplar Ridge Road/i.test(item.raw)));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "gate_code" && /1234/.test(item.raw)));
});

test("phone-shaped spans do not become prices or include preceding words", () => {
  const clues = cluesFor("wrong labels: price (812)  555  1074. option A grind $800 option B grind and haul $1250");

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$800", "$1,250"]);
  const phone = clues.likely_non_price_numbers.find((item) => item.kind === "phone");
  assert.ok(phone);
  assert.equal(phone.raw, "(812)  555  1074");
  assert.equal(phone.normalized_display, "812-555-1074");
  assert.equal(phone.raw.includes("price"), false);
  assert.ok(clues.excluded_numbers.some((item) => item.kind === "phone" && item.raw === "(812)  555  1074"));
});

test("gate or code adjacent numbers do not become prices", () => {
  const cases = [
    "gate 1234 option A $850 option B $1250",
    "code:1234 option A $850 option B $1250",
    "gate#1234 option A $850 option B $1250",
    "1234 gate option A $850 option B $1250",
  ];

  for (const raw of cases) {
    const clues = cluesFor(raw);

    assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$850", "$1,250"], raw);
    assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "gate_code" && /1234/.test(item.raw)), raw);
    assert.ok(clues.excluded_numbers.some((item) => item.kind === "gate_code" && /1234/.test(item.raw)), raw);
  }
});

test("option boundaries and slash prices are clues, not final service options", () => {
  const raw =
    "Autumn Kennedy said text 812-555-9196 3119 Elm Street - Madison Indiana 2600/2,950 for tree? no note on haul or stump";
  const view = buildOptionPriceCandidateView(raw);
  const clues = view.pre_ai_option_price_candidate_clues;

  assert.deepEqual(clues.money_like_numbers.map((item) => item.normalized_money_like), ["$2,600", "$2,950"]);
  assert.ok(clues.option_boundary_clues.some((item) => item.kind === "slash_between_money_like_numbers"));
  assert.ok(clues.stump_add_on_clues.some((item) => item.kind === "stump_or_grinding"));
  assert.ok(clues.price_scope_ambiguity_warnings.some((item) => /ambiguous|non-firm|unclear|scope/i.test(item.warning)));
  assert.equal(JSON.stringify(view).includes("service_options"), false);
});

test("bare A B C labels after options cue produce option-price pairing clues", () => {
  const clues = cluesFor(
    "three optons: A cut tree and leave wood/brush 1500. B cut tree and hawl away brush/logs 2100. C cut tree, hawl away, cleen up yard, and stump grind 2800.",
  );

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$1,500", "$2,100", "$2,800"]);
  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_id), ["price_1", "price_2", "price_3"]);
  assert.ok(clues.money_like_numbers.every((item) => item.amount_confidence === "high"));
  assert.deepEqual(clues.option_boundary_clues.map((item) => item.token), ["A", "B", "C"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.label), ["Option A", "Option B", "Option C"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,500", "$2,100", "$2,800"]);
  assert.ok(clues.option_price_pairings.every((item) => item.pairing_confidence === "high"));
  assert.match(clues.option_price_pairings[1].description_raw, /hawl away brush\/logs/);
});

test("unlabeled service and add-on prices receive implicit sidecar pairings", () => {
  const clues = cluesFor("prices tree removal 2000 stump grinding 650");

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$2,000", "$650"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_id), ["price_1", "price_2"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$2,000", "$650"]);
  assert.match(clues.option_price_pairings[0].description_raw, /tree removal/i);
  assert.match(clues.option_price_pairings[1].description_raw, /stump grinding/i);
  assert.ok(clues.option_price_pairings.every((item) => item.source === "option_price_sidecar_implicit"));
  assert.ok(clues.option_price_pairings.every((item) => item.pairing_confidence === "high"));
});

test("explicit plus wording emits high-confidence additive interpretation", () => {
  const clues = cluesFor("tree removal 1000 + stump grinding 400");
  const interpretation = clues.add_on_price_interpretations[0];

  assert.equal(interpretation.interpretation, "additive_amount");
  assert.equal(interpretation.addon_interpretation_confidence, "high");
  assert.equal(interpretation.explicit_additive_cue, true);
  assert.equal(interpretation.base_price_display, "$1,000");
  assert.equal(interpretation.add_on_price_display, "$400");
  assert.equal(interpretation.combined_price_display, "$1,400");
  assert.equal(interpretation.needs_review, false);
});

test("lower later stump price without explicit wording requires review", () => {
  const clues = cluesFor("tree removal 1000, stump grinding 400");
  const interpretation = clues.add_on_price_interpretations[0];

  assert.equal(interpretation.interpretation, "needs_review");
  assert.equal(interpretation.addon_interpretation_confidence, "low");
  assert.equal(interpretation.needs_review, true);
  assert.match(interpretation.review_reason, /lower add-on price needs explicit wording/i);
});

test("higher later stump price without explicit wording is bundled total evidence", () => {
  const clues = cluesFor("tree removal 1000, stump grinding 2000");
  const interpretation = clues.add_on_price_interpretations[0];

  assert.equal(interpretation.interpretation, "bundled_total");
  assert.equal(interpretation.addon_interpretation_confidence, "high");
  assert.equal(interpretation.combined_price_display, "$2,000");
  assert.equal(interpretation.needs_review, false);
});

test("per-unit add-on wording remains review-only", () => {
  const clues = cluesFor("tree removal 1000 + stump grinding 400 per stump");
  const interpretation = clues.add_on_price_interpretations[0];

  assert.equal(interpretation.interpretation, "additive_amount");
  assert.notEqual(interpretation.addon_interpretation_confidence, "high");
  assert.equal(interpretation.needs_review, true);
  assert.match(interpretation.review_reason, /per-unit|unclear|included|conditional/i);
  assert.ok(clues.low_confidence_spans.some((item) => item.field === "add_on_price_interpretation"));
});

test("shared tree lexicon terms create price context for mostly missing services", () => {
  const clues = cluesFor("crown reduction 900, cabling 1200, root ball removal 600");

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$900", "$1,200", "$600"]);
  assert.ok(clues.money_like_numbers.every((item) => item.amount_confidence === "high"));
  assert.ok(clues.option_price_pairings.some((item) => /crown reduction/i.test(item.description_raw)));
  assert.ok(clues.option_price_pairings.some((item) => /cabling/i.test(item.description_raw)));
  assert.ok(clues.option_price_pairings.some((item) => /root ball removal/i.test(item.description_raw)));
});

test("slashed and weak shorthand labels still produce option-price pairings", () => {
  const clues = cluesFor("a/$1425. b maybe $2325 w stmp haull.");

  assert.deepEqual(clues.option_boundary_clues.map((item) => item.token), ["A", "B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.label), ["Option A", "Option B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,425", "$2,325"]);
  assert.match(clues.option_price_pairings[0].context, /a\/\$1425/i);
  assert.match(clues.option_price_pairings[1].context, /b maybe \$2325/i);
});

test("slash-separated shorthand option segments emit raw-label price pairings", () => {
  const cases = [
    {
      raw: "a/$1275 // remove trees // b maybe 2,100 w stmp haull",
      expectedLabels: ["A", "B"],
      expectedPrices: ["$1,275", "$2,100"],
      warningLabels: ["B"],
    },
    {
      raw: "b maybe $1600 w stmp haull // a/$925",
      expectedLabels: ["B", "A"],
      expectedPrices: ["$1,600", "$925"],
      warningLabels: ["B"],
    },
    {
      raw: "a/$1425 // b maybe $2325 w stmp haull",
      expectedLabels: ["A", "B"],
      expectedPrices: ["$1,425", "$2,325"],
      warningLabels: ["B"],
    },
    {
      raw: "b maybe $2,775 w stmp haull // a/1725",
      expectedLabels: ["B", "A"],
      expectedPrices: ["$2,775", "$1,725"],
      warningLabels: ["B"],
    },
  ];

  for (const testCase of cases) {
    const pairings = cluesFor(testCase.raw).option_price_pairings;

    assert.deepEqual(pairings.map((item) => item.raw_label_token), testCase.expectedLabels, testCase.raw);
    assert.deepEqual(pairings.map((item) => item.price_display), testCase.expectedPrices, testCase.raw);
    assert.deepEqual(
      pairings.filter((item) => item.review_warning).map((item) => item.raw_label_token),
      testCase.warningLabels,
      testCase.raw,
    );
  }
});

test("option descriptions stop before trailing phone email and gate notes", () => {
  const clues = cluesFor(
    "A cut tree and leave wood/brush 1500. B cut tree and hawl away brush/logs 2100. phone 812-555-2400, email j.allen2400 maybe gmail maybe not. gate by alley.",
  );

  assert.deepEqual(clues.option_price_pairings.map((item) => item.raw_label_token), ["A", "B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.description_raw), [
    "cut tree and leave wood/brush",
    "cut tree and hawl away brush/logs",
  ]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,500", "$2,100"]);
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "phone" && item.normalized_display === "812-555-2400"));

  for (const pairing of clues.option_price_pairings) {
    assert.doesNotMatch(pairing.description_raw, /phone|email|gate|812-555-2400|j\.allen/i);
  }
});

test("option descriptions stop before contact and address cues in same sentence", () => {
  const clues = cluesFor(
    "option A trim only $950 option B trim and cleanup $1450; reach at 812 . 555 . 1036; quote email riley . west36 @example . com; service addy 712 Grant Line Rd.",
  );

  assert.deepEqual(clues.option_price_pairings.map((item) => item.raw_label_token), ["A", "B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.description_raw), ["trim only", "trim and cleanup"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$950", "$1,450"]);
  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$950", "$1,450"]);
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "phone" && item.normalized_display === "812-555-1036"));
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "address" && /712 Grant Line Rd/i.test(item.raw)));
});

test("last option description stops before text preference and gate code", () => {
  const clues = cluesFor(
    "three options: A cut and leave 1200 B cut and haul 1800 C cut haul stump grind 2400 text is best gate code 1234.",
  );

  assert.deepEqual(clues.option_price_pairings.map((item) => item.raw_label_token), ["A", "B", "C"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.description_raw), [
    "cut and leave",
    "cut and haul",
    "cut haul stump grind",
  ]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,200", "$1,800", "$2,400"]);
  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$1,200", "$1,800", "$2,400"]);
  assert.ok(clues.likely_non_price_numbers.some((item) => item.kind === "gate_code" && /1234/.test(item.raw)));
  assert.doesNotMatch(clues.option_price_pairings[2].description_raw, /text is best|gate code|1234/i);
});

test("soft option boundaries stop after price but not before price", () => {
  const clues = cluesFor(
    "A remove tree by driveway 1200 dog in yard tomorrow morning paid cash. B trim limbs by side yard 900 prefers text after 5.",
  );

  assert.deepEqual(clues.option_price_pairings.map((item) => item.raw_label_token), ["A", "B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.description_raw), [
    "remove tree by driveway",
    "trim limbs by side yard",
  ]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,200", "$900"]);
  assert.doesNotMatch(clues.option_price_pairings[0].description_raw, /dog|tomorrow|morning|paid|cash/i);
  assert.doesNotMatch(clues.option_price_pairings[1].description_raw, /prefers text|after 5/i);
  assert.match(clues.option_price_pairings[0].boundary_reason, /soft_after_price/);
  assert.match(clues.option_price_pairings[1].boundary_reason, /soft_after_price/);
});

test("admin duplicate and internal note cues are hard option boundaries", () => {
  const clues = cluesFor(
    "A drop tree 1400 note to self ask crew about crane. B haul brush 800 forwarded old message ignore old price 600.",
  );

  assert.deepEqual(clues.option_price_pairings.map((item) => item.raw_label_token), ["A", "B"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.description_raw), ["drop tree", "haul brush"]);
  assert.deepEqual(clues.option_price_pairings.map((item) => item.price_display), ["$1,400", "$800"]);
  assert.ok(clues.money_like_numbers.some((item) => item.price_display === "$600" && item.confidence === "low"));
  assert.doesNotMatch(clues.option_price_pairings[0].description_raw, /note to self|crane/i);
  assert.doesNotMatch(clues.option_price_pairings[1].description_raw, /forwarded|old message|ignore old price/i);
  assert.match(clues.option_price_pairings[0].boundary_reason, /hard_stop_cue:note to self/);
});

test("non-firm and historical price wording remains only a warning clue", () => {
  const clues = cluesFor(
    "Vague Price 812-555-3003 vague@example.com. 12 Maple Ave Madison Indiana. old quote 1800, maybe around 2k if cleanup included?",
  );

  assert.deepEqual(clues.email_candidates.map((item) => item.normalized_display), ["vague@example.com"]);
  assert.ok(clues.money_like_numbers.some((item) => item.normalized_money_like === "$1,800"));
  assert.ok(clues.money_like_numbers.some((item) => item.normalized_money_like === "$2,000"));
  assert.ok(clues.price_scope_ambiguity_warnings.some((item) => /historical|not current/i.test(item.warning)));
  assert.ok(clues.price_scope_ambiguity_warnings.some((item) => /ambiguous|non-firm/i.test(item.warning)));
  assert.ok(clues.stump_add_on_clues.some((item) => /included/i.test(item.raw)));
});

test("slash price patterns emit two unique price candidates with evidence fields", () => {
  const cases = [
    ["Basic slash $1100/$1500", ["$1,100", "$1,500"]],
    ["Spaced slash $1,100 / $1,500", ["$1,100", "$1,500"]],
    ["Mixed comma slash $1750/2,250", ["$1,750", "$2,250"]],
    ["Comma slash 1,600/2,450", ["$1,600", "$2,450"]],
  ];

  for (const [raw, expected] of cases) {
    const clues = cluesFor(raw);
    const candidates = clues.money_like_numbers;
    assert.deepEqual(candidates.map((item) => item.price_display), expected, raw);
    assert.equal(new Set(candidates.map((item) => item.price_display)).size, expected.length, raw);
    assert.ok(clues.option_boundary_clues.some((item) => item.kind === "slash_between_money_like_numbers"), raw);

    for (const candidate of candidates) {
      assert.equal(candidate.source, "raw_customer_note");
      assert.equal(candidate.price_raw, candidate.raw);
      assert.ok(Number.isFinite(candidate.price_value));
      assert.match(candidate.price_display, /^\$\d/);
      assert.equal(typeof candidate.confidence, "string");
      assert.equal(typeof candidate.reason, "string");
      assert.ok(candidate.span.start < candidate.span.end);
    }
  }
});

test("non-price number exclusions cover routine customer note numbers", () => {
  const clues = cluesFor(
    "Call 812-555-9196. 1205 County Road 250 W, Madison IN 47250. Gate code 1234. Visit 07/14/2026. 40 ft oak, 25% over roof, remove 2 trees price 2500.",
  );

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$2,500"]);
  const excludedKinds = new Set(clues.excluded_numbers.map((item) => item.kind));
  assert.ok(excludedKinds.has("phone"));
  assert.ok(excludedKinds.has("address"));
  assert.ok(excludedKinds.has("route_number"));
  assert.ok(excludedKinds.has("zip"));
  assert.ok(excludedKinds.has("gate_code"));
  assert.ok(excludedKinds.has("date"));
  assert.ok(excludedKinds.has("measurement"));
  assert.ok(excludedKinds.has("percentage"));
  assert.ok(excludedKinds.has("tree_count"));
});

test("high-risk raw notes warn without hiding real price candidates", () => {
  const clues = cluesFor(
    "Rosa Crawford 812-555-1196 3680 Poplar Ridge Road Madison IN tree on house after storm, wants estimate sent now $2500",
  );

  assert.deepEqual(clues.money_like_numbers.map((item) => item.price_display), ["$2,500"]);
  assert.ok(clues.safety_scope_warnings.some((item) => /tree on house/i.test(item.raw)));
  assert.ok(clues.low_confidence_spans.some((item) => item.field === "safety_access_scope"));

  const fenceClues = cluesFor(
    "Wes Coleman 812-555-2786 wes@example.com fallen tree on neighbor fence at 2824 Cherry Street Madison Indiana price 2450",
  );
  assert.deepEqual(fenceClues.money_like_numbers.map((item) => item.price_display), ["$2,450"]);
  assert.ok(fenceClues.safety_scope_warnings.some((item) => /tree on neighbor fence/i.test(item.raw)));
});

test("location and address numbers do not become price candidates", () => {
  const cases = [
    {
      raw: "behind the old barn on 421. option A 1300 option B haul 2250",
      excluded: ["421"],
      prices: ["$1,300", "$2,250"],
    },
    {
      raw: "at 2400 River Rd remove oak 2500 stump 800",
      excluded: ["2400"],
      prices: ["$2,500", "$800"],
    },
    {
      raw: "near route 46 maple remove 1800",
      excluded: ["route 46"],
      prices: ["$1,800"],
    },
    {
      raw: "off hwy 37 trim limbs 900",
      excluded: ["hwy 37"],
      prices: ["$900"],
    },
    {
      raw: "cut only 1050 / cut and haul off 1550",
      excluded: [],
      prices: ["$1,050", "$1,550"],
    },
    {
      raw: "8125552400 421 barn rd oak remove 2300",
      excluded: ["8125552400", "421 barn rd"],
      prices: ["$2,300"],
    },
    {
      raw: "remove oak, bubbi morthens, 123 main, madison, option 1 300 option b and haul 2000",
      excluded: ["123 main madison"],
      prices: ["$300", "$2,000"],
    },
    {
      raw: "123 main madison remove oak option A 300 option B haul 2000",
      excluded: ["123 main madison"],
      prices: ["$300", "$2,000"],
    },
    {
      raw: "803 w. 2nd remove maple option A 1200 option B haul 1800",
      excluded: ["803 w. 2nd"],
      prices: ["$1,200", "$1,800"],
    },
  ];

  for (const item of cases) {
    const clues = cluesFor(item.raw);
    assert.deepEqual(clues.money_like_numbers.map((candidate) => candidate.price_display), item.prices, item.raw);
    for (const excludedText of item.excluded) {
      assert.ok(
        clues.excluded_numbers.some((candidate) => candidate.raw.toLowerCase().includes(excludedText.toLowerCase())),
        `${item.raw} should exclude ${excludedText}`,
      );
    }
  }
});

test("protected phone spans prevent phone-shaped numbers from becoming prices", () => {
  const cases = [
    {
      raw: "customer Caleb Clark 812.555.7808. opt1 drop and leave brush $1,900 opt2 haul away and cleanup 2,450",
      expected: ["$1,900", "$2,450"],
    },
    {
      raw: "(812) 555-2147 Henry Goodwin opt1 drop and leave brush $1,800 opt2 haul away and cleanup 2350",
      expected: ["$1,800", "$2,350"],
    },
    {
      raw: "customer Brooke Warren call/text call 812-555-3738 Option A $1450 Option B 1,850",
      expected: ["$1,450", "$1,850"],
    },
    {
      raw: "8125551380 note from Joan Gray price 1850",
      expected: ["$1,850"],
    },
    {
      raw: "lady named Molly Lopez 812-555-3590 Option A cut only. Option B haul away and cleanup.",
      expected: [],
    },
    {
      raw: "customer Brenda Murphy 812 555 1500 Option A cut only. Option B haul away and cleanup.",
      expected: [],
    },
  ];

  for (const testCase of cases) {
    const view = buildOptionPriceCandidateView(testCase.raw, protectedPhoneSpans(testCase.raw));
    assert.deepEqual(
      view.pre_ai_option_price_candidate_clues.money_like_numbers.map((item) => item.price_display),
      testCase.expected,
      testCase.raw,
    );
    assert.equal(
      view.pre_ai_option_price_candidate_clues.protected_spans.some((span) => span.kind === "phone"),
      true,
      testCase.raw,
    );
  }
});

test("cleaned reading aid does not create price candidates", () => {
  const raw = "Option A remove oak two thousand five hundred";
  const cleanedText = "Option A remove oak $2500";
  const view = buildOptionPriceCandidateView(raw, [], { cleanedText });
  const clues = view.pre_ai_option_price_candidate_clues;

  assert.deepEqual(clues.money_like_numbers, []);
  assert.equal(clues.source_of_truth, "raw_customer_note");
  assert.equal(clues.cleaned_reading_aid.cleaned_text, cleanedText);
  assert.match(view.rendered_view, /secondary reading aid only/i);
});
