import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyCanonicalServiceAssembler,
} from "../lib/canonicalServiceAssembler.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const FIXTURE_PATH = "tests/fixtures/held-out-semantic-human-review-verified.json";
const REPLAY_PATH = "reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl";
const EXPECTED_SOURCE_SHA256 = "7fe2a283f9ba03fd19f002ca1f4bd7ab07974cd8426511d7349a6bb783cabdc1";
const QUANTITY_DEFECT_IDS = new Set(["obs_0041", "obs_0050", "obs_0069"]);
const QUANTITY_CONTROL_IDS = new Set(["obs_0015", "obs_0025", "obs_0051"]);

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

function confirmedQuantity(caseRecord) {
  const text = customerOptionText(caseRecord.confirmed_customer_facing_options || []).toLowerCase();
  return text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)\b/)?.[1] || "";
}

function optionsMentionQuantity(options = [], quantity = "") {
  if (!quantity) return true;
  return new RegExp(`\\b${quantity}\\b`, "i").test(customerOptionText(options));
}

function assertNoCustomerSafetyLeak(caseRecord, options) {
  const warning = caseRecord.safety_access_warning || "";
  if (!warning) return;
  const text = customerOptionText(options).toLowerCase();
  for (const phrase of [
    "service line",
    "over the roof",
    "near the driveway",
    "leaning toward the garage",
  ]) {
    assert.equal(text.includes(phrase), false, `${caseRecord.observation_id} leaked ${phrase}`);
  }
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

    assert.deepEqual(actual, expected, caseRecord.observation_id);
    assert.ok(expected[1].price_numeric > expected[0].price_numeric, `${caseRecord.observation_id} confirmed Option B is not cumulative`);
    assertNoCustomerSafetyLeak(caseRecord, applied.service_options.items);

    if (caseRecord.safety_access_warning) {
      const warnings = applied.normalization?.canonical_service_assembler?.safety_access_warnings || [];
      assert.ok(warnings.some((warning) => warning.warning === caseRecord.safety_access_warning), `${caseRecord.observation_id} did not preserve safety warning`);
    }
  }
});

test("structural validator reports remaining supported defects on the current 56 options", () => {
  const data = fixture();
  const replayById = replayRowsById();
  const safetyLeakIds = new Set(data.cases
    .filter((caseRecord) => caseRecord.safety_access_leaks_into_current_customer_scope)
    .map((caseRecord) => caseRecord.observation_id));
  let dependentAddOnDiagnostics = 0;

  for (const caseRecord of data.cases) {
    const validation = validateAlphaJson(alphaJsonFor(replayById.get(caseRecord.observation_id)));
    const codes = new Set(validation.structural_error_codes);

    assert.equal(validation.can_generate_pdf, true, "shadow-only validation should not block while enforcement flag is off");
    if (codes.has("DEPENDENT_ADDON_STANDALONE")) {
      dependentAddOnDiagnostics += 1;
      assert.ok(
        codes.has("MISSING_EXPANDED_CHOICE") ||
          codes.has("EXPANDED_PRICE_MISMATCH") ||
          codes.has("EXPANDED_SCOPE_INCOMPLETE") ||
          codes.has("INCREMENTAL_ADDON_USED_AS_TOTAL"),
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
      assert.ok(codes.has("EXPLICIT_QUANTITY_OMITTED_OR_CHANGED"), `${caseRecord.observation_id} missing quantity-loss diagnostic`);
    }
    if (QUANTITY_CONTROL_IDS.has(caseRecord.observation_id)) {
      assert.equal(codes.has("EXPLICIT_QUANTITY_OMITTED_OR_CHANGED"), false, `${caseRecord.observation_id} should not receive quantity-loss diagnostic`);
    }
  }

  assert.ok(dependentAddOnDiagnostics > 0, "expected at least one remaining dependent add-on diagnostic in current replay");
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
