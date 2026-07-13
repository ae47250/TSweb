#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalShadowEstimate } from "../lib/canonicalServiceAssembler.js";
import { validateFinalOptionStructure } from "../lib/finalOptionStructureValidator.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const DEFAULT_REPLAY = "reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl";
const DEFAULT_MANIFEST = "reports/human-review-34-readiness-reconciliation-manifest.jsonl";
const DEFAULT_JSONL = "reports/final-option-structure-regression-triage.jsonl";
const DEFAULT_MD = "reports/final-option-structure-regression-triage.md";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line, index) => ({
    line: index + 1,
    row: JSON.parse(line),
  }));
}

function readManifest(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function increment(map, key) {
  map[key || "none"] = (map[key || "none"] || 0) + 1;
}

function codeBucket(codes = []) {
  const codeSet = new Set(codes);
  if (
    codeSet.has("DEPENDENT_ADDON_STANDALONE") ||
    codeSet.has("MISSING_EXPANDED_CHOICE") ||
    codeSet.has("EXPANDED_PRICE_MISMATCH") ||
    codeSet.has("EXPANDED_SCOPE_INCOMPLETE") ||
    codeSet.has("MISSING_BASE_CHOICE") ||
    codeSet.has("BASE_SCOPE_INCLUDES_ADDON")
  ) {
    return "dependent_addon_structure";
  }
  if (
    codeSet.has("AMBIGUOUS_OPTION_RELATIONSHIP") ||
    codeSet.has("TARGET_BINDING_UNRESOLVED") ||
    codeSet.has("UNSUPPORTED_RELATIONSHIP_ARITHMETIC") ||
    codeSet.has("MULTI_ADDON_COMBINATION_UNSUPPORTED") ||
    codeSet.has("CONFLICTING_PACKAGE_TOTAL")
  ) {
    return "ambiguous_or_unsupported_relationship";
  }
  if (
    codeSet.has("GENERIC_OPTION_SCOPE") ||
    codeSet.has("CONTAMINATED_OPTION_SCOPE") ||
    codeSet.has("SAFETY_TEXT_IN_CUSTOMER_SCOPE")
  ) {
    return "scope_quality";
  }
  if (codes.length) return "other_structural";
  return "none";
}

function finalOptionServiceKinds(model = {}) {
  return [...new Set(asArray(model.final_options)
    .flatMap((option) => [
      option.canonical_option?.service_kind,
      ...asArray(option.canonical_option?.included_service_kinds),
    ])
    .filter(Boolean))].sort();
}

function relationshipTypes(model = {}) {
  return [...new Set(asArray(model.relationships).map((relationship) => relationship.relationship_type || relationship.type).filter(Boolean))].sort();
}

function classifyRecord({ cohort, activeReady, structuralCodes, wouldBlock, correctionAvailable, potentialRegression }) {
  if (potentialRegression) return `potential_regression_${codeBucket(structuralCodes)}`;
  if (cohort === "authoritative_34") return wouldBlock
    ? "reviewed_authoritative_structural_block"
    : "reviewed_authoritative_no_new_block";
  if (cohort === "extra_regression") return wouldBlock
    ? "extra_regression_structural_block"
    : "extra_regression_no_new_block";
  if (wouldBlock && correctionAvailable) return "nonreviewed_shadow_correction_available";
  if (wouldBlock) return "nonreviewed_structural_block_without_correction";
  if (correctionAvailable) return activeReady
    ? "shadow_correction_available_no_block"
    : "shadow_correction_available_already_blocked";
  return activeReady ? "unchanged_pdf_ready" : "unchanged_not_pdf_ready";
}

function reviewDisposition(record) {
  if (!record.potential_regression) return "not_applicable";
  return "requires_held_out_semantic_review";
}

function analyzeRow({ row, line }, manifestById) {
  const alphaJson = row.replay_after_implementation?.alphaJson_after_normalization;
  if (!alphaJson) {
    return {
      observation_id: row.id,
      line,
      cohort: manifestById.get(row.id)?.cohort_membership || "full_382_only",
      active_ready: false,
      shadow_would_block_if_enforced: false,
      potential_regression: false,
      category: "missing_replay_alpha_json",
      triage_bucket: "missing_replay_alpha_json",
      review_disposition: "requires_local_replay_repair",
      canonical_model_status: "not_evaluated",
      canonical_final_option_count: 0,
      correction_available: false,
      structural_error_codes: [],
      service_kinds: [],
      relationship_types: [],
    };
  }

  const activeValidation = validateAlphaJson(alphaJson);
  const structuralValidation = validateFinalOptionStructure(activeValidation.alphaJson, { enforce: true });
  const shadow = buildCanonicalShadowEstimate(activeValidation.alphaJson);
  const model = shadow.finalOptionModel || {};
  const structuralCodes = structuralValidation.structural_error_codes || [];
  const activeReady = Boolean(activeValidation.can_generate_pdf);
  const wouldBlock = Boolean(activeReady && structuralCodes.length);
  const manifestRecord = manifestById.get(row.id);
  const cohort = manifestRecord?.cohort_membership || "full_382_only";
  const potentialRegression = wouldBlock && !manifestRecord;
  const correctionAvailable = model.status === "constructed" && asArray(model.final_options).length > 0;
  const category = classifyRecord({
    cohort,
    activeReady,
    structuralCodes,
    wouldBlock,
    correctionAvailable,
    potentialRegression,
  });

  return {
    observation_id: row.id,
    line,
    cohort,
    active_ready: activeReady,
    shadow_would_block_if_enforced: wouldBlock,
    potential_regression: potentialRegression,
    category,
    triage_bucket: codeBucket(structuralCodes),
    review_disposition: reviewDisposition({ potential_regression: potentialRegression }),
    canonical_model_status: model.status || "not_applicable",
    canonical_final_option_count: asArray(model.final_options).length,
    correction_available: correctionAvailable,
    structural_error_codes: structuralCodes,
    final_option_structural_hash: structuralValidation.final_option_structural_hash || "",
    service_kinds: finalOptionServiceKinds(model),
    relationship_types: relationshipTypes(model),
  };
}

function sortedEntries(object = {}) {
  return Object.entries(object).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function tally(records) {
  const categoryCounts = {};
  const cohortCounts = {};
  const bucketCounts = {};
  const codeCounts = {};
  for (const record of records) {
    increment(categoryCounts, record.category);
    increment(cohortCounts, record.cohort);
    increment(bucketCounts, record.triage_bucket);
    for (const code of record.structural_error_codes) increment(codeCounts, code);
  }
  return {
    total: records.length,
    active_ready: records.filter((record) => record.active_ready).length,
    newly_blocked: records.filter((record) => record.shadow_would_block_if_enforced).length,
    potential_regressions: records.filter((record) => record.potential_regression).length,
    correction_available: records.filter((record) => record.correction_available).length,
    category_counts: categoryCounts,
    cohort_counts: cohortCounts,
    bucket_counts: bucketCounts,
    structural_code_counts: codeCounts,
  };
}

const replayPath = argValue("--replay", DEFAULT_REPLAY);
const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
const jsonlPath = argValue("--jsonl", DEFAULT_JSONL);
const mdPath = argValue("--md", DEFAULT_MD);

const replayRows = readJsonl(replayPath);
const manifest = readManifest(manifestPath);
const manifestById = new Map(manifest.map((record) => [record.observation_id, record]));
const records = replayRows.map((entry) => analyzeRow(entry, manifestById));
const summary = tally(records);
const potentialRegressionIds = records
  .filter((record) => record.potential_regression)
  .map((record) => record.observation_id);

fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
fs.writeFileSync(jsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);

const md = [
  "# Final Option Structure Regression Triage",
  "",
  `- Replay source: ${replayPath}`,
  `- Manifest source: ${manifestPath}`,
  `- Total replay records: ${summary.total}`,
  `- Active PDF-ready records: ${summary.active_ready}`,
  `- Newly blocked under shadow enforcement: ${summary.newly_blocked}`,
  `- Potential regressions requiring held-out semantic review: ${summary.potential_regressions}`,
  "",
  "## Mutually Exclusive Categories",
  "",
  "| Category | Count |",
  "|---|---:|",
  ...sortedEntries(summary.category_counts).map(([category, count]) => `| ${category} | ${count} |`),
  "",
  "## Cohorts",
  "",
  "| Cohort | Count |",
  "|---|---:|",
  ...sortedEntries(summary.cohort_counts).map(([cohort, count]) => `| ${cohort} | ${count} |`),
  "",
  "## Triage Buckets",
  "",
  "| Bucket | Count |",
  "|---|---:|",
  ...sortedEntries(summary.bucket_counts).map(([bucket, count]) => `| ${bucket} | ${count} |`),
  "",
  "## Structural Codes",
  "",
  "| Code | Count |",
  "|---|---:|",
  ...sortedEntries(summary.structural_code_counts).map(([code, count]) => `| ${code} | ${count} |`),
  "",
  "## Potential Regression Review Set",
  "",
  potentialRegressionIds.length
    ? potentialRegressionIds.map((id) => `- ${id}`).join("\n")
    : "- None",
  "",
  "## Notes",
  "",
  "- This report is generated from saved local replay JSONL only.",
  "- The JSONL output intentionally excludes raw customer notes and full AlphaJSON payloads.",
  "- Potential regression means the current active output is PDF-ready, but shadow structural enforcement would block it and the observation is outside the reviewed manifest.",
  "- Every potential regression remains marked requires_held_out_semantic_review; this report is triage only, not semantic adjudication.",
  "",
].join("\n");
fs.writeFileSync(mdPath, md);

console.log(JSON.stringify({
  wrote_jsonl: jsonlPath,
  wrote_md: mdPath,
  summary,
}, null, 2));
