#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalShadowEstimate } from "../lib/canonicalServiceAssembler.js";
import { validateFinalOptionStructure } from "../lib/finalOptionStructureValidator.js";
import { validateAlphaJson } from "../lib/validateJson.js";

const DEFAULT_REPLAY = "reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl";
const DEFAULT_MANIFEST = "reports/human-review-34-readiness-reconciliation-manifest.jsonl";
const DEFAULT_JSON = "reports/final-option-structure-shadow-report.json";
const DEFAULT_MD = "reports/final-option-structure-shadow-report.md";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
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

function classifyCodes(codes = []) {
  const codeSet = new Set(codes);
  if (codeSet.has("AMBIGUOUS_OPTION_RELATIONSHIP") ||
      codeSet.has("TARGET_BINDING_UNRESOLVED") ||
      codeSet.has("UNSUPPORTED_RELATIONSHIP_ARITHMETIC") ||
      codeSet.has("MULTI_ADDON_COMBINATION_UNSUPPORTED") ||
      codeSet.has("CONFLICTING_PACKAGE_TOTAL")) {
    return "ambiguous_or_unsupported";
  }
  if (codeSet.has("DEPENDENT_ADDON_STANDALONE") ||
      codeSet.has("EXPANDED_PRICE_MISMATCH") ||
      codeSet.has("EXPANDED_SCOPE_INCOMPLETE")) {
    return "dependent_addon_structure";
  }
  if (codeSet.has("GENERIC_OPTION_SCOPE") ||
      codeSet.has("CONTAMINATED_OPTION_SCOPE") ||
      codeSet.has("SAFETY_TEXT_IN_CUSTOMER_SCOPE")) {
    return "scope_quality";
  }
  return codes.length ? "other_structural" : "none";
}

function analyzeRow({ row, line }, manifestById) {
  const alphaJson = row.replay_after_implementation?.alphaJson_after_normalization;
  const activeValidation = validateAlphaJson(alphaJson);
  const structuralValidation = validateFinalOptionStructure(activeValidation.alphaJson, { enforce: true });
  const shadow = buildCanonicalShadowEstimate(activeValidation.alphaJson);
  const codes = structuralValidation.structural_error_codes;
  const activeReady = Boolean(activeValidation.can_generate_pdf);
  const wouldBlock = Boolean(activeReady && codes.length);
  const manifestRecord = manifestById.get(row.id);
  const cohort = manifestRecord?.cohort_membership || "full_382_only";

  return {
    observation_id: row.id,
    line,
    cohort,
    active_ready: activeReady,
    would_block_under_enforcement: wouldBlock,
    canonical_model_status: shadow.finalOptionModel.status,
    canonical_final_option_count: shadow.finalOptionModel.final_options.length,
    structural_error_codes: codes,
    category: classifyCodes(codes),
    expected_human_not_ready: Boolean(manifestRecord),
    potential_regression: wouldBlock && !manifestRecord,
  };
}

function tally(records) {
  const counts = {
    total: records.length,
    active_ready: records.filter((record) => record.active_ready).length,
    corrected_outputs: records.filter((record) =>
      record.active_ready &&
      record.canonical_model_status === "constructed" &&
      record.canonical_final_option_count === 2
    ).length,
    newly_blocked_outputs: records.filter((record) => record.would_block_under_enforcement).length,
    unchanged_outputs: records.filter((record) => !record.structural_error_codes.length).length,
    ambiguous_outputs: records.filter((record) => record.category === "ambiguous_or_unsupported").length,
    potential_regressions: records.filter((record) => record.potential_regression).length,
  };
  const byCode = {};
  for (const record of records) {
    for (const code of record.structural_error_codes) {
      byCode[code] = (byCode[code] || 0) + 1;
    }
  }
  return { counts, byCode };
}

const replayPath = argValue("--replay", DEFAULT_REPLAY);
const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
const jsonPath = argValue("--json", DEFAULT_JSON);
const mdPath = argValue("--md", DEFAULT_MD);

const replayRows = readJsonl(replayPath);
const manifest = readManifest(manifestPath);
const manifestById = new Map(manifest.map((record) => [record.observation_id, record]));
const analyzed = replayRows.map((entry) => analyzeRow(entry, manifestById));
const authoritative = analyzed.filter((record) => record.cohort === "authoritative_34");
const extra = analyzed.filter((record) => record.cohort === "extra_regression");
const fullTally = tally(analyzed);
const authoritativeTally = tally(authoritative);
const extraTally = tally(extra);

const report = {
  report_version: "final-option-structure-shadow-report-v1",
  replay_source: replayPath,
  manifest_source: manifestPath,
  total_replay_records: replayRows.length,
  full_382: fullTally,
  authoritative_34: authoritativeTally,
  extra_regression: extraTally,
  potential_regression_ids: analyzed.filter((record) => record.potential_regression).map((record) => record.observation_id),
  reviewed_case_ids_with_correction_available: authoritative
    .filter((record) => record.canonical_model_status === "constructed")
    .map((record) => record.observation_id),
  records: analyzed,
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Final Option Structure Shadow Report",
  "",
  `- Replay source: ${replayPath}`,
  `- Manifest source: ${manifestPath}`,
  `- Total replay records: ${replayRows.length}`,
  "",
  "## Counts",
  "",
  "| Cohort | Corrected outputs | Newly blocked outputs | Unchanged outputs | Ambiguous outputs | Potential regressions |",
  "|---|---:|---:|---:|---:|---:|",
  `| Full 382 | ${fullTally.counts.corrected_outputs} | ${fullTally.counts.newly_blocked_outputs} | ${fullTally.counts.unchanged_outputs} | ${fullTally.counts.ambiguous_outputs} | ${fullTally.counts.potential_regressions} |`,
  `| Authoritative 34 | ${authoritativeTally.counts.corrected_outputs} | ${authoritativeTally.counts.newly_blocked_outputs} | ${authoritativeTally.counts.unchanged_outputs} | ${authoritativeTally.counts.ambiguous_outputs} | ${authoritativeTally.counts.potential_regressions} |`,
  `| Extra regression | ${extraTally.counts.corrected_outputs} | ${extraTally.counts.newly_blocked_outputs} | ${extraTally.counts.unchanged_outputs} | ${extraTally.counts.ambiguous_outputs} | ${extraTally.counts.potential_regressions} |`,
  "",
  "## Structural Codes In Full 382",
  "",
  ...Object.entries(fullTally.byCode).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code, count]) => `- ${code}: ${count}`),
  "",
  "## Potential Regression IDs",
  "",
  report.potential_regression_ids.length ? report.potential_regression_ids.map((id) => `- ${id}`).join("\n") : "- None",
  "",
  "## Notes",
  "",
  "- This is a local saved-replay shadow analysis only. It does not call live OpenAI or production APIs.",
  "- Newly blocked means the current active validation was PDF-ready but structural enforcement would block it.",
  "- Corrected outputs means the shadow canonical model can build two final customer options for a dependent-add-on structure.",
  "- Potential regressions are non-reviewed records that are currently PDF-ready and would be blocked by the new structural validator.",
  "",
].join("\n");
fs.writeFileSync(mdPath, md);

console.log(JSON.stringify({
  wrote: jsonPath,
  summary: mdPath,
  full_382: fullTally.counts,
  authoritative_34: authoritativeTally.counts,
  extra_regression: extraTally.counts,
}, null, 2));
