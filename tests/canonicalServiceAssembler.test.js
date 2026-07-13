import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CANONICAL_SEMANTIC_ERROR_CODES,
  approvalBindingForCanonicalEstimate,
  assertCanonicalAssemblerInput,
  buildCanonicalAssemblerInput,
  buildCanonicalShadowEstimate,
  canonicalSemanticHash,
  canonicalServiceAssemblerEnabled,
  findForbiddenBuilderInputPaths,
  inferServiceKindDetails,
  validateCanonicalServiceEstimate,
} from "../lib/canonicalServiceAssembler.js";

const REPLAY_PATH = "reports/live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl";

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replayRow(id) {
  const row = readJsonl(REPLAY_PATH).find((candidate) => candidate.id === id);
  assert.ok(row, `Missing replay row ${id}`);
  return row;
}

function alphaJsonFor(id) {
  return replayRow(id).current.alphaJson_after_normalization;
}

function renderedPairs(shadow) {
  return shadow.canonicalServiceItems.items.map((item) => ({
    kind: item.service_kind,
    amount: item.amount,
    relationship: item.relationship_type,
    source: item.price_occurrence_id,
    reason: item.source?.service_kind_reason_code || "",
    evidence: item.source?.service_kind_evidence_text || "",
    title: item.service_kind,
    description: item.source?.local_text || "",
  }));
}

function expectedPairsFor(id) {
  return replayRow(id).expected.map((item) => ({
    kind: item.kind,
    amount: item.amount,
  }));
}

function canonicalItem({
  stable_id = "item_1",
  service_kind = "tree_removal",
  amount = 900,
  relationship_type = "primary_service",
} = {}) {
  return {
    stable_id,
    service_kind,
    amount,
    display: `$${amount.toLocaleString("en-US")}`,
    price_occurrence_id: stable_id,
    relationship_type,
    supporting_price_occurrence_ids: [stable_id],
    supporting_scope_evidence: [{ evidence_id: `${stable_id}.local_text`, text: "tree removal", kind: "test" }],
    scope: {},
    uncertainty_status: "resolved",
    uncertainty_reasons: [],
    source: { service_kind },
  };
}

function renderedOption(item, description = "Remove tree.") {
  return {
    label: "Option A",
    title: item.service_kind === "tree_trim" ? "Tree Trimming" : "Tree Removal",
    description,
    price: {
      amount: item.amount,
      display: item.display,
    },
    canonical_service_item: {
      stable_id: item.stable_id,
      service_kind: item.service_kind,
      relationship_type: item.relationship_type,
      supporting_price_occurrence_ids: item.supporting_price_occurrence_ids,
      scope: {},
      uncertainty_status: item.uncertainty_status,
      uncertainty_reasons: item.uncertainty_reasons,
    },
  };
}

const PREVIOUS_UNSAFE_READY_CASE_IDS = [
  "obs_0401",
  "obs_0429",
  "obs_0456",
  "obs_0460",
  "obs_0465",
  "obs_0491",
  "obs_0543",
  "obs_0552",
  "obs_0606",
  "obs_0652",
  "obs_0667",
  "obs_0674",
  "obs_0679",
  "obs_0696",
];

const PREVIOUS_SCOPE_CONFLICT_CASE_IDS = [
  "obs_0405",
  "obs_0427",
  "obs_0431",
  "obs_0442",
  "obs_0488",
  "obs_0498",
  "obs_0500",
  "obs_0504",
  "obs_0518",
  "obs_0521",
  "obs_0526",
  "obs_0527",
  "obs_0532",
  "obs_0536",
  "obs_0563",
  "obs_0564",
  "obs_0587",
  "obs_0594",
  "obs_0596",
  "obs_0609",
  "obs_0630",
  "obs_0632",
  "obs_0645",
  "obs_0657",
  "obs_0658",
  "obs_0692",
  "obs_0693",
  "obs_0695",
];

test("canonical service assembler is disabled unless explicitly flagged", () => {
  assert.equal(canonicalServiceAssemblerEnabled({}), false);
  assert.equal(canonicalServiceAssemblerEnabled({ ENABLE_CANONICAL_SERVICE_ASSEMBLER: "false" }), false);
  assert.equal(canonicalServiceAssemblerEnabled({ ENABLE_CANONICAL_SERVICE_ASSEMBLER: "true" }), true);
});

test("blank service-kind evidence returns structured unsupported details", () => {
  assert.deepEqual(inferServiceKindDetails("   "), {
    service_kind: "",
    reason_code: "no_supported_service_words",
    evidence_text: "",
    normalized_evidence_text: "",
    ignored_boilerplate: false,
  });
});

test("assembler input contract rejects benchmark leakage fields", () => {
  const input = {
    normalizedJobFacts: { description: "Remove tree.", expected: [{ kind: "tree_removal" }] },
    typedPriceEvidence: [],
    extractedRelationships: {},
  };

  assert.deepEqual(findForbiddenBuilderInputPaths(input), ["normalizedJobFacts.expected"]);
  assert.throws(() => assertCanonicalAssemblerInput(input), /forbidden benchmark fields/i);
});

test("benchmark expected labels cannot change canonical output", () => {
  const row = replayRow("obs_0909");
  const first = buildCanonicalShadowEstimate(row.current.alphaJson_after_normalization);
  const tamperedRow = clone(row);
  tamperedRow.expected = [
    { expected_id: "expected_1", kind: "haul_away", amount: 8, display: "$8" },
  ];
  const second = buildCanonicalShadowEstimate(tamperedRow.current.alphaJson_after_normalization);

  assert.deepEqual(renderedPairs(second), renderedPairs(first));
  assert.equal(second.input_hash, first.input_hash);
});

test("removing benchmark expected labels cannot change canonical output", () => {
  const row = replayRow("obs_0909");
  const first = buildCanonicalShadowEstimate(row.current.alphaJson_after_normalization);
  const tamperedRow = clone(row);
  delete tamperedRow.expected;
  const second = buildCanonicalShadowEstimate(tamperedRow.current.alphaJson_after_normalization);

  assert.deepEqual(renderedPairs(second), renderedPairs(first));
  assert.equal(second.input_hash, first.input_hash);
});

test("obs_0907 creates one tree trimming option and ignores the address-shaped same amount", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0907"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_trim", amount: 1100 },
  ]);
  assert.equal(shadow.renderedOptions[0].title, "Tree Trimming");
  assert.match(shadow.renderedOptions[0].description, /trim/i);
  assert.doesNotMatch(shadow.renderedOptions[0].description, /remove/i);
});

test("obs_0839 keeps tree removal and stump grinding without stale $8 output", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0839"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_removal", amount: 2050 },
    { kind: "stump_grinding", amount: 450 },
  ]);
  assert.doesNotMatch(JSON.stringify(shadow.renderedOptions), /\$8|\"amount\":8/);
});

test("obs_0909 keeps only priced service options and excludes contact-like fragments", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0909"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_removal", amount: 1700 },
    { kind: "stump_grinding", amount: 900 },
  ]);
  assert.doesNotMatch(JSON.stringify(shadow.renderedOptions), /2@yahoo|Option D/i);
});

test("obs_0007 tree trim does not become tree removal", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0007"));

  assert.equal(shadow.renderedOptions[0].canonical_service_item.service_kind, "tree_trim");
  assert.equal(shadow.renderedOptions[0].price.amount, 800);
  assert.doesNotMatch(shadow.renderedOptions[0].description, /remove/i);
});

test("obs_0016 brush cleanup wording stays cleanup, not removal", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0016"));
  const brushOption = shadow.renderedOptions.find((option) => /brush/i.test(`${option.title} ${option.description}`));

  assert.ok(brushOption);
  assert.equal(brushOption.price.amount, 1700);
  assert.match(brushOption.title, /brush cleanup/i);
  assert.match(brushOption.description, /clean up (?:the )?brush/i);
  assert.doesNotMatch(brushOption.description, /Remove brush/i);
});

test("boilerplate stump/haul phrase does not override limb-removal amount evidence", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0401"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "limb_removal", amount: 700 },
    { kind: "haul_away", amount: 300 },
  ]);
  assert.equal(shadow.renderedOptions[0].canonical_service_item.source, undefined);
  assert.equal(shadow.renderedOptions[0].canonical_service_item.price_occurrence_id, "price_2");
  assert.equal(shadow.renderedOptions[0].canonical_service_item.relationship_type, "component_of");
  assert.match(shadow.renderedOptions[0].canonical_service_item.service_kind_evidence_text, /limb removal/i);
  assert.match(shadow.renderedOptions[0].description, /remove|cut up/i);
  assert.equal(shadow.semanticValidation.can_generate_pdf, true);
});

test("boilerplate stump/haul phrase does not override tree-trim amount evidence", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0456"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_trim", amount: 1000 },
    { kind: "haul_away", amount: 125 },
  ]);
  assert.equal(shadow.renderedOptions[0].canonical_service_item.price_occurrence_id, "price_2");
  assert.match(shadow.renderedOptions[0].canonical_service_item.service_kind_evidence_text, /tree trim/i);
  assert.match(shadow.renderedOptions[0].description, /trim/i);
  assert.doesNotMatch(shadow.renderedOptions[0].description, /grind/i);
  assert.equal(shadow.semanticValidation.can_generate_pdf, true);
});

test("boilerplate stump/haul phrase does not override tree-removal plus brush-cleanup evidence", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0460"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_removal", amount: 1500 },
    { kind: "brush_cleanup", amount: 400 },
  ]);
  assert.equal(shadow.renderedOptions[0].canonical_service_item.price_occurrence_id, "price_2");
  assert.match(shadow.renderedOptions[1].canonical_service_item.service_kind_evidence_text, /brush cleanup/i);
  assert.match(shadow.renderedOptions[1].description, /clean up brush/i);
  assert.equal(shadow.semanticValidation.can_generate_pdf, true);
});

test("boilerplate stump/haul phrase preserves tree-removal plus stump-grinding evidence", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0405"));

  assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), [
    { kind: "tree_removal", amount: 2150 },
    { kind: "stump_grinding", amount: 500 },
  ]);
  assert.equal(shadow.renderedOptions[0].canonical_service_item.price_occurrence_id, "price_2");
  assert.equal(shadow.renderedOptions[1].canonical_service_item.price_occurrence_id, "price_3");
  assert.equal(shadow.semanticValidation.can_generate_pdf, true);
});

for (const caseId of PREVIOUS_UNSAFE_READY_CASE_IDS) {
  test(`${caseId} no longer remains semantic-ready with wrong amount-kind pairing`, () => {
    const shadow = buildCanonicalShadowEstimate(alphaJsonFor(caseId));

    assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), expectedPairsFor(caseId));
    assert.equal(shadow.semanticValidation.can_generate_pdf, true);
    assert.deepEqual(shadow.semanticValidation.structural_error_codes, []);
  });
}

for (const caseId of PREVIOUS_SCOPE_CONFLICT_CASE_IDS) {
  test(`${caseId} no longer reports fabricated scope from boilerplate service mismatch`, () => {
    const shadow = buildCanonicalShadowEstimate(alphaJsonFor(caseId));

    assert.deepEqual(renderedPairs(shadow).map(({ kind, amount }) => ({ kind, amount })), expectedPairsFor(caseId));
    assert.equal(shadow.semanticValidation.can_generate_pdf, true);
    assert.deepEqual(shadow.semanticValidation.structural_error_codes, []);
  });
}

test("semantic validation catches title-description action conflicts", () => {
  const item = canonicalItem({ service_kind: "tree_removal", amount: 900 });
  const result = validateCanonicalServiceEstimate({
    canonicalServiceItems: { items: [item] },
    renderedOptions: [renderedOption(item, "Trim tree limbs.")],
  });

  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.structural_error_codes.includes("TITLE_DESCRIPTION_ACTION_CONFLICT"));
});

test("semantic validation catches duplicate service items without allowed relationships", () => {
  const first = canonicalItem({ stable_id: "item_1", service_kind: "tree_removal", amount: 900 });
  const second = canonicalItem({ stable_id: "item_2", service_kind: "tree_removal", amount: 1200 });
  const result = validateCanonicalServiceEstimate({
    canonicalServiceItems: { items: [first, second] },
    renderedOptions: [renderedOption(first), renderedOption(second)],
  });

  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.structural_error_codes.includes("DUPLICATE_SEMANTIC_ITEM"));
});

test("semantic validation catches service-kind evidence mismatch on correct amount", () => {
  const item = canonicalItem({ service_kind: "tree_removal", amount: 900 });
  item.source.service_kind = "tree_trim";
  const result = validateCanonicalServiceEstimate({
    canonicalServiceItems: { items: [item] },
    renderedOptions: [renderedOption(item)],
  });

  assert.equal(result.can_generate_pdf, false);
  assert.ok(result.structural_error_codes.includes("SERVICE_KIND_EVIDENCE_MISMATCH"));
});

for (const code of CANONICAL_SEMANTIC_ERROR_CODES) {
  test(`${code} blocks canonical semantic readiness`, () => {
    const item = canonicalItem({ service_kind: "tree_removal", amount: 900 });
    item.semantic_validation_errors = [code];
    const result = validateCanonicalServiceEstimate({
      canonicalServiceItems: { items: [item] },
      renderedOptions: [renderedOption(item)],
    });

    assert.equal(result.can_generate_pdf, false);
    assert.ok(result.structural_error_codes.includes(code));
  });
}

test("canonical construction and hash are deterministic", () => {
  const alphaJson = alphaJsonFor("obs_0909");
  const firstInput = buildCanonicalAssemblerInput(alphaJson);
  const first = buildCanonicalShadowEstimate(alphaJson);
  const second = buildCanonicalShadowEstimate(alphaJson);

  assert.deepEqual(first.input, firstInput);
  assert.deepEqual(second.renderedOptions, first.renderedOptions);
  assert.equal(second.canonical_semantic_hash, first.canonical_semantic_hash);
  assert.equal(canonicalSemanticHash(first.alphaJson), canonicalSemanticHash(second.alphaJson));
});

test("approval binding invalidates after semantic option edits", () => {
  const shadow = buildCanonicalShadowEstimate(alphaJsonFor("obs_0909"));
  const approved = approvalBindingForCanonicalEstimate({ alphaJson: shadow.alphaJson, approver: "test" });
  const edited = clone(shadow.alphaJson);
  edited.service_options.items[0].price.amount = 1701;
  edited.service_options.items[0].price.display = "$1,701";
  const staleApproval = approvalBindingForCanonicalEstimate({ alphaJson: edited, approver: "test" });

  assert.equal(approved.approval_valid_for_current_semantics, true);
  assert.equal(staleApproval.approval_valid_for_current_semantics, false);
  assert.notEqual(staleApproval.current_canonical_service_semantic_hash, approved.canonical_service_semantic_hash);
});
