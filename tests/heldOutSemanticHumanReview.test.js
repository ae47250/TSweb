import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyCanonicalServiceAssembler,
} from "../lib/canonicalServiceAssembler.js";
import { validateAlphaJson } from "../lib/validateJson.js";
import { normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../lib/priceReconciliation.js";

const FIXTURE_PATH = "tests/fixtures/held-out-semantic-human-review-verified.json";
const REPLAY_PATH = "reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl";
const EXPECTED_SOURCE_SHA256 = "7fe2a283f9ba03fd19f002ca1f4bd7ab07974cd8426511d7349a6bb783cabdc1";
const QUANTITY_DEFECT_IDS = new Set(["obs_0041", "obs_0050", "obs_0069"]);
const QUANTITY_CONTROL_IDS = new Set(["obs_0015", "obs_0025", "obs_0051"]);
const HELD_OUT_22_IDS = [
  "obs_0022",
  "obs_0033",
  "obs_0035",
  "obs_0051",
  "obs_0062",
  "obs_0069",
  "obs_0076",
  "obs_0092",
  "obs_0119",
  "obs_0137",
  "obs_0179",
  "obs_0184",
  "obs_0190",
  "obs_0214",
  "obs_0354",
  "obs_0357",
  "obs_0507",
  "obs_0607",
  "obs_0620",
  "obs_0660",
  "obs_0787",
  "obs_0810",
];
const DUPLICATE_OR_REVERSED_LABEL_IDS = new Set([
  "obs_0022", "obs_0035", "obs_0051", "obs_0119", "obs_0179", "obs_0184", "obs_0214",
  "obs_0354", "obs_0507", "obs_0607", "obs_0620", "obs_0660", "obs_0787", "obs_0810",
]);
const HELD_OUT_QUANTITY_IDS = new Set(["obs_0069", "obs_0137"]);
const DUPLICATED_SCOPE_IDS = new Set(["obs_0357"]);
const STORM_SCOPE_IDS = new Set(["obs_0033", "obs_0062", "obs_0076", "obs_0092", "obs_0190"]);
const QUALIFIER_IDS = new Set(["obs_0022", "obs_0051", "obs_0119", "obs_0179", "obs_0184", "obs_0214", "obs_0660", "obs_0787"]);

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

function replayRowsById() {
  return new Map(readJsonl(REPLAY_PATH).map((row) => [row.id, row]));
}

function alphaJsonFor(row) {
  return row.replay_after_implementation?.alphaJson_after_normalization;
}

function optionSummary(option = {}) {
  return {
    label: option.label || "",
    title: option.title || "",
    description: option.description || "",
    price: option.price?.display || "",
    price_numeric: option.price?.amount ?? null,
  };
}

function confirmedSummary(option = {}) {
  return {
    label: option.label || "",
    title: option.title || "",
    description: option.description || "",
    price: option.price || "",
    price_numeric: option.price_numeric ?? null,
  };
}

function customerOptionText(options = []) {
  return options.map((option) => `${option.title} ${option.description}`).join(" ");
}

function normalizedText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function confirmedQuantity(caseRecord) {
  const text = customerOptionText(caseRecord.confirmed_customer_facing_options || []).toLowerCase();
  return text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)\b/)?.[1] || "";
}

function optionsMentionQuantity(options = [], quantity = "") {
  if (!quantity) return true;
  return new RegExp(`\\b${quantity}\\b`, "i").test(customerOptionText(options));
}

function requiredQualifiersFromRaw(raw = "") {
  const text = normalizedText(raw);
  const qualifiers = [];
  if (/\btouching (?:the )?service line\b|\bservice line\b/.test(text)) qualifiers.push("touching the service line");
  if (/\bover (?:the )?roof\b/.test(text)) qualifiers.push("over the roof");
  if (/\bnear (?:the )?driveway\b/.test(text)) qualifiers.push("near the driveway");
  if (/\bby (?:the )?shed\b/.test(text)) qualifiers.push("by the shed");
  if (/\bback yard\b/.test(text)) qualifiers.push("back yard");
  if (/\bleaning toward (?:the )?garage\b/.test(text)) qualifiers.push("leaning toward the garage");
  return qualifiers;
}

function assertRequiredQualifiers(caseId, raw, options) {
  const optionTexts = options.map((option) => normalizedText(`${option.title} ${option.description}`));
  for (const qualifier of requiredQualifiersFromRaw(raw)) {
    const normalizedQualifier = normalizedText(qualifier);
    assert.ok(optionTexts.every((text) => text.includes(normalizedQualifier)), `${caseId} missing qualifier ${qualifier}`);
  }
}

function assertFixtureStructure(caseRecord, actual, expected) {
  if (requiredQualifiersFromRaw(caseRecord.raw_customer_note).length) {
    assert.deepEqual(
      actual.map(({ label, title, price, price_numeric }) => ({ label, title, price, price_numeric })),
      expected.map(({ label, title, price, price_numeric }) => ({ label, title, price, price_numeric })),
      caseRecord.observation_id,
    );
    return;
  }
  assert.deepEqual(actual, expected, caseRecord.observation_id);
}

function rawValidation(row) {
  const alphaJson = reconcileSidecarPrices(
    normalizeToAlphaJsonV14({}, row.input, { address: "123 Test St, Madison, IN" }),
    buildOptionPriceCandidateView(row.input),
  );
  return validateAlphaJson(alphaJson);
}

function withCompleteTestAddress(alphaJson) {
  const next = structuredClone(alphaJson);
  next.job = next.job || {};
  next.job.service_address = { ...(next.job.service_address || {}), display: "123 Test St, Madison, IN" };
  return next;
}

function assertBaseScopePreserved(caseId, optionA, optionB) {
  const baseWords = normalizedText(optionA.description)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["and", "the", "with"].includes(word));
  const expanded = normalizedText(optionB.description);
  for (const word of baseWords) {
    assert.ok(expanded.includes(word), `${caseId} Option B dropped base-scope word ${word}`);
  }
}

function assertNoFinalScopeLeak(caseId, options) {
  const text = normalizedText(options.map((option) => option.description).join(" "));
  assert.equal(/@|\b(?:phone|email|customer|address|service address)\b/.test(text), false, `${caseId} leaked contact/admin text`);
  assert.equal(/\b(?:columbus|bedford|franklin|bargersville|martinsville|bloomington|greensburg|greenwood|nashville)\s+in\b/.test(text), false, `${caseId} leaked city/state text`);
  assert.equal(/\boption [a-e]\b/.test(text), false, `${caseId} leaked parser option label`);
  assert.equal(/\b(ornamental pears removal|cleanup haul away cleanup haul away)\b/.test(text), false, `${caseId} contains malformed duplicated wording`);
}

test("generated held-out semantic fixture preserves the verified source hash", () => {
  const data = fixture();

  assert.equal(data.source_sha256, EXPECTED_SOURCE_SHA256);
  assert.equal(data.case_count, 56);
  assert.equal(data.cases.length, 56);
  assert.equal(new Set(data.cases.map((item) => item.observation_id)).size, 56);
});

test("canonical assembler constructs all 56 human-confirmed final option structures", () => {
  const data = fixture();
  const replayById = replayRowsById();

  for (const caseRecord of data.cases) {
    const replay = replayById.get(caseRecord.observation_id);
    assert.ok(replay, `Missing replay row ${caseRecord.observation_id}`);

    const applied = applyCanonicalServiceAssembler(alphaJsonFor(replay), { force: true });
    const actual = applied.service_options.items.map(optionSummary);
    const expected = caseRecord.confirmed_customer_facing_options.map(confirmedSummary);

    assertFixtureStructure(caseRecord, actual, expected);
    assert.ok(expected[1].price_numeric > expected[0].price_numeric, `${caseRecord.observation_id} confirmed Option B is not cumulative`);
    assertRequiredQualifiers(caseRecord.observation_id, caseRecord.raw_customer_note, applied.service_options.items);

    if (caseRecord.safety_access_warning) {
      const warnings = applied.normalization?.canonical_service_assembler?.safety_access_warnings || [];
      assert.ok(warnings.some((warning) => warning.warning === caseRecord.safety_access_warning), `${caseRecord.observation_id} did not preserve safety warning`);
    }
  }
});

test("structural validator separates pre-canonical diagnostics from final 56 options", () => {
  const data = fixture();
  const replayById = replayRowsById();
  const safetyLeakIds = new Set(data.cases
    .filter((caseRecord) => caseRecord.safety_access_leaks_into_current_customer_scope)
    .map((caseRecord) => caseRecord.observation_id));
  let dependentAddOnDiagnostics = 0;

  for (const caseRecord of data.cases) {
    const validation = validateAlphaJson(withCompleteTestAddress(alphaJsonFor(replayById.get(caseRecord.observation_id))));
    const codes = new Set(validation.structural_error_codes);
    const preCodes = new Set(validation.alphaJson.validation.pre_canonical_diagnostic_codes || []);

    assert.equal(validation.can_generate_pdf, true, `${caseRecord.observation_id} final output should be PDF-ready`);
    assert.equal(validation.alphaJson.validation.final_blocking_errors.length, 0, `${caseRecord.observation_id} should have no final blocking errors`);
    if (preCodes.has("DEPENDENT_ADDON_STANDALONE")) {
      dependentAddOnDiagnostics += 1;
      assert.ok(
        preCodes.has("MISSING_EXPANDED_CHOICE") ||
          preCodes.has("EXPANDED_PRICE_MISMATCH") ||
          preCodes.has("EXPANDED_SCOPE_INCOMPLETE") ||
          preCodes.has("INCREMENTAL_ADDON_USED_AS_TOTAL"),
        `${caseRecord.observation_id} dependent add-on diagnostic lacks expanded-option detail`,
      );
    }

    if (safetyLeakIds.has(caseRecord.observation_id)) {
      assert.equal(codes.has("SAFETY_TEXT_IN_CUSTOMER_SCOPE"), false, `${caseRecord.observation_id} should not receive safety structural diagnostic`);
      const warningText = [
        ...(validation.structural_warnings || []),
        ...(validation.warnings || []),
      ].join(" ");
      assert.ok(
        /Safety\/access note:/i.test(warningText),
        `${caseRecord.observation_id} missing safety/access warning`,
      );
    }
    if (QUANTITY_DEFECT_IDS.has(caseRecord.observation_id) &&
        !optionsMentionQuantity(validation.alphaJson.service_options?.items || [], confirmedQuantity(caseRecord))) {
      assert.ok(preCodes.has("EXPLICIT_QUANTITY_OMITTED_OR_CHANGED"), `${caseRecord.observation_id} missing quantity-loss diagnostic`);
    }
    if (QUANTITY_CONTROL_IDS.has(caseRecord.observation_id)) {
      assert.equal(codes.has("EXPLICIT_QUANTITY_OMITTED_OR_CHANGED"), false, `${caseRecord.observation_id} should not receive quantity-loss diagnostic`);
    }
  }

  assert.ok(dependentAddOnDiagnostics > 0, "expected at least one remaining dependent add-on diagnostic in current replay");
});

test("held-out 22 raw notes produce final TD2 A/B options with preserved qualifiers", () => {
  const replayById = replayRowsById();

  for (const caseId of HELD_OUT_22_IDS) {
    const row = replayById.get(caseId);
    assert.ok(row, `Missing replay row ${caseId}`);
    const validation = rawValidation(row);
    const options = validation.alphaJson.service_options.items;
    const [optionA, optionB] = options;
    const expectedBase = row.expected[0].amount;
    const expectedAddOn = row.expected[1].amount;

    assert.equal(options.length, 2, `${caseId} final option count`);
    assert.deepEqual(options.map((option) => option.label), ["Option A", "Option B"], `${caseId} labels`);
    assert.deepEqual(options.map((option) => option.price.amount), [expectedBase, expectedBase + expectedAddOn], `${caseId} prices`);
    assert.equal(validation.can_generate_pdf, true, `${caseId} should be PDF-ready`);
    assert.deepEqual(validation.structural_error_codes, [], `${caseId} final structural errors`);
    assert.equal(validation.alphaJson.validation.final_blocking_errors.length, 0, `${caseId} final blocking errors`);
    assertBaseScopePreserved(caseId, optionA, optionB);
    assertNoFinalScopeLeak(caseId, options);

    if (DUPLICATE_OR_REVERSED_LABEL_IDS.has(caseId)) {
      assert.equal(new Set(options.map((option) => option.label)).size, 2, `${caseId} duplicate labels survived`);
      assert.equal(optionA.price.amount < optionB.price.amount, true, `${caseId} ordering not base then cumulative`);
    }
    if (HELD_OUT_QUANTITY_IDS.has(caseId)) {
      assert.match(`${optionA.description} ${optionB.description}`, /\bthree\b/i, `${caseId} lost explicit quantity`);
    }
    if (DUPLICATED_SCOPE_IDS.has(caseId)) {
      assert.notEqual(normalizedText(optionA.description), normalizedText(optionB.description), `${caseId} A/B scopes are identical`);
    }
    if (STORM_SCOPE_IDS.has(caseId)) {
      assert.match(optionA.description, /storm damage in the back yard/i, `${caseId} vague storm cleanup scope`);
      assert.match(optionB.description, /storm damage in the back yard/i, `${caseId} vague storm cleanup expanded scope`);
    }
    if (QUALIFIER_IDS.has(caseId)) {
      assertRequiredQualifiers(caseId, row.input, options);
    }
  }
});

test("canonical construction is not driven by observation ID, contact, or address fields", () => {
  const data = fixture();
  const replayById = replayRowsById();
  const caseRecord = data.cases.find((item) => item.observation_id === "obs_0004");
  const alphaJson = structuredClone(alphaJsonFor(replayById.get(caseRecord.observation_id)));
  const baseline = applyCanonicalServiceAssembler(alphaJson, { force: true }).service_options.items.map(optionSummary);

  alphaJson.customer.name = "Different Synthetic Name";
  alphaJson.customer.email = "different@example.invalid";
  alphaJson.customer.phone_primary = "812-555-0101";
  alphaJson.job.service_address.display = "9999 Different Rd, Testville, IN";
  alphaJson.document.number = "EST-TEST-HARDCODING";

  const mutated = applyCanonicalServiceAssembler(alphaJson, { force: true }).service_options.items.map(optionSummary);
  assert.deepEqual(mutated, baseline);
});
