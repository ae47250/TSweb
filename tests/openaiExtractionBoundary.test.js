import test from "node:test";
import assert from "node:assert/strict";
import { resolveServiceAddress } from "../lib/addressResolver.js";
import { buildDebugPipelinePayload } from "../lib/debugPipeline.js";
import { buildStructuredFollowUps } from "../lib/followUpBuilder.js";
import { openAiDraftToNormalizerInput } from "../lib/openaiDraftAdapter.js";
import { OPENAI_DRAFT_RESPONSE_FORMAT, parseOpenAiDraft } from "../lib/openaiDraftSchema.js";
import { extractQuoteCleanupPricePair, resolvePrice } from "../lib/priceResolver.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const firstNames = ["Ava", "Ben", "Cara", "Drew", "Ella", "Finn", "Gina", "Hank", "Ivy", "Jake"];
const lastNames = ["Reed", "Clay", "Mills", "Moss", "Knox", "Hale", "Price", "Bell", "Stone", "Fox"];
const towns = ["Madison", "Hanover", "North Vernon", "Salem", "Seymour", "Austin", "Scottsburg", "Paoli", "Bedford", "Charlestown"];
const streets = ["Walnut St", "Oak Lane", "Maple Ave", "Pine Road", "Cedar Dr", "Elm Street"];
const species = ["maple", "oak", "pine", "ash", "cedar", "walnut"];

test("OpenAI draft response format uses strict JSON schema instead of JSON mode", () => {
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.type, "json_schema");
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.strict, true);
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.additionalProperties, false);
  assert.ok(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.required.includes("normalization"));
  assert.ok(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.required.includes("low_confidence_spans"));
  assert.ok(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.required.includes("number_trace"));
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.properties.options.items.additionalProperties, false);
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.properties.low_confidence_spans.items.additionalProperties, false);
  assert.equal(OPENAI_DRAFT_RESPONSE_FORMAT.json_schema.schema.properties.number_trace.items.additionalProperties, false);
});

function sampleCount(items, label) {
  assert.equal(items.length, 60, `${label} should have 60 samples`);
}

function nameFor(index) {
  return `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`;
}

function phoneFor(index) {
  return `812-555-${String(1000 + index).slice(-4)}`;
}

function emailFor(index) {
  return `sample${index}@example.com`;
}

function townFor(index) {
  return towns[index % towns.length];
}

function speciesFor(index) {
  return species[index % species.length];
}

function streetFor(index) {
  return streets[index % streets.length];
}

function houseFor(index) {
  return 200 + index * 7;
}

function priceFor(index) {
  return 900 + index * 25;
}

function rawNote(index) {
  return [
    nameFor(index),
    phoneFor(index),
    emailFor(index),
    `service address ${houseFor(index)}${streetFor(index)} ${townFor(index)} Indiana.`,
    `Remove one ${speciesFor(index)} tree near garage.`,
    `Option A remove and haul ${priceFor(index)}.`,
  ].join(" ");
}

function validationFromDraft(rawJson, rawInput) {
  const parsed = parseOpenAiDraft(rawJson);
  const normalizerInput = openAiDraftToNormalizerInput(parsed.draft, { rawInput });
  const validation = validateAlphaJson(normalizeToAlphaJsonV14(normalizerInput, rawInput));
  return { parsed, validation };
}

test("OpenAI draft adapter preserves separate option prices through canonical normalization", () => {
  const raw = "Gina Price. Phone 812-555-0107. Email gina.price@example.com. Service address 2018 Cedar Dr Seymour Indiana. Remove 1 maple tree by garage. Option A cut and leave wood $900. Option B remove, haul away, and cleanup $1,450.";
  const draft = {
    draft_version: "alpha_extraction_v1",
    raw_input: { customer_text: raw },
    contact: {
      customer_name: "Gina Price",
      phone: "812-555-0107",
      email: "gina.price@example.com",
    },
    job: {
      work_scope: "Remove 1 maple tree by garage.",
      tree_count: "1 tree",
      tree_count_status: "explicit",
      tree_type: "maple",
      tree_size: "",
      location_on_property: "by garage",
      work_action: "remove",
    },
    options: [
      {
        raw_label: "Option A",
        raw_text: "Option A cut and leave wood $900.",
        scope: "cut and leave wood",
        price_raw: "$900",
        price_amount: 900,
        price_status: "firm",
        haul_away: "not_stated",
        cleanup: "not_stated",
        stump_grinding: "not_stated",
        wood_handling: "leave",
        evidence: "Option A cut and leave wood $900.",
      },
      {
        raw_label: "Option B",
        raw_text: "Option B remove, haul away, and cleanup $1,450.",
        scope: "remove, haul away, and cleanup",
        price_raw: "$1,450",
        price_amount: 1450,
        price_status: "firm",
        haul_away: "included",
        cleanup: "included",
        stump_grinding: "not_stated",
        wood_handling: "haul",
        evidence: "Option B remove, haul away, and cleanup $1,450.",
      },
    ],
    number_trace: [],
    safety_access_notes: [],
    low_confidence_spans: [],
    normalization: {
      corrections_made: [],
      uncertainties: [],
      field_evidence: {},
    },
  };

  const { parsed, validation } = validationFromDraft(draft, raw);
  const alphaJson = validation.alphaJson;

  assert.equal(parsed.ok, true);
  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(alphaJson.service_options.items.map((option) => option.price.display), ["$900", "$1,450"]);
  assert.deepEqual(alphaJson.service_options.items.map((option) => option.description), [
    "cut and leave wood",
    "remove, haul away, and cleanup",
  ]);
  assert.equal(alphaJson.job.tree_details.tree_count, "1 tree");
  assert.equal(alphaJson.job.tree_details.tree_type, "maple");
});

test("OpenAI draft adapter treats labeled maybe option prices as warnings, not blockers", () => {
  const raw = "Corey Knight 812-555-0107 corey.knight@example.com. Service address 2018 Cedar Dr Seymour Indiana. Remove 2 maple trees. b maybe $1600 w stmp haull // a/$925.";
  const draft = {
    draft_version: "alpha_extraction_v1",
    raw_input: { customer_text: raw },
    contact: {
      customer_name: "Corey Knight",
      phone: "812-555-0107",
      email: "corey.knight@example.com",
      service_address: "2018 Cedar Dr Seymour Indiana",
    },
    job: {
      work_scope: "Remove 2 maple trees.",
      tree_count: "2 trees",
      tree_count_status: "found",
      tree_type: "maple",
      tree_size: "",
      location_on_property: "",
      work_action: "remove",
    },
    options: [
      {
        raw_label: "B",
        raw_text: "b maybe $1600 w stmp haull",
        scope: "stump haul",
        price_raw: "maybe $1600",
        price_amount: 1600,
        price_status: "non_firm",
        haul_away: "included",
        cleanup: "not_stated",
        stump_grinding: "included",
        wood_handling: "haul",
        evidence: "b maybe $1600 w stmp haull",
      },
      {
        raw_label: "A",
        raw_text: "a/$925",
        scope: "remove only",
        price_raw: "$925",
        price_amount: 925,
        price_status: "firm",
        haul_away: "not_stated",
        cleanup: "not_stated",
        stump_grinding: "not_stated",
        wood_handling: "not_stated",
        evidence: "a/$925",
      },
    ],
    number_trace: [],
    safety_access_notes: [],
    low_confidence_spans: [],
    normalization: {
      corrections_made: [],
      uncertainties: [],
      field_evidence: {},
    },
  };

  const { validation } = validationFromDraft(draft, raw);
  const alphaJson = validation.alphaJson;

  assert.equal(validation.can_generate_pdf, true);
  assert.deepEqual(alphaJson.service_options.items.map((option) => option.label), ["Option A", "Option B"]);
  assert.deepEqual(alphaJson.service_options.items.map((option) => option.price.display), ["$925", "$1,600"]);
  assert.equal(alphaJson.service_options.items[1].price.status, "explicit_numeric_with_soft_language");
  assert.equal(alphaJson.service_options.items[1].price.review_warning, true);
  assert.doesNotMatch(validation.blocking_errors.join(" "), /not firm|clear price/i);
});

test("OpenAI draft low-confidence spans survive canonical normalization", () => {
  const raw = "Ivy Stone 812-555-0109 ivy@example.com. 220 Oak Lane Madison IN. remove maple maybe 1700, B maybe cleanup 2900.";
  const draft = {
    draft_version: "alpha_extraction_v1",
    raw_input: { customer_text: raw },
    contact: {
      customer_name: "Ivy Stone",
      phone: "812-555-0109",
      email: "ivy@example.com",
      service_address: "220 Oak Lane Madison IN",
    },
    job: {
      tree_count: "",
      tree_count_status: "uncertain",
      tree_type: "maple",
      tree_size: "",
      work_action: "remove",
      work_scope: "remove maple",
      location_on_property: "",
    },
    options: [],
    safety_access_notes: [],
    low_confidence_spans: [
      {
        field: "price",
        text: "maybe 1700",
        reason: "Price is not firm.",
        confidence: "low",
      },
    ],
    number_trace: [
      {
        raw: "1700",
        normalized: "$1,700",
        classification: "price",
        field: "service_options.items.price",
        reason: "Maybe price.",
        context: "maybe 1700",
      },
    ],
    normalization: {
      corrections_made: [],
      uncertainties: [],
      field_evidence: { price: "maybe 1700" },
    },
  };

  const { parsed, validation } = validationFromDraft(draft, raw);

  assert.equal(parsed.ok, true);
  assert.deepEqual(validation.alphaJson.normalization.low_confidence_spans, [
    {
      field: "price",
      text: "maybe 1700",
      reason: "Price is not firm.",
      confidence: "low",
    },
  ]);
  assert.ok(validation.alphaJson.normalization.number_trace.some((trace) =>
    trace.raw === "1700" && trace.classification === "price"
  ));
});

test("60 legacy model-output shapes fail draft schema but fall back to raw-note normalization", () => {
  const samples = Array.from({ length: 60 }, (_, index) => {
    const raw = rawNote(index);
    return {
      raw,
      legacyModelOutput: {
        normalization: {
          corrected_interpretation: "Old prompt tried to write final customer prose.",
          field_evidence: { service_address: "999 Wrong Road, Nowhere, IN", price: "$9,999" },
        },
        alphaJson: {
          raw_input: { customer_text: raw },
          customer: { name: "Wrong Customer", phone: "999-999-9999" },
          job: { service_address: { display: "999 Wrong Road, Nowhere, IN" } },
          service_options: { items: [{ label: "Option Z", description: "Wrong option", price: "$9,999" }] },
          validation: { can_generate_pdf: true },
        },
      },
    };
  });
  sampleCount(samples, "legacy model-output");

  for (const sample of samples) {
    const { parsed, validation } = validationFromDraft(sample.legacyModelOutput, sample.raw);
    const alphaJson = validation.alphaJson;

    assert.equal(parsed.ok, false);
    assert.match(parsed.warnings.join(" "), /OpenAI draft failed schema validation/i);
    assert.equal(parsed.draft.raw_input.customer_text, sample.raw);
    assert.equal(validation.can_generate_pdf, true);
    assert.equal(alphaJson.raw_input.customer_text, sample.raw);
    assert.doesNotMatch(alphaJson.job.service_address.display, /Wrong Road|Nowhere/i);
    assert.doesNotMatch(alphaJson.customer.name, /Wrong Customer/i);
    assert.equal(alphaJson.service_options.items.length, 1);
  }
});

test("60 malformed drafts with valid raw notes sanitize or fall back without crashing", () => {
  const samples = Array.from({ length: 60 }, (_, index) => ({ raw: rawNote(index), index }));
  sampleCount(samples, "malformed draft");

  for (const sample of samples) {
    const badRootDraft = {
      draft_version: `wrong_version_${sample.index}`,
      raw_input: { customer_text: sample.raw },
      job: { tree_count_status: "guessed", work_action: "write_pdf" },
      options: { raw_text: "not an array" },
      safety_access_notes: "dog by gate",
    };
    const badFieldDraft = {
      draft_version: "alpha_extraction_v1",
      raw_input: { customer_text: sample.raw },
      contact: { service_address: `Option A remove and haul ${priceFor(sample.index)}` },
      job: { tree_count: "1 tree", tree_count_status: "guessed", work_action: "write_pdf" },
      options: { raw_text: "not an array" },
      safety_access_notes: "dog by gate",
      normalization: { corrections_made: "bad", uncertainties: "bad", field_evidence: [] },
    };

    const fallback = validationFromDraft(badRootDraft, sample.raw);
    assert.equal(fallback.parsed.ok, false);
    assert.equal(fallback.validation.can_generate_pdf, true);
    assert.equal(fallback.validation.alphaJson.raw_input.customer_text, sample.raw);

    const sanitized = validationFromDraft(badFieldDraft, sample.raw);
    assert.equal(sanitized.parsed.ok, true);
    assert.match(sanitized.parsed.warnings.join(" "), /invalid status|not an array/i);
    assert.equal(sanitized.validation.can_generate_pdf, true);
    assert.equal(sanitized.validation.alphaJson.raw_input.customer_text, sample.raw);
  }
});

test("60 price resolver samples distinguish firm prices from phone, route, gate, range, and non-firm text", () => {
  const firm = Array.from({ length: 15 }, (_, index) => {
    const amount = 1000 + index * 75;
    return { kind: "firm", rawPrice: index % 2 ? `$${amount.toLocaleString("en-US")}` : String(amount), expectedAmount: amount };
  });
  const nonFirm = Array.from({ length: 15 }, (_, index) => {
    const amount = 1200 + index * 50;
    const text = [
      `around ${amount}`,
      `about $${amount}`,
      `roughly ${amount}`,
      `maybe ${amount}`,
      "price depends",
    ][index % 5];
    return { kind: "non_firm", rawPrice: text };
  });
  const nonPrice = Array.from({ length: 15 }, (_, index) => {
    const text = [
      phoneFor(index),
      `gate code ${1200 + index}`,
      `Highway ${400 + index}`,
      `Route ${250 + index}`,
      `${houseFor(index)} Main St`,
    ][index % 5];
    return { kind: "not_price", rawPrice: text };
  });
  const rangeOrMissing = Array.from({ length: 15 }, (_, index) => {
    if (index % 3 === 0) return { kind: "range", rawPrice: `${1200 + index} - ${1800 + index}` };
    if (index % 3 === 1) return { kind: "missing", rawPrice: "" };
    return { kind: "missing", rawPrice: "call customer later" };
  });
  const samples = [...firm, ...nonFirm, ...nonPrice, ...rangeOrMissing];
  sampleCount(samples, "price resolver");

  for (const sample of samples) {
    const result = resolvePrice({
      rawPrice: sample.rawPrice,
      optionText: sample.kind === "firm" ? `remove and haul ${sample.rawPrice}` : sample.rawPrice,
      rawText: `Price resolver sample ${sample.rawPrice}`,
    });

    if (sample.kind === "firm") {
      assert.equal(result.priceStatus, "firm", sample.rawPrice);
      assert.equal(result.amount, sample.expectedAmount, sample.rawPrice);
      assert.match(result.display, /^\$[0-9,]+$/);
    } else if (sample.kind === "non_firm") {
      assert.equal(result.priceStatus, "non_firm", sample.rawPrice);
      assert.equal(result.amount, null);
      assert.ok(result.blockingIssues.length >= 1);
    } else if (sample.kind === "range") {
      assert.equal(result.priceStatus, "range", sample.rawPrice);
      assert.equal(result.amount, null);
    } else {
      assert.notEqual(result.priceStatus, "firm", sample.rawPrice);
      assert.equal(result.amount, null, sample.rawPrice);
    }
  }
});

test("1a helper extracts quote-cleanup shorthand price pairs before TD2", () => {
  const cases = [
    {
      id: "case_0019",
      raw: "Shane Myers 812-555-3860 1582 River Bluff Lane Hanover IN leaning tree touching service drop, quote $1100 cleanup $1,600",
      expectedAmounts: [1100, 1600],
      expectedDisplays: ["$1,100", "$1,600"],
    },
    {
      id: "case_0540",
      raw: "Shane Myers 812-555-3860 1582 River Bluff Lane Hanover IN leaning tree touching service drop, quote 2,600 cleanup 3150",
      expectedAmounts: [2600, 3150],
      expectedDisplays: ["$2,600", "$3,150"],
    },
  ];

  for (const testCase of cases) {
    const pair = extractQuoteCleanupPricePair(testCase.raw);
    assert.equal(pair.length, 2, testCase.id);
    assert.deepEqual(pair.map((option) => option.role), ["base_quote", "cleanup_option"], testCase.id);
    assert.deepEqual(pair.map((option) => option.amount), testCase.expectedAmounts, testCase.id);
    assert.deepEqual(pair.map((option) => option.display), testCase.expectedDisplays, testCase.id);
    assert.match(pair[0].scope, /base|removal/i, testCase.id);
    assert.match(pair[1].scope, /cleanup|upgraded/i, testCase.id);

    for (const option of pair) {
      assert.equal(
        testCase.raw.slice(option.evidenceSpan.start, option.evidenceSpan.end),
        option.evidenceSpan.text,
        `${testCase.id}: evidence span must point back to raw text`,
      );
      assert.doesNotMatch(option.evidenceSpan.text, /812|3860|1582/, `${testCase.id}: non-price numbers must stay excluded`);
    }
  }

  assert.deepEqual(extractQuoteCleanupPricePair("Call 812-555-3860 about cleanup tomorrow."), []);
});

test("60 address resolver samples prefer intake, format jammed addresses, and block unsafe candidates", () => {
  const intakeWins = Array.from({ length: 15 }, (_, index) => ({
    kind: "intake",
    args: {
      intake: { address: `${houseFor(index)}${streetFor(index)} ${townFor(index)} Indiana` },
      draft: { contact: { service_address: "999 Wrong Road Nowhere Indiana" } },
      rawInput: `${nameFor(index)} ${phoneFor(index)} service address 888 Wrong St Salem Indiana. Remove one tree.`,
    },
    source: "intake",
  }));
  const jammed = Array.from({ length: 15 }, (_, index) => ({
    kind: "jammed",
    args: {
      draft: { contact: { service_address: `${houseFor(index)}${streetFor(index)} ${townFor(index)} Indiana` } },
      rawInput: `${nameFor(index)} ${phoneFor(index)} Remove one ${speciesFor(index)} tree.`,
    },
    source: "openai_draft",
  }));
  const rejected = Array.from({ length: 15 }, (_, index) => ({
    kind: "rejected",
    args: {
      draft: { contact: { service_address: `Option A remove and haul ${priceFor(index)}` } },
      rawInput: `${nameFor(index)} ${phoneFor(index)} Location unavailable. Remove one ${speciesFor(index)} tree.`,
    },
    source: "none",
  }));
  const missing = Array.from({ length: 15 }, (_, index) => ({
    kind: "missing",
    args: {
      draft: { contact: { service_address: "" } },
      rawInput: `${nameFor(index)} ${phoneFor(index)} Location unavailable. Remove one ${speciesFor(index)} tree.`,
    },
    source: "none",
  }));
  const samples = [...intakeWins, ...jammed, ...rejected, ...missing];
  sampleCount(samples, "address resolver");

  for (const sample of samples) {
    const result = resolveServiceAddress(sample.args);
    assert.equal(result.source, sample.source, sample.kind);

    if (sample.kind === "intake" || sample.kind === "jammed") {
      assert.equal(result.status, "resolved");
      assert.match(result.value, /\d+\s+[A-Za-z]/);
      assert.match(result.value, /,\s*(?:Madison|Hanover|North Vernon|Salem|Seymour|Austin|Scottsburg|Paoli|Bedford|Charlestown),\s*Indiana/);
      assert.deepEqual(result.blockingIssues, []);
    } else {
      assert.match(result.status, /missing|rejected/);
      assert.equal(result.value, "");
      assert.ok(result.blockingIssues.includes("Missing service address."));
      if (sample.kind === "rejected") assert.match(result.warnings.join(" "), /Rejected openai_draft address candidate/i);
    }
  }
});

test("address resolver formats explicit unknown city with Indiana state", () => {
  const samples = [
    ["83 River Ave Jeffersonville IN", "83 River Ave, Jeffersonville, IN"],
    ["707 Walnut Street Corydon IN", "707 Walnut Street, Corydon, IN"],
    ["62 Roofline Rd New Albany IN", "62 Roofline Rd, New Albany, IN"],
  ];

  for (const [serviceAddress, expected] of samples) {
    const result = resolveServiceAddress({
      draft: { contact: { service_address: serviceAddress } },
      rawInput: `Customer 812-555-0101 service address ${serviceAddress}. Remove one tree.`,
    });

    assert.equal(result.status, "resolved");
    assert.equal(result.source, "openai_draft");
    assert.equal(result.value, expected);
    assert.deepEqual(result.blockingIssues, []);
  }
});

test("60 debug pipeline samples expose raw input, raw draft, schema warnings, AlphaJSON, validation, and rendered fields", () => {
  const samples = Array.from({ length: 60 }, (_, index) => ({
    raw: rawNote(index),
    index,
    validation: {
      can_generate_pdf: index % 2 === 0,
      blocking_errors: index % 2 === 0 ? [] : ["Missing service address."],
      follow_ups: index % 2 === 0 ? [] : ["What is the exact service address for this job?"],
      structured_follow_ups: index % 2 === 0 ? [] : [{ id: "missing_service_address", blocks_pdf: true }],
      warnings: index % 3 === 0 ? ["Safety/access note: Gate blocked."] : [],
    },
  }));
  sampleCount(samples, "debug pipeline");

  assert.deepEqual(buildDebugPipelinePayload({ enabled: false, rawTd1Text: "hidden" }), {});

  for (const sample of samples) {
    const payload = buildDebugPipelinePayload({
      enabled: true,
      rawTd1Text: sample.raw,
      rawOpenAiDraftJson: { draft_version: "alpha_extraction_v1", sample: sample.index },
      draftSchemaWarnings: [`schema warning ${sample.index}`],
      alphaJson: {
        raw_input: { customer_text: sample.raw },
        job: { description: `Rendered job ${sample.index}` },
        service_options: {
          items: sample.index % 2 === 0 ? [{ label: "Option A" }] : [],
        },
        normalization: {
          uncertainties: sample.index % 2 === 0 ? [{ field: "price", issue: "Review price." }] : [],
        },
      },
      validation: sample.validation,
      mocked: sample.index % 4 === 0,
      note: `note ${sample.index}`,
      error: sample.index % 10 === 0 ? `error ${sample.index}` : "",
    });

    assert.equal(payload.debugPipeline.rawTd1Input.customer_text, sample.raw);
    assert.equal(payload.debugPipeline.rawOpenAiDraftJson.sample, sample.index);
    assert.deepEqual(payload.debugPipeline.draftSchemaWarnings, [`schema warning ${sample.index}`]);
    assert.equal(payload.debugPipeline.cleanedCanonicalAlphaJson.raw_input.customer_text, sample.raw);
    assert.deepEqual(payload.debugPipeline.validationResult.structured_follow_ups, sample.validation.structured_follow_ups);
    assert.deepEqual(payload.debugPipeline.validationResult.follow_ups, sample.validation.follow_ups);
    assert.deepEqual(payload.debugPipeline.validationResult.warnings, sample.validation.warnings);
    assert.deepEqual(payload.debugPipeline.stages.map((stage) => stage.label), [
      "Raw TD1 input",
      sample.index % 4 === 0 ? "Local draft parser" : "OpenAI draft",
      "TD2 normalization",
      "TD2 validation",
    ]);
    assert.equal(
      payload.debugPipeline.stages[2].status,
      sample.index % 2 === 0
        ? "0 corrections, 1 uncertainty flags, 0 low-confidence spans, 0 number traces, 1 options"
        : "0 corrections, 0 uncertainty flags, 0 low-confidence spans, 0 number traces, 0 options",
    );
    assert.match(payload.debugPipeline.source, /openai|local-draft-parser/);
  }
});

test("debug pipeline can expose conservative TD1 text cleanup without customer output", () => {
  const payload = buildDebugPipelinePayload({
    enabled: true,
    rawTd1Text: "  remvoe oak 2500$  ",
    rawOpenAiDraftJson: {},
    alphaJson: { normalization: {}, service_options: { items: [] } },
    validation: { can_generate_pdf: false, blocking_errors: ["Missing service address."], follow_ups: [], warnings: [] },
    mocked: true,
    textCleanupResult: {
      rawInput: "  remvoe oak 2500$  ",
      cleanedText: "remove oak $2500",
      changes: [
        { type: "whitespace", before: "  ", after: "", reason: "Trimmed.", confidence: "high" },
        { type: "spelling", before: "remvoe", after: "remove", reason: "Corrected typo.", confidence: "high" },
      ],
      warnings: ["numbers_present_preserved"],
    },
    contactNormalizationResult: {
      email: { value: "sam@example.com", candidates: [{ valid: true, accepted: true }], warnings: [] },
      phone: { value: "8125551212", display: "812-555-1212", candidates: [{ valid: true, accepted: true }], warnings: [] },
      low_confidence_spans: [],
      number_trace: [],
    },
    optionPriceCandidateView: {
      raw_customer_note: "remove oak $2500",
      pre_ai_option_price_candidate_clues: {
        money_like_numbers: [{ raw: "$2500", price_display: "$2,500" }],
        option_boundary_clues: [],
        price_scope_ambiguity_warnings: [],
      },
      rendered_view: "Pre-AI option-price candidate clues:",
    },
  });

  assert.equal(payload.debugPipeline.rawTd1Input.customer_text, "  remvoe oak 2500$  ");
  assert.equal(payload.debugPipeline.td1TextCleanup.cleanedText, "remove oak $2500");
  assert.deepEqual(payload.debugPipeline.td1TextCleanup.warnings, ["numbers_present_preserved"]);
  assert.equal(payload.debugPipeline.td1ContactNormalization.phone.display, "812-555-1212");
  assert.equal(payload.debugPipeline.td1OptionPriceCandidateView.pre_ai_option_price_candidate_clues.money_like_numbers[0].price_display, "$2,500");
  assert.deepEqual(payload.debugPipeline.stages.map((stage) => stage.label), [
    "Raw TD1 input",
    "TD1 text cleanup",
    "TD1 contact normalization",
    "TD1 option/price clues",
    "Local draft parser",
    "TD2 normalization",
    "TD2 validation",
  ]);
  assert.equal(payload.debugPipeline.stages[1].status, "2 safe changes, 1 warnings");
  assert.equal(payload.debugPipeline.stages[2].status, "1 email candidates, 1 phone candidates");
  assert.equal(payload.debugPipeline.stages[3].status, "1 money-like numbers, 0 option boundaries, 0 warnings");
});

test("60 structured follow-up samples keep stable IDs and PDF-blocking flags", () => {
  const definitions = [
    { message: "Missing service address.", expectedId: "missing_service_address", warning: false },
    { message: "Service address looks unclear.", expectedId: "unclear_service_address", warning: false },
    { message: "Missing customer phone or email.", expectedId: "missing_contact_method", warning: false },
    { message: "Tree count is unclear.", expectedId: "vague_tree_count", warning: false },
    { message: "Missing tree count or clear scope.", expectedId: "missing_tree_count_or_scope", warning: false },
    { message: "Missing job description.", expectedId: "missing_job_description", warning: false },
    { message: "Missing priced service option.", expectedId: "missing_priced_option", warning: false },
    { message: "Option A is missing a clear price.", expectedId: "missing_option_price", warning: false },
    { message: "Unclear work scope: remove, trim, or another service.", expectedId: "unclear_work_scope", warning: false },
    { message: "Price is not firm enough for a customer-facing estimate.", expectedId: "non_firm_price", warning: false },
    { message: "Stump inclusion is unclear.", expectedId: "unclear_stump_inclusion", warning: false },
    { message: "Cleanup or haul-away scope is unclear.", expectedId: "unclear_cleanup_or_haul", warning: false },
    { message: "Safety/access note: Aggressive dog in backyard.", expectedId: "safety_access_warning", warning: true },
    { message: "One or more option descriptions may need cleanup.", expectedId: "possible_dirty_option_text", warning: true },
    { message: "Service address may need city or state.", expectedId: "address_may_need_city_state", warning: true },
  ];
  const samples = Array.from({ length: 60 }, (_, index) => definitions[index % definitions.length]);
  sampleCount(samples, "structured follow-up");

  for (const sample of samples) {
    const issues = buildStructuredFollowUps({
      alphaJson: { raw_input: { customer_text: rawNote(samples.indexOf(sample)) } },
      blocking_errors: sample.warning ? [] : [sample.message],
      warnings: sample.warning ? [sample.message] : [],
      follow_ups: [],
    });
    const issue = issues.find((item) => item.id === sample.expectedId);

    assert.ok(issue, sample.expectedId);
    assert.equal(issue.blocks_pdf, !sample.warning, sample.expectedId);
    assert.equal(issue.severity, sample.warning ? "warning" : "blocking", sample.expectedId);
    assert.ok(issue.message);
    assert.ok(issue.question);
    assert.ok(issue.ui_target);
  }
});
