import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CANONICAL_SERVICE_ASSEMBLER_VERSION,
  ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG,
  buildCanonicalShadowEstimate,
  inferServiceKindFromText,
} from "../lib/canonicalServiceAssembler.js";

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const SOURCE_PATH = path.join(REPORT_DIR, "live-sidecar-fixed-382-2026-07-10T06-14-19-758Z.jsonl");
const OUT_JSONL = path.join(REPORT_DIR, "canonical-service-assembler-shadow.jsonl");

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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileHash(filePath) {
  requireFile(filePath);
  return sha256(fs.readFileSync(filePath));
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

function optionSummary(options = []) {
  return options
    .map((option, index) => {
      const amount = optionAmount(option);
      return {
        label: compact(option.label) || `Option ${String.fromCharCode(65 + index)}`,
        title: compact(option.title),
        description: compact(option.description),
        amount,
        display: compact(option.price?.display) || money(amount),
        service_kind: optionServiceKind(option),
        relationship_type: option.canonical_service_item?.relationship_type || option.canonical_option?.relationship_type || "",
        source: compact(option.source),
      };
    })
    .filter((option) => option.amount || option.title || option.description);
}

function multiset(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort();
}

function sameMultiset(left, right, keyFn) {
  return JSON.stringify(multiset(left, keyFn)) === JSON.stringify(multiset(right, keyFn));
}

function compareCase(row) {
  const alphaJson = row.current?.alphaJson_after_normalization;
  if (!alphaJson) throw new Error(`Missing AlphaJSON for ${row.id}`);
  const activeOptions = optionSummary(alphaJson.service_options?.items || []);
  const shadow = buildCanonicalShadowEstimate(alphaJson);
  const shadowOptions = optionSummary(shadow.renderedOptions);
  const price_multiset_changed = !sameMultiset(activeOptions, shadowOptions, (item) => item.amount);
  const amount_kind_multiset_changed = !sameMultiset(activeOptions, shadowOptions, (item) => `${item.amount}|${item.service_kind}`);
  const title_or_description_changed = JSON.stringify(activeOptions.map((item) => [item.title, item.description])) !==
    JSON.stringify(shadowOptions.map((item) => [item.title, item.description]));

  return {
    record_type: "shadow_comparison",
    source_set: "382_replay",
    case_id: row.id,
    difficulty: row.difficulty || "",
    feature_flag_enabled: false,
    production_behavior_changed: false,
    active_options: activeOptions,
    shadow_options: shadowOptions,
    changed: {
      option_count_changed: activeOptions.length !== shadowOptions.length,
      price_multiset_changed,
      amount_kind_multiset_changed,
      title_or_description_changed,
    },
    semantic_validation: shadow.semanticValidation,
    canonical_semantic_hash: shadow.canonical_semantic_hash,
  };
}

function aggregate(records) {
  const cases = records.filter((record) => record.record_type === "shadow_comparison");
  return {
    record_type: "shadow_aggregate",
    rows: cases.length,
    feature_flag_enabled: false,
    production_behavior_changed: false,
    option_count_changed: cases.filter((record) => record.changed.option_count_changed).length,
    price_multiset_changed: cases.filter((record) => record.changed.price_multiset_changed).length,
    amount_kind_multiset_changed: cases.filter((record) => record.changed.amount_kind_multiset_changed).length,
    title_or_description_changed: cases.filter((record) => record.changed.title_or_description_changed).length,
    semantic_structural_error_cases: cases.filter((record) => record.semantic_validation.structural_error_codes.length).length,
    semantic_pdf_ready_rows: cases.filter((record) => record.semantic_validation.can_generate_pdf).length,
  };
}

function main() {
  const rows = readJsonl(SOURCE_PATH);
  const comparisons = rows.map(compareCase);
  const metadata = {
    record_type: "shadow_metadata",
    generated_at: new Date().toISOString(),
    module_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    feature_flag: ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG,
    feature_flag_enabled: false,
    production_behavior_changed: false,
    source_file: SOURCE_PATH,
    source_sha256: fileHash(SOURCE_PATH),
    module_sha256: fileHash(path.join(ROOT, "lib", "canonicalServiceAssembler.js")),
    git_commit: git(["rev-parse", "HEAD"], "unknown"),
    git_branch: git(["branch", "--show-current"], "unknown"),
    git_dirty_short: git(["status", "--short"], ""),
  };
  const output = [metadata, aggregate(comparisons), ...comparisons];
  writeJsonl(OUT_JSONL, output);
  console.log(`Wrote ${OUT_JSONL}`);
}

main();
