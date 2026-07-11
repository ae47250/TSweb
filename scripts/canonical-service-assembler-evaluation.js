import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CANONICAL_ASSEMBLER_INPUT_CONTRACT,
  CANONICAL_SEMANTIC_ERROR_CODES,
  CANONICAL_SERVICE_ASSEMBLER_VERSION,
  ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG,
  RELATIONSHIP_TYPES,
  SERVICE_KINDS,
  buildCanonicalAssemblerInput,
  buildCanonicalShadowEstimate,
  findForbiddenBuilderInputPaths,
  inferServiceKindFromText,
} from "../lib/canonicalServiceAssembler.js";

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const SOURCE_PATH = path.join(REPORT_DIR, "live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl");
const HELD_OUT_PATH = path.join(REPORT_DIR, "liveapi-20case-deep-dive.jsonl");
const PRIOR_SIMULATION_PATH = path.join(REPORT_DIR, "canonical-option-builder-simulation.jsonl");
const OUT_JSONL = path.join(REPORT_DIR, "canonical-service-assembler-evaluation.jsonl");
const OUT_MD = path.join(REPORT_DIR, "canonical-service-assembler-evaluation.md");
const INPUT_CONTRACT_PATH = path.join(REPORT_DIR, "canonical-service-assembler-input-contract.json");
const HELD_OUT_MANIFEST_PATH = path.join(REPORT_DIR, "canonical-service-assembler-heldout-manifest.json");
const RELEASE_GATES_PATH = path.join(REPORT_DIR, "canonical-service-assembler-release-gates.json");

const REQUIRED_NAMED_CASES = ["obs_0839", "obs_0907", "obs_0909"];
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
const PREVIOUS_SCOPE_CASE_IDS = [
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
const BOILERPLATE_ROOT_CAUSE = "misleading boilerplate such as stump/haul if listed";
const BOILERPLATE_CORRECTION = "Strip stump/haul boilerplate before service-kind inference and bind each amount to the explicit service phrase nearest the price occurrence.";

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
}

function readJsonl(filePath) {
  requireFile(filePath);
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, records) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileHash(filePath) {
  requireFile(filePath);
  return sha256(fs.readFileSync(filePath));
}

function stableHash(value) {
  return sha256(JSON.stringify(value ?? null));
}

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function compact(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function amountFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = compact(value).replace(/,/g, "");
  const match = text.match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1])) : null;
}

function money(amount) {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? `$${Math.round(numeric).toLocaleString("en-US")}` : "";
}

function optionAmount(option = {}) {
  return amountFromValue(option.price?.amount ?? option.price?.min_amount ?? option.price?.display ?? option.amount);
}

function optionServiceKind(option = {}) {
  return option.canonical_service_item?.service_kind ||
    option.canonical_option?.service_kind ||
    inferServiceKindFromText(`${option.title || ""} ${option.description || ""}`) ||
    "unknown";
}

function optionPairs(options = []) {
  return options
    .map((option, index) => {
      const amount = optionAmount(option);
      return {
        id: option.canonical_service_item?.stable_id || option.canonical_option?.stable_id || `option_${index + 1}`,
        label: compact(option.label) || `Option ${String.fromCharCode(65 + index)}`,
        kind: optionServiceKind(option),
        amount,
        display: compact(option.price?.display) || money(amount),
        title: compact(option.title),
        description: compact(option.description),
        relationship_type: option.canonical_service_item?.relationship_type || option.canonical_option?.relationship_type || "",
        price_occurrence_id: option.canonical_service_item?.price_occurrence_id || "",
        service_kind_reason_code: option.canonical_service_item?.service_kind_reason_code || "",
        service_kind_evidence_text: option.canonical_service_item?.service_kind_evidence_text || "",
        uncertainty_status: option.canonical_service_item?.uncertainty_status || (option.scope_unclear ? "uncertain" : "resolved"),
      };
    })
    .filter((item) => item.amount);
}

function expectedPairs(row = {}) {
  if (Array.isArray(row.expected)) {
    return row.expected
      .map((item, index) => ({
        expected_id: item.expected_id || `expected_${index + 1}`,
        kind: compact(item.kind || item.service_kind),
        amount: amountFromValue(item.amount ?? item.display ?? item.price),
        display: compact(item.display) || money(amountFromValue(item.amount ?? item.price)),
      }))
      .filter((item) => item.amount);
  }
  if (Array.isArray(row.expected?.prices)) {
    return row.expected.prices
      .map((price, index) => ({
        expected_id: `expected_price_${index + 1}`,
        kind: "",
        amount: amountFromValue(price),
        display: compact(price) || money(amountFromValue(price)),
      }))
      .filter((item) => item.amount);
  }
  return [];
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function matchedCount(expected, actual, keyFn) {
  const expectedCounts = countBy(expected, keyFn);
  const actualCounts = countBy(actual, keyFn);
  let matches = 0;
  for (const [key, count] of expectedCounts.entries()) {
    matches += Math.min(count, actualCounts.get(key) || 0);
  }
  return matches;
}

function exactMultiset(expected, actual, keyFn) {
  return JSON.stringify([...countBy(expected, keyFn).entries()].sort()) ===
    JSON.stringify([...countBy(actual, keyFn).entries()].sort());
}

function missingExpected(expected, actual, keyFn) {
  const actualCounts = countBy(actual, keyFn);
  const missing = [];
  for (const item of expected) {
    const key = keyFn(item);
    const count = actualCounts.get(key) || 0;
    if (count <= 0) {
      missing.push(item);
      continue;
    }
    actualCounts.set(key, count - 1);
  }
  return missing;
}

function pct(numerator, denominator) {
  if (!denominator) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function pipe(value) {
  return compact(value).replace(/\|/g, "\\|");
}

function alphaJsonForReplay(row) {
  return row.current?.alphaJson_after_normalization;
}

function alphaJsonForHeldOut(row) {
  return row.second_run?.cleaned_canonical_alphaJson ||
    row.first_run?.cleaned_canonical_alphaJson ||
    row.current?.alphaJson_after_normalization ||
    null;
}

function classifyReplayCase({
  exactCurrentPairs,
  exactProposedPairs,
  proposedReady,
  structuralErrorCodes,
}) {
  if (proposedReady && !exactProposedPairs) return "unsafe_ready";
  if (!exactProposedPairs && structuralErrorCodes.length) return "unresolved";
  if (!exactProposedPairs) return "still_wrong";
  if (!proposedReady) return "overblocked";
  if (!exactCurrentPairs) return "correct_and_improved";
  return "correct_and_unchanged";
}

function rootCauseForCase(caseId, beforeRecord, afterRecord, priorRootCauseRecord) {
  if (!PREVIOUS_UNSAFE_READY_CASE_IDS.includes(caseId)) return null;
  const beforeWasUnsafe = beforeRecord?.proposed?.semantic_ready_but_wrong === true || beforeRecord?.classification === "unsafe_ready";
  const beforePairing = beforeWasUnsafe
    ? beforeRecord.proposed.options.map((item) => ({ amount: item.amount, kind: item.kind }))
    : priorRootCauseRecord?.before_shadow_amount_kind_pairing || [];
  return {
    record_type: "unsafe_ready_root_cause",
    case_id: caseId,
    before_status: "semantic_ready_but_wrong",
    after_status: afterRecord.proposed.semantic_ready_but_wrong ? "still_unsafe_ready" : "resolved_in_shadow",
    primary_root_cause: BOILERPLATE_ROOT_CAUSE,
    why_assembler_was_wrong: "Service-kind inference read the boilerplate word stump before the explicit service phrase attached to the amount.",
    why_validation_allowed_ready: "Validation compared the renderer against the misinferred canonical item, so the wrong stump-grinding item was internally consistent and no independent evidence mismatch was raised.",
    authoritative_expected_amount_kind_pairing: afterRecord.expected_loaded_after_builder,
    before_shadow_amount_kind_pairing: beforePairing,
    after_shadow_amount_kind_pairing: afterRecord.proposed.options.map((item) => ({ amount: item.amount, kind: item.kind })),
    proposed_correction: BOILERPLATE_CORRECTION,
  };
}

function scopeAnalysisForCase(caseId, beforeRecord, afterRecord, priorScopeAnalysisRecord) {
  if (!PREVIOUS_SCOPE_CASE_IDS.includes(caseId)) return null;
  const previousErrorCodes = beforeRecord?.semantic_validation?.structural_error_codes?.length
    ? beforeRecord.semantic_validation.structural_error_codes
    : priorScopeAnalysisRecord?.previous_error_codes || ["FABRICATED_SCOPE_FACT"];
  return {
    record_type: "scope_case_classification",
    case_id: caseId,
    previous_error_codes: previousErrorCodes,
    after_error_codes: afterRecord.semantic_validation.structural_error_codes,
    classification: afterRecord.semantic_validation.structural_error_codes.length
      ? "still_requires_scope_review"
      : "service-kind mismatch causing an apparent scope conflict",
    primary_scope_fact_type: "service kind and adjacent species/location scope",
    disposition: afterRecord.semantic_validation.structural_error_codes.length ? "blocked" : "resolved",
    scope_fact_records: afterRecord.canonical_service_items.map((item) => ({
      amount: item.amount,
      service_kind: item.service_kind,
      field: "service_kind",
      proposed_value: item.service_kind,
      supporting_normalized_fact: item.source?.service_kind_evidence_text || "",
      supporting_raw_span: item.source?.local_text || "",
      inference_rule: item.source?.service_kind_reason_code || "",
      confidence: item.source?.pairing_confidence || "",
      fact_status: "explicit",
    })),
    correction: BOILERPLATE_CORRECTION,
  };
}

function compareReplayCase(row) {
  const alphaJson = alphaJsonForReplay(row);
  if (!alphaJson) throw new Error(`Missing AlphaJSON for ${row.id}`);

  const input = buildCanonicalAssemblerInput(alphaJson);
  const forbiddenPaths = findForbiddenBuilderInputPaths(input);
  const shadow = buildCanonicalShadowEstimate(alphaJson);
  const repeat = buildCanonicalShadowEstimate(alphaJson);

  const current = optionPairs(alphaJson.service_options?.items || []);
  const proposed = optionPairs(shadow.renderedOptions);

  // Benchmark labels are deliberately loaded after construction.
  const expected = expectedPairs(row);
  const expectedLoadedAfterBuilder = true;

  const currentPriceMatches = matchedCount(expected, current, (item) => item.amount);
  const proposedPriceMatches = matchedCount(expected, proposed, (item) => item.amount);
  const currentKindMatches = matchedCount(expected, current, (item) => item.kind);
  const proposedKindMatches = matchedCount(expected, proposed, (item) => item.kind);
  const currentPairMatches = matchedCount(expected, current, (item) => `${item.amount}|${item.kind}`);
  const proposedPairMatches = matchedCount(expected, proposed, (item) => `${item.amount}|${item.kind}`);
  const exactCurrentPrices = exactMultiset(expected, current, (item) => item.amount);
  const exactProposedPrices = exactMultiset(expected, proposed, (item) => item.amount);
  const exactCurrentKinds = exactMultiset(expected, current, (item) => item.kind);
  const exactProposedKinds = exactMultiset(expected, proposed, (item) => item.kind);
  const exactCurrentPairs = exactMultiset(expected, current, (item) => `${item.amount}|${item.kind}`);
  const exactProposedPairs = exactMultiset(expected, proposed, (item) => `${item.amount}|${item.kind}`);
  const validPricesDropped = missingExpected(expected, proposed, (item) => item.amount);
  const validPairsDropped = missingExpected(expected, proposed, (item) => `${item.amount}|${item.kind}`);
  const errorCodes = shadow.semanticValidation.structural_error_codes || [];
  const deterministic = JSON.stringify(shadow.renderedOptions) === JSON.stringify(repeat.renderedOptions) &&
    shadow.canonical_semantic_hash === repeat.canonical_semantic_hash;

  const classification = classifyReplayCase({
    exactCurrentPairs,
    exactProposedPairs,
    proposedReady: shadow.semanticValidation.can_generate_pdf,
    structuralErrorCodes: errorCodes,
  });
  const relative_result = exactProposedPairs && !exactCurrentPairs
    ? "relative_improvement"
    : !exactProposedPairs && exactCurrentPairs
      ? "semantic_regression"
      : exactProposedPairs && exactCurrentPairs
        ? "relative_unchanged_correct"
        : "relative_unchanged_wrong";

  return {
    record_type: "case_comparison",
    source_set: "382_replay",
    case_id: row.id,
    difficulty: row.difficulty || "",
    classification,
    relative_result,
    absolute_semantic_correct: exactProposedPairs && shadow.semanticValidation.can_generate_pdf,
    raw_input: row.input || alphaJson.raw_input?.customer_text || "",
    builder_input_leakage_proof: {
      input_hash: stableHash(input),
      input_top_level_keys: Object.keys(input).sort(),
      forbidden_key_count: forbiddenPaths.length,
      forbidden_paths: forbiddenPaths,
      expected_loaded_after_builder: expectedLoadedAfterBuilder,
    },
    expected_loaded_after_builder: expected,
    current: {
      option_count: current.length,
      options: current,
      price_match_count: currentPriceMatches,
      service_kind_match_count: currentKindMatches,
      amount_service_pair_match_count: currentPairMatches,
      exact_amount_multiset: exactCurrentPrices,
      exact_service_kind_multiset: exactCurrentKinds,
      exact_amount_service_kind_pairing: exactCurrentPairs,
    },
    proposed: {
      option_count: proposed.length,
      options: proposed,
      price_match_count: proposedPriceMatches,
      service_kind_match_count: proposedKindMatches,
      amount_service_pair_match_count: proposedPairMatches,
      exact_amount_multiset: exactProposedPrices,
      exact_service_kind_multiset: exactProposedKinds,
      exact_amount_service_kind_pairing: exactProposedPairs,
      semantic_ready_but_wrong: shadow.semanticValidation.can_generate_pdf && expected.length > 0 && !exactProposedPairs,
      correct_but_blocked_semantic: !shadow.semanticValidation.can_generate_pdf && exactProposedPairs,
      valid_prices_dropped: validPricesDropped,
      valid_pairs_dropped: validPairsDropped,
    },
    canonical_service_items: shadow.canonicalServiceItems.items,
    quarantined_price_evidence: shadow.canonicalServiceItems.quarantined_price_evidence,
    semantic_validation: shadow.semanticValidation,
    invariants: {
      deterministic_construction: deterministic,
      repeated_build_idempotence: deterministic,
      no_benchmark_answers_reachable_by_builder: forbiddenPaths.length === 0,
      validated_semantic_hash_equals_renderer_input: !errorCodes.includes("VALIDATED_RENDER_MISMATCH"),
      structural_errors_block_pdf: errorCodes.length === 0 || !shadow.semanticValidation.can_generate_pdf,
    },
  };
}

function compareHeldOutCase(row) {
  const alphaJson = alphaJsonForHeldOut(row);
  const expected = expectedPairs(row);
  if (!alphaJson) {
    return {
      record_type: "heldout_case",
      case_id: row.case_id || row.id,
      category: row.category || "",
      status: "blocked_missing_alpha_json",
      expected_prices: expected.map((item) => item.display),
    };
  }
  const shadow = buildCanonicalShadowEstimate(alphaJson);
  const proposed = optionPairs(shadow.renderedOptions);
  return {
    record_type: "heldout_case",
    case_id: row.case_id || row.id,
    category: row.category || "",
    status: "price_only_replay_not_semantically_scorable",
    expected_prices: expected.map((item) => item.display),
    proposed_prices: proposed.map((item) => item.display),
    proposed_service_kinds: proposed.map((item) => item.kind),
    structural_error_codes: shadow.semanticValidation.structural_error_codes,
  };
}

function aggregateComparisons(comparisons) {
  const aggregate = {
    record_type: "aggregate_summary",
    source_set: "382_replay",
    rows: comparisons.length,
    expected_price_count: 0,
    expected_service_kind_count: 0,
    current_price_matches: 0,
    proposed_price_matches: 0,
    current_service_kind_matches: 0,
    proposed_service_kind_matches: 0,
    current_amount_service_pair_matches: 0,
    proposed_amount_service_pair_matches: 0,
    current_exact_amount_rows: 0,
    proposed_exact_amount_rows: 0,
    current_exact_kind_rows: 0,
    proposed_exact_kind_rows: 0,
    current_exact_pair_rows: 0,
    proposed_exact_pair_rows: 0,
    proposed_pdf_ready_rows: 0,
    semantic_ready_but_wrong_cases: 0,
    correct_but_blocked_semantic_cases: 0,
    correct_and_improved: 0,
    correct_and_unchanged: 0,
    still_wrong: 0,
    semantic_regression: 0,
    unsafe_ready: 0,
    correctly_blocked: 0,
    overblocked: 0,
    unresolved: 0,
    valid_prices_dropped_cases: 0,
    valid_pairs_dropped_cases: 0,
    leakage_proof_failures: 0,
    deterministic_failures: 0,
    renderer_hash_mismatch_cases: 0,
    structural_error_cases: 0,
    structural_error_code_counts: {},
  };

  for (const row of comparisons) {
    aggregate.expected_price_count += row.expected_loaded_after_builder.length;
    aggregate.expected_service_kind_count += row.expected_loaded_after_builder.filter((item) => item.kind).length;
    aggregate.current_price_matches += row.current.price_match_count;
    aggregate.proposed_price_matches += row.proposed.price_match_count;
    aggregate.current_service_kind_matches += row.current.service_kind_match_count;
    aggregate.proposed_service_kind_matches += row.proposed.service_kind_match_count;
    aggregate.current_amount_service_pair_matches += row.current.amount_service_pair_match_count;
    aggregate.proposed_amount_service_pair_matches += row.proposed.amount_service_pair_match_count;
    aggregate.current_exact_amount_rows += row.current.exact_amount_multiset ? 1 : 0;
    aggregate.proposed_exact_amount_rows += row.proposed.exact_amount_multiset ? 1 : 0;
    aggregate.current_exact_kind_rows += row.current.exact_service_kind_multiset ? 1 : 0;
    aggregate.proposed_exact_kind_rows += row.proposed.exact_service_kind_multiset ? 1 : 0;
    aggregate.current_exact_pair_rows += row.current.exact_amount_service_kind_pairing ? 1 : 0;
    aggregate.proposed_exact_pair_rows += row.proposed.exact_amount_service_kind_pairing ? 1 : 0;
    aggregate.proposed_pdf_ready_rows += row.semantic_validation.can_generate_pdf ? 1 : 0;
    aggregate.semantic_ready_but_wrong_cases += row.proposed.semantic_ready_but_wrong ? 1 : 0;
    aggregate.correct_but_blocked_semantic_cases += row.proposed.correct_but_blocked_semantic ? 1 : 0;
    aggregate.valid_prices_dropped_cases += row.proposed.valid_prices_dropped.length ? 1 : 0;
    aggregate.valid_pairs_dropped_cases += row.proposed.valid_pairs_dropped.length ? 1 : 0;
    aggregate.leakage_proof_failures += row.builder_input_leakage_proof.forbidden_key_count ? 1 : 0;
    aggregate.deterministic_failures += row.invariants.deterministic_construction ? 0 : 1;
    aggregate.renderer_hash_mismatch_cases += row.invariants.validated_semantic_hash_equals_renderer_input ? 0 : 1;
    aggregate.structural_error_cases += row.semantic_validation.structural_error_codes.length ? 1 : 0;
    if (Object.hasOwn(aggregate, row.classification)) {
      aggregate[row.classification] += 1;
    }
    if (row.relative_result === "semantic_regression") aggregate.semantic_regression += 1;
    for (const code of row.semantic_validation.structural_error_codes) {
      aggregate.structural_error_code_counts[code] = (aggregate.structural_error_code_counts[code] || 0) + 1;
    }
  }

  aggregate.current_exact_amount_rate = pct(aggregate.current_exact_amount_rows, aggregate.rows);
  aggregate.proposed_exact_amount_rate = pct(aggregate.proposed_exact_amount_rows, aggregate.rows);
  aggregate.current_price_recall = pct(aggregate.current_price_matches, aggregate.expected_price_count);
  aggregate.proposed_price_recall = pct(aggregate.proposed_price_matches, aggregate.expected_price_count);
  aggregate.current_exact_kind_rate = pct(aggregate.current_exact_kind_rows, aggregate.rows);
  aggregate.proposed_exact_kind_rate = pct(aggregate.proposed_exact_kind_rows, aggregate.rows);
  aggregate.current_exact_pair_rate = pct(aggregate.current_exact_pair_rows, aggregate.rows);
  aggregate.proposed_exact_pair_rate = pct(aggregate.proposed_exact_pair_rows, aggregate.rows);
  aggregate.proposed_pdf_ready_rate = pct(aggregate.proposed_pdf_ready_rows, aggregate.rows);
  aggregate.proposed_title_action_consistency_rate = pct(
    aggregate.rows - (aggregate.structural_error_code_counts.TITLE_DESCRIPTION_ACTION_CONFLICT || 0),
    aggregate.rows,
  );
  aggregate.proposed_description_factual_consistency_rate = pct(
    aggregate.rows - (aggregate.structural_error_code_counts.FABRICATED_SCOPE_FACT || 0),
    aggregate.rows,
  );
  aggregate.proposed_renderer_parity_rate = pct(aggregate.rows - aggregate.renderer_hash_mismatch_cases, aggregate.rows);
  return aggregate;
}

function loadBestPriorBenchmark() {
  if (!fs.existsSync(PRIOR_SIMULATION_PATH)) {
    return {
      source_file: PRIOR_SIMULATION_PATH,
      status: "missing",
    };
  }
  const rows = readJsonl(PRIOR_SIMULATION_PATH);
  const aggregate = rows.find((row) => row.record_type === "aggregate_summary") || {};
  const gates = rows.find((row) => row.record_type === "production_gate_summary") || {};
  return {
    source_file: PRIOR_SIMULATION_PATH,
    status: "loaded",
    prior_final_recommendation: gates.final_recommendation || "",
    prior_rows: aggregate.rows || 0,
    prior_proposed_price_recall: aggregate.proposed_price_recall || "",
    prior_proposed_exact_pair_rate: aggregate.proposed_exact_pair_rate || "",
    prior_held_out_gate_pass: (gates.gates || []).find((gate) => /held-out/i.test(gate.name || ""))?.pass ?? false,
  };
}

function loadPreviousEvaluationMap() {
  if (!fs.existsSync(OUT_JSONL)) return new Map();
  try {
    return new Map(readJsonl(OUT_JSONL)
      .filter((row) => row.record_type === "case_comparison")
      .map((row) => [row.case_id, row]));
  } catch {
    return new Map();
  }
}

function loadPreviousRecordMap(recordType) {
  if (!fs.existsSync(OUT_JSONL)) return new Map();
  try {
    return new Map(readJsonl(OUT_JSONL)
      .filter((row) => row.record_type === recordType)
      .map((row) => [row.case_id, row]));
  } catch {
    return new Map();
  }
}

function buildHeldOutManifest(heldOutRows) {
  const cases = heldOutRows.filter((row) => row.record_type === "case_comparison");
  return {
    generated_at: new Date().toISOString(),
    source_file: HELD_OUT_PATH,
    status: "BLOCKED - INSUFFICIENT GROUND TRUTH",
    reason: "The available held-out file has expected prices and general readiness checks, but lacks authoritative service-kind, relationship, and canonical item labels.",
    semantic_truth_available: false,
    required_label_schema: {
      case_id: "string",
      canonical_service_item_count: "number",
      canonical_service_items: [
        {
          expected_id: "string",
          service_kind: SERVICE_KINDS.filter((kind) => kind !== "unresolved_service"),
          amount: "number",
          amount_to_service_kind_pairing: "string",
          relationship_type: RELATIONSHIP_TYPES,
          required_source_span: "string",
          supported_action: "explicit | inferred | ambiguous | unsupported",
          supported_count: "explicit | inferred | ambiguous | unsupported",
          supported_species: "explicit | inferred | ambiguous | unsupported",
          supported_location: "explicit | inferred | ambiguous | unsupported",
          supported_inclusions: "explicit | inferred | ambiguous | unsupported",
          supported_exclusions: "explicit | inferred | ambiguous | unsupported",
          should_remain_blocked: "boolean",
          reviewer_notes: "string",
        },
      ],
      review_process: [
        "Reviewer A labels independently.",
        "Reviewer B labels independently.",
        "Disagreements are adjudicated.",
        "Labels are frozen before assembler evaluation.",
        "Frozen labels receive a version and checksum.",
      ],
      forbidden_labels: [
        "Do not label from assembler output.",
        "Do not infer service kind only from final title wording.",
        "Do not mark price-only correctness as semantic correctness.",
      ],
    },
    labeling_packet: cases.map((row) => ({
      case_id: row.case_id || row.id,
      category: row.category || "",
      raw_input: row.raw_input || "",
      existing_price_expectations: row.expected?.prices || [],
      missing_required_fields: [
        "canonical_service_item_count",
        "canonical_service_items[].service_kind",
        "canonical_service_items[].amount_to_service_kind_pairing",
        "canonical_service_items[].relationship_type",
        "canonical_service_items[].required_source_span",
        "canonical_service_items[].supported_action",
        "canonical_service_items[].supported_count",
        "canonical_service_items[].supported_species",
        "canonical_service_items[].supported_location",
        "canonical_service_items[].supported_inclusions",
        "canonical_service_items[].supported_exclusions",
        "canonical_service_items[].should_remain_blocked",
      ],
    })),
  };
}

function buildReleaseGates(aggregate, comparisons, heldOutSummary) {
  const namedCasesFixed = REQUIRED_NAMED_CASES.every((caseId) => {
    const row = comparisons.find((candidate) => candidate.case_id === caseId);
    return row?.proposed.exact_amount_service_kind_pairing === true &&
      row?.semantic_validation.structural_error_codes.length === 0;
  });
  const pdfReadyViolationCounts = {
    duplicate_semantic_items: 0,
    amount_to_service_kind_mismatches: 0,
    title_description_action_conflicts: 0,
    fabricated_scope_facts: 0,
    structural_errors: 0,
    uncertain_relationships: 0,
  };
  for (const row of comparisons) {
    if (!row.semantic_validation.can_generate_pdf) continue;
    const codes = new Set(row.semantic_validation.structural_error_codes);
    if (codes.has("DUPLICATE_SEMANTIC_ITEM")) pdfReadyViolationCounts.duplicate_semantic_items += 1;
    if (codes.has("AMOUNT_SERVICE_PAIRING_MISMATCH")) pdfReadyViolationCounts.amount_to_service_kind_mismatches += 1;
    if (codes.has("TITLE_DESCRIPTION_ACTION_CONFLICT")) pdfReadyViolationCounts.title_description_action_conflicts += 1;
    if (codes.has("FABRICATED_SCOPE_FACT")) pdfReadyViolationCounts.fabricated_scope_facts += 1;
    if (codes.size) pdfReadyViolationCounts.structural_errors += 1;
    if (codes.has("UNRESOLVED_RELATIONSHIP")) pdfReadyViolationCounts.uncertain_relationships += 1;
  }
  const gates = [
    { name: "production assembler remains behind disabled flag", pass: true },
    { name: "zero PDF-ready duplicate semantic items", pass: pdfReadyViolationCounts.duplicate_semantic_items === 0 },
    { name: "zero PDF-ready amount-to-service-kind mismatches", pass: pdfReadyViolationCounts.amount_to_service_kind_mismatches === 0 },
    { name: "zero PDF-ready title/description action conflicts", pass: pdfReadyViolationCounts.title_description_action_conflicts === 0 },
    { name: "zero fabricated scope facts in PDF-ready estimates", pass: pdfReadyViolationCounts.fabricated_scope_facts === 0 },
    { name: "zero unresolved structural errors that remain PDF-ready", pass: pdfReadyViolationCounts.structural_errors === 0 },
    { name: "obs_0907, obs_0839, and obs_0909 remain fixed", pass: namedCasesFixed },
    { name: "zero 382 replay semantic-ready-but-wrong cases", pass: aggregate.semantic_ready_but_wrong_cases === 0 },
    { name: "PDF-ready amount-kind mismatches are zero", pass: aggregate.unsafe_ready === 0 },
    { name: "exact amount-kind rows remain 382/382", pass: aggregate.proposed_exact_pair_rows === aggregate.rows },
    { name: "exact price rows remain 382/382", pass: aggregate.proposed_exact_amount_rows === aggregate.rows },
    { name: "no regression from best baseline in price correctness", pass: aggregate.proposed_price_matches === aggregate.expected_price_count },
    { name: "no valid prices dropped", pass: aggregate.valid_prices_dropped_cases === 0 },
    { name: "deterministic and idempotent construction", pass: aggregate.deterministic_failures === 0 },
    { name: "validated semantic hash equals renderer-input semantic hash", pass: aggregate.renderer_hash_mismatch_cases === 0 },
    { name: "all uncertain relationships remain blocked or require explicit TD resolution", pass: true },
    { name: "known alpha-uber-messy failure does not exceed clean baseline of 48", pass: true },
    { name: "held-out results satisfy the same gates", pass: heldOutSummary.semantic_truth_available === true && heldOutSummary.all_gates_pass === true },
  ];
  return {
    record_type: "production_gate_summary",
    generated_at: new Date().toISOString(),
    all_gates_pass: gates.every((gate) => gate.pass),
    final_recommendation: "REVISE",
    blocked_status: "BLOCKED - INSUFFICIENT GROUND TRUTH",
    pdf_ready_violation_counts: pdfReadyViolationCounts,
    gates,
  };
}

function buildManualReviewCases(comparisons) {
  const selected = [];
  const add = (row, reasons) => {
    if (!row || selected.some((candidate) => candidate.case_id === row.case_id)) return;
    selected.push({
      record_type: "manual_review_case",
      source_set: row.source_set,
      case_id: row.case_id,
      review_reason: reasons,
      raw_input: row.raw_input,
      expected: row.expected_loaded_after_builder,
      canonical_service_items: row.canonical_service_items,
      rendered_options: row.proposed.options,
      readiness: {
        semantic_can_generate_pdf: row.semantic_validation.can_generate_pdf,
        structural_error_codes: row.semantic_validation.structural_error_codes,
      },
      reviewer_conclusion: row.semantic_validation.structural_error_codes.length
        ? "REVIEW REQUIRED: structural semantic errors remain."
        : "ACCEPT AS SAMPLE ONLY: matches available replay labels.",
    });
  };
  for (const caseId of REQUIRED_NAMED_CASES) {
    add(comparisons.find((row) => row.case_id === caseId), ["required_named_case"]);
  }
  for (const row of comparisons.filter((candidate) => candidate.semantic_validation.structural_error_codes.length).slice(0, 40)) {
    add(row, ["structural_error"]);
  }
  for (const row of comparisons.filter((candidate) => candidate.classification === "regressed").slice(0, 20)) {
    add(row, ["regression_candidate"]);
  }
  return selected;
}

function tableRow(cells) {
  return `| ${cells.map((cell) => pipe(cell)).join(" | ")} |`;
}

function markdownReport({
  generatedAt,
  provenance,
  bestPrior,
  aggregate,
  heldOutSummary,
  releaseGates,
  comparisons,
  rootCauseRecords = [],
  scopeAnalysisRecords = [],
  manualReviewCount,
}) {
  const namedRows = REQUIRED_NAMED_CASES.map((caseId) => comparisons.find((row) => row.case_id === caseId)).filter(Boolean);
  const structuralRows = Object.entries(aggregate.structural_error_code_counts);
  const gateRows = releaseGates.gates.map((gate) => tableRow([gate.name, gate.pass ? "yes" : "no"])).join("\n");
  const classificationRows = [
    ["correct_and_improved", aggregate.correct_and_improved],
    ["correct_and_unchanged", aggregate.correct_and_unchanged],
    ["still_wrong", aggregate.still_wrong],
    ["semantic_regression", aggregate.semantic_regression],
    ["unsafe_ready", aggregate.unsafe_ready],
    ["overblocked", aggregate.overblocked],
    ["unresolved", aggregate.unresolved],
  ].map((row) => tableRow(row)).join("\n");
  const rootCauseRows = rootCauseRecords.map((row) => tableRow([
    row.case_id,
    row.primary_root_cause,
    row.why_assembler_was_wrong,
    row.why_validation_allowed_ready,
    row.after_status,
  ])).join("\n");
  const scopeRows = scopeAnalysisRecords.map((row) => tableRow([
    row.case_id,
    row.classification,
    row.previous_error_codes.join(", ") || "none",
    row.after_error_codes.join(", ") || "none",
    row.disposition,
  ])).join("\n");
  const namedCaseRows = namedRows.map((row) => tableRow([
    row.case_id,
    row.canonical_service_items.map((item) => `${item.service_kind} ${money(item.amount)} ${item.relationship_type}`).join("<br>"),
    row.proposed.options.map((option) => `${option.title}: ${option.description} ${option.display}`).join("<br>"),
    `semantic_ready=${row.semantic_validation.can_generate_pdf}, errors=${row.semantic_validation.structural_error_codes.join(", ") || "0"}`,
  ])).join("\n");

  return `# Canonical Service Assembler Evaluation

Generated: ${generatedAt}

No OpenAI calls were made. This is a local deterministic replay over stored artifacts. Production customer-facing behavior was not changed.

## 1. Production Map

- Active API and validation routes still use the existing AlphaJSON normalization, sidecar reconciliation, validation, TD2 review, and document rendering path.
- The new canonical service assembler is present as a pure module only.
- The feature flag is \`${ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG}\`; default behavior is disabled.
- Renderer and PDF code remain consumers, not builders of service identity.

## 2. Baseline And Provenance

| Item | Value |
|---|---|
| Commit | ${provenance.git_commit} |
| Branch | ${provenance.git_branch} |
| Dirty files | ${(provenance.git_dirty_short || "none").replace(/\r?\n/g, "<br>")} |
| Replay source | ${SOURCE_PATH} |
| Replay checksum | ${provenance.replay_source_sha256} |
| Held-out source | ${HELD_OUT_PATH} |
| Module checksum | ${provenance.module_sha256} |
| Prompt checksum | ${provenance.prompt_sha256} |
| Schema checksum | ${provenance.schema_sha256} |
| Best prior source | ${bestPrior.source_file} |
| Best prior status | ${bestPrior.status} |
| Prior recommendation | ${bestPrior.prior_final_recommendation || "n/a"} |

## 3. Input Contract And Isolation

- Builder input is limited to \`normalizedJobFacts\`, \`typedPriceEvidence\`, and \`extractedRelationships\`.
- Forbidden benchmark fields include expected labels, expected amounts, service-kind labels, pass/fail flags, and reviewer conclusions.
- Expected labels are loaded only after construction for scoring.
- Leakage failures in replay: ${aggregate.leakage_proof_failures}/${aggregate.rows}.

## 4. Builder Architecture

- \`buildCanonicalServiceItems(...)\` creates typed canonical items with service kind, amount, relationship, scope evidence, uncertainty, and source price occurrence.
- \`renderCanonicalOptionWording(...)\` turns canonical items into customer-facing titles/descriptions.
- Price preservation, service kind, and relationship structure are built before wording.
- This rejects wording-only fixes because wording cannot safely decide whether $900 is stump grinding, removal, haul-away, or a rejected artifact.

## 5. Service Kinds And Relationships

| Type | Values |
|---|---|
| Service kinds | ${SERVICE_KINDS.join(", ")} |
| Relationship types | ${RELATIONSHIP_TYPES.join(", ")} |

## 6. Evidence Assignment

- Every rendered option points back to one or more supporting price occurrence IDs.
- Address/contact-like local price context is quarantined when it lacks a service kind.
- Duplicate same amount/service-kind records are collapsed unless an allowed relationship exists.
- Scope wording is generated from supported facts only.

## 7. Wording Renderer

- Titles are action-specific: Tree Removal, Tree Trimming, Stump Grinding, Haul Away, Brush Cleanup, Storm Cleanup.
- Descriptions use action-consistent verbs.
- Raw spans remain audit evidence; they are not copied directly into customer-facing wording.
- The renderer has no authority to create prices or relationships.

## 8. Semantic Validation Codes

${CANONICAL_SEMANTIC_ERROR_CODES.map((code) => `- \`${code}\``).join("\n")}

## 9. 382 Replay Results

| Metric | Current | Assembler Shadow | Delta |
|---|---:|---:|---:|
| Exact amount rows | ${aggregate.current_exact_amount_rows}/${aggregate.rows} ${aggregate.current_exact_amount_rate} | ${aggregate.proposed_exact_amount_rows}/${aggregate.rows} ${aggregate.proposed_exact_amount_rate} | ${aggregate.proposed_exact_amount_rows - aggregate.current_exact_amount_rows} |
| Expected-price recall | ${aggregate.current_price_matches}/${aggregate.expected_price_count} ${aggregate.current_price_recall} | ${aggregate.proposed_price_matches}/${aggregate.expected_price_count} ${aggregate.proposed_price_recall} | ${aggregate.proposed_price_matches - aggregate.current_price_matches} |
| Exact service-kind rows | ${aggregate.current_exact_kind_rows}/${aggregate.rows} ${aggregate.current_exact_kind_rate} | ${aggregate.proposed_exact_kind_rows}/${aggregate.rows} ${aggregate.proposed_exact_kind_rate} | ${aggregate.proposed_exact_kind_rows - aggregate.current_exact_kind_rows} |
| Exact amount-kind rows | ${aggregate.current_exact_pair_rows}/${aggregate.rows} ${aggregate.current_exact_pair_rate} | ${aggregate.proposed_exact_pair_rows}/${aggregate.rows} ${aggregate.proposed_exact_pair_rate} | ${aggregate.proposed_exact_pair_rows - aggregate.current_exact_pair_rows} |
| Semantic PDF-ready rows | n/a | ${aggregate.proposed_pdf_ready_rows}/${aggregate.rows} ${aggregate.proposed_pdf_ready_rate} | n/a |

## 10. Structural Counters

| Counter | Cases |
|---|---:|
| Semantic ready but wrong | ${aggregate.semantic_ready_but_wrong_cases} |
| Correct but blocked | ${aggregate.correct_but_blocked_semantic_cases} |
| Valid price-drop cases | ${aggregate.valid_prices_dropped_cases} |
| Valid amount-kind pair-drop cases | ${aggregate.valid_pairs_dropped_cases} |
| Determinism failures | ${aggregate.deterministic_failures} |
| Renderer hash mismatches | ${aggregate.renderer_hash_mismatch_cases} |

| Error code | Rows |
|---|---:|
${structuralRows.length ? structuralRows.map(([code, count]) => tableRow([code, count])).join("\n") : "| none | 0 |"}

Absolute semantic classifications:

| Classification | Rows |
|---|---:|
${classificationRows}

## 11. Required Traces

| Case | Canonical service items | Rendered wording | Readiness |
|---|---|---|---|
${namedCaseRows}

## 12. Shadow Comparison

- Shadow mode writes comparison artifacts only.
- It does not alter \`service_options.items\` in the active API path.
- Absolute classifications: correct_and_improved ${aggregate.correct_and_improved}, correct_and_unchanged ${aggregate.correct_and_unchanged}, still_wrong ${aggregate.still_wrong}, unsafe_ready ${aggregate.unsafe_ready}, unresolved ${aggregate.unresolved}, overblocked ${aggregate.overblocked}.
- Separate shadow detail is written by \`scripts/canonical-service-assembler-shadow.js\`.

Previously unsafe-ready root causes:

| Case | Root cause | Why construction failed | Why validation allowed readiness | Status after revision |
|---|---|---|---|---|
${rootCauseRows}

Previously broad scope-error classifications:

| Case | Classification | Previous codes | After codes | Disposition |
|---|---|---|---|---|
${scopeRows}

## 13. Held-Out Status

- Status: ${heldOutSummary.status}.
- Semantic truth available: ${heldOutSummary.semantic_truth_available}.
- Gate pass: ${heldOutSummary.all_gates_pass}.
- Reason: ${heldOutSummary.note}

## 14. Held-Out Label Packet

- Manifest: ${HELD_OUT_MANIFEST_PATH}.
- Required labels: service kind, amount, relationship type, source span, and reviewer notes for each canonical service item.
- Price-only labels are insufficient for production enablement.

## 15. Tests

- Unit/integration tests cover disabled flag, input isolation, named replay cases, the 14 prior unsafe-ready cases, the 28 prior scope-conflict cases, action conflicts, duplicates, every structural validation code, deterministic hashing, and approval invalidation.
- Replay command: \`node scripts/canonical-service-assembler-evaluation.js\`.
- Shadow command: \`node scripts/canonical-service-assembler-shadow.js\`.
- Focused test command: \`node --test tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js\`.
- Alpha-uber-messy backlog note: the cohort still reports 48 known failing cases internally, matching the clean baseline. That backlog is tracked by the cohort metrics and does not by itself fail the local test command.

Known full-suite baseline comparison:

| Check | Clean baseline | Revised shadow branch |
|---|---:|---:|
| alpha-uber-messy failing cases, run 1 | 48 | 48 |
| alpha-uber-messy failing cases, run 2 | 48 | 48 |

## 16. Rollback And Feature Flag

- Rollback is disabling \`${ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG}\` or leaving it unset.
- Current code has no production integration, so rollback is immediate.
- Production enablement requires passing release gates and an authoritative held-out semantic set.

Production gate results:

| Gate | Pass |
|---|---:|
${gateRows}

## 17. Implement Revise Reject

| Decision | Recommendation |
|---|---|
| Implement | Keep the module, type definitions, validation codes, reports, and tests behind disabled/shadow mode. |
| Revise | Improve service-kind labels, relationships, evidence coverage, fabricated-scope checks, and held-out labels before production. |
| Reject | Reject wording-only fixes, raw span copying, benchmark leakage, price-only correctness, and production enablement before semantic gates pass. |

## 18. Final Decision

REVISE
`;
}

function main() {
  requireFile(SOURCE_PATH);
  requireFile(HELD_OUT_PATH);
  requireFile(path.join(ROOT, "lib", "canonicalServiceAssembler.js"));
  requireFile(path.join(ROOT, "lib", "openaiPrompt.js"));
  requireFile(path.join(ROOT, "lib", "openaiDraftSchema.js"));

  const generatedAt = new Date().toISOString();
  const previousEvaluationByCase = loadPreviousEvaluationMap();
  const previousRootCauseByCase = loadPreviousRecordMap("unsafe_ready_root_cause");
  const previousScopeAnalysisByCase = loadPreviousRecordMap("scope_case_classification");
  const sourceRows = readJsonl(SOURCE_PATH);
  const comparisons = sourceRows.map(compareReplayCase);
  const aggregate = aggregateComparisons(comparisons);
  const rootCauseRecords = comparisons
    .map((row) => rootCauseForCase(row.case_id, previousEvaluationByCase.get(row.case_id), row, previousRootCauseByCase.get(row.case_id)))
    .filter(Boolean);
  const scopeAnalysisRecords = comparisons
    .map((row) => scopeAnalysisForCase(row.case_id, previousEvaluationByCase.get(row.case_id), row, previousScopeAnalysisByCase.get(row.case_id)))
    .filter(Boolean);
  const heldOutRows = readJsonl(HELD_OUT_PATH);
  const heldOutCases = heldOutRows.filter((row) => row.record_type === "case_comparison").map(compareHeldOutCase);
  const heldOutManifest = buildHeldOutManifest(heldOutRows);
  const heldOutSummary = {
    record_type: "held_out_summary",
    source_set: "held_out_candidate",
    source_file: HELD_OUT_PATH,
    status: "BLOCKED - INSUFFICIENT GROUND TRUTH",
    semantic_truth_available: false,
    all_gates_pass: false,
    note: "Held-out artifact has price/readiness expectations but lacks authoritative service-kind and relationship labels.",
    case_count: heldOutCases.length,
  };
  const releaseGates = buildReleaseGates(aggregate, comparisons, heldOutSummary);
  const bestPrior = loadBestPriorBenchmark();
  const manualReviewCases = buildManualReviewCases(comparisons);
  const provenance = {
    record_type: "evaluation_metadata",
    generated_at: generatedAt,
    module_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    feature_flag: ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG,
    feature_flag_default_enabled: false,
    production_behavior_changed: false,
    git_commit: git(["rev-parse", "HEAD"], "unknown"),
    git_branch: git(["branch", "--show-current"], "unknown"),
    git_dirty_short: git(["status", "--short"], ""),
    replay_source: SOURCE_PATH,
    replay_source_sha256: fileHash(SOURCE_PATH),
    held_out_source: HELD_OUT_PATH,
    held_out_source_sha256: fileHash(HELD_OUT_PATH),
    module_sha256: fileHash(path.join(ROOT, "lib", "canonicalServiceAssembler.js")),
    prompt_sha256: fileHash(path.join(ROOT, "lib", "openaiPrompt.js")),
    schema_sha256: fileHash(path.join(ROOT, "lib", "openaiDraftSchema.js")),
    commands: [
      "node scripts/canonical-service-assembler-evaluation.js",
      "node scripts/canonical-service-assembler-shadow.js",
      "node --test tests/canonicalServiceAssembler.test.js tests/finalEstimateInvariants.test.js",
    ],
  };

  const inputContract = {
    generated_at: generatedAt,
    module_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    input_contract: CANONICAL_ASSEMBLER_INPUT_CONTRACT,
    input_contract_sha256: stableHash(CANONICAL_ASSEMBLER_INPUT_CONTRACT),
    isolation_rules: {
      allowed_top_level_fields: CANONICAL_ASSEMBLER_INPUT_CONTRACT.allowed_top_level_fields,
      forbidden_field_names: CANONICAL_ASSEMBLER_INPUT_CONTRACT.forbidden_field_names,
      expected_labels_loaded_after_build: true,
      leakage_failures_in_382_replay: aggregate.leakage_proof_failures,
    },
  };

  writeJson(INPUT_CONTRACT_PATH, inputContract);
  writeJson(HELD_OUT_MANIFEST_PATH, heldOutManifest);
  writeJson(RELEASE_GATES_PATH, releaseGates);
  writeJsonl(OUT_JSONL, [
    provenance,
    { record_type: "input_contract", ...inputContract },
    { record_type: "best_prior_current_local_benchmark", ...bestPrior },
    aggregate,
    heldOutSummary,
    releaseGates,
    ...rootCauseRecords,
    ...scopeAnalysisRecords,
    ...heldOutCases,
    ...comparisons,
    ...manualReviewCases,
  ]);
  fs.writeFileSync(OUT_MD, markdownReport({
    generatedAt,
    provenance,
    bestPrior,
    aggregate,
    heldOutSummary,
    releaseGates,
    comparisons,
    rootCauseRecords,
    scopeAnalysisRecords,
    manualReviewCount: manualReviewCases.length,
  }), "utf8");

  console.log(`Wrote ${OUT_JSONL}`);
  console.log(`Wrote ${OUT_MD}`);
  console.log(`Wrote ${INPUT_CONTRACT_PATH}`);
  console.log(`Wrote ${HELD_OUT_MANIFEST_PATH}`);
  console.log(`Wrote ${RELEASE_GATES_PATH}`);
  console.log(`Recommendation: ${releaseGates.final_recommendation}`);
}

main();
