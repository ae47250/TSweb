#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_SOURCE = "reports/live-382-production-replay-current-direct-ab-followup-provenance.jsonl";
const DEFAULT_SOURCE_CASES = "human-review-34-source-cases.md";
const DEFAULT_REVIEW = "C:/Users/eiriksson/Downloads/human-review-34-readiness-changes(10).md";
const DEFAULT_OUT = "reports/human-review-34-readiness-reconciliation-manifest.jsonl";
const DEFAULT_SUMMARY = "reports/human-review-34-readiness-reconciliation-manifest.md";
const MANIFEST_VERSION = "human-review-readiness-v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line, index) => ({
    line: index + 1,
    row: JSON.parse(line),
  }));
}

function amountFromDisplay(display) {
  const match = String(display || "").replace(/,/g, "").match(/\$?(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1])) : null;
}

function titleCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function serviceKindFor(text) {
  const normalized = String(text || "").toLowerCase();
  if (/stumps?|grind/.test(normalized)) return "stump_grinding";
  if (/haul/.test(normalized)) return "haul_away";
  if (/brush/.test(normalized)) return "brush_cleanup";
  if (/storm/.test(normalized)) return "storm_cleanup";
  if (/limb|branch/.test(normalized) && /cut|remove|removal/.test(normalized)) return "limb_removal";
  if (/trim|prune/.test(normalized)) return "tree_trim";
  if (/remove|removal|take down|rmv|tree removal/.test(normalized)) return "tree_removal";
  return "other_supported_service";
}

function scopeFactsFor(text) {
  const normalized = String(text || "").toLowerCase();
  const facts = {
    normalized_scope_text: String(text || "").trim(),
    service_kind: serviceKindFor(text),
  };
  const location = normalized.match(/\b(?:by|near|toward|over|in|along)\s+(?:the\s+)?[a-z][a-z\s-]{2,40}/);
  if (location) facts.location = location[0].trim();
  const species = normalized.match(/\b(?:ash|cedar|oak|maple|pine|pear|ornamental pear)\b/);
  if (species) facts.species = species[0];
  const count = normalized.match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:small\s+|large\s+|dead\s+|fallen\s+|ornamental\s+)?(?:tree|trees|pear|pears|limb|limbs|branch|branches)\b/);
  if (count) facts.quantity = count[0];
  return facts;
}

function parseSourceCases(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cases = [];
  let current = null;
  let wantRaw = false;
  let inFence = false;
  for (const line of lines) {
    let match = line.match(/^## Case (\d+) of 34/);
    if (match) {
      current = { cohort_position: Number(match[1]) };
      continue;
    }
    match = line.match(/^- Case ID: (obs_\d+)/);
    if (match && current) {
      current.observation_id = match[1];
      continue;
    }
    if (line === "- Raw customer note:") {
      wantRaw = true;
      continue;
    }
    if (wantRaw && line.charCodeAt(0) === 96) {
      wantRaw = false;
      inFence = true;
      continue;
    }
    if (inFence && current) {
      current.raw_text = line;
      cases.push(current);
      current = null;
      inFence = false;
    }
  }
  return cases;
}

function parseReviewBlocks(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const blocks = text.split(/\n(?=## Observation)/).filter((block) => /provisional ID obs_\d+/.test(block));
  return blocks.map((block, index) => {
    const id = block.match(/provisional ID (obs_\d+)/)?.[1] || "";
    const raw = block.match(/\*\*Raw customer input text \(identity source of truth\):\*\*\s*([^\r\n]+)/)?.[1]?.trim() || "";
    return {
      review_position: index + 1,
      provisional_observation_id: id,
      raw_text: raw,
      expected_final_options: parseExpectedFinalOptions(block, id),
    };
  });
}

function parseExpectedFinalOptions(block, observationId) {
  if (observationId === "obs_0724") {
    return expectedOptionsFromTitles([
      ["Take down the dead ash tree by the shed", 2500],
      ["Take down the dead ash tree by the shed and grind the stump", 3250],
    ]);
  }
  const normalized = block.replace(/\s+/g, " ");
  const match = normalized.match(/Correct structure:\s*Option A,?\s*(.*?)\s+(?:for|[-–—])\s+\$([\d,]+).*?Option B,?\s*(.*?)\s+(?:for|[-–—])\s+\$([\d,]+)/i);
  if (!match) return [];
  return expectedOptionsFromTitles([
    [titleCase(match[1]), amountFromDisplay(match[2])],
    [titleCase(match[3]), amountFromDisplay(match[4])],
  ]);
}

function expectedOptionsFromTitles(pairs) {
  return pairs.map(([title, amount], index) => ({
    label: `Option ${String.fromCharCode(65 + index)}`,
    title,
    description: title,
    amount_cents: amount * 100,
    currency: "USD",
    structured_scope_facts: scopeFactsFor(title),
    service_role: index === 0 ? "primary_service" : "primary_service_with_dependent_addon",
    price_relationship: index === 0 ? "standalone" : "total_of",
    selectability: "selectable",
    source_evidence_ids: [],
    target_id: `target_${sha256(title).slice(0, 12)}`,
  }));
}

function sourceEvidenceFor(row, expectedOptions) {
  const rec = row.replay_after_implementation?.alphaJson_after_normalization?.normalization?.sidecar_price_reconciliation || {};
  const prices = Array.isArray(rec.sidecar_prices) ? rec.sidecar_prices : [];
  const relationships = Array.isArray(rec.monetary_relationships) ? rec.monetary_relationships : [];
  const totalRelationship = relationships.find((relationship) => relationship.type === "total_of");
  return expectedOptions.map((option, index) => {
    if (index === 0) {
      const price = prices.find((item) => Math.round(Number(item.amount)) * 100 === option.amount_cents);
      return {
        ...option,
        source_evidence_ids: [price?.price_id].filter(Boolean),
      };
    }
    return {
      ...option,
      source_evidence_ids: [
        totalRelationship?.relationship_id,
        totalRelationship?.total_price_id,
        ...(totalRelationship?.component_price_ids || []),
      ].filter(Boolean),
    };
  });
}

function buildManifest({ sourcePath, sourceCasesPath, reviewPath }) {
  const replayRows = readJsonl(sourcePath);
  const byRaw = new Map(replayRows.map(({ line, row }) => [row.input, { line, row }]));
  const sourceCases = parseSourceCases(sourceCasesPath);
  const reviewBlocks = parseReviewBlocks(reviewPath);
  const reviewByRawHash = new Map(reviewBlocks.map((entry) => [sha256(entry.raw_text), entry]));
  const extraReview = reviewBlocks[0];
  const records = [];

  if (sourceCases.length !== 34) {
    throw new Error(`Expected 34 source cases, found ${sourceCases.length}`);
  }
  if (reviewBlocks.length !== 34) {
    throw new Error(`Expected 34 review observations, found ${reviewBlocks.length}`);
  }

  for (const sourceCase of sourceCases) {
    const rawHash = sha256(sourceCase.raw_text);
    const replay = byRaw.get(sourceCase.raw_text);
    if (!replay) throw new Error(`No replay raw-text match for ${sourceCase.observation_id}`);
    const review = sourceCase.observation_id === "obs_0724"
      ? {
          expected_final_options: parseExpectedFinalOptions("", "obs_0724"),
        }
      : reviewByRawHash.get(rawHash);
    if (!review) throw new Error(`No human-review raw-text match for ${sourceCase.observation_id}`);
    const expectedFinalOptions = sourceEvidenceFor(replay.row, review.expected_final_options);
    records.push({
      record_type: "human_review_readiness_case",
      manifest_version: MANIFEST_VERSION,
      cohort: "blocked_to_pdf_ready_34",
      cohort_position: sourceCase.cohort_position,
      cohort_membership: "authoritative_34",
      observation_id: sourceCase.observation_id,
      raw_text_sha256: rawHash,
      stable_source_record_id: replay.row.id,
      source_records: [
        {
          filename: sourcePath,
          line: replay.line,
          field: "input",
        },
      ],
      previous_readiness: Boolean(replay.row.saved_current_before_replay?.validation?.can_generate_pdf),
      new_readiness: Boolean(replay.row.replay_after_implementation?.validation?.can_generate_pdf),
      human_verdict: "not_pdf_ready",
      expected_final_options: expectedFinalOptions,
      extra_regression: false,
      regression_test_status: sourceCase.observation_id === "obs_0724" ? "covered" : "pending",
    });
  }

  const extraReplay = byRaw.get(extraReview.raw_text);
  if (!extraReplay) throw new Error("No replay raw-text match for extra regression obs_0730");
  records.push({
    record_type: "human_review_readiness_case",
    manifest_version: MANIFEST_VERSION,
    cohort: "blocked_to_pdf_ready_34_extra_regression",
    cohort_position: null,
    cohort_membership: "extra_regression",
    observation_id: extraReplay.row.id,
    raw_text_sha256: sha256(extraReview.raw_text),
    stable_source_record_id: extraReplay.row.id,
    source_records: [
      {
        filename: sourcePath,
        line: extraReplay.line,
        field: "input",
      },
    ],
    previous_readiness: Boolean(extraReplay.row.saved_current_before_replay?.validation?.can_generate_pdf),
    new_readiness: Boolean(extraReplay.row.replay_after_implementation?.validation?.can_generate_pdf),
    human_verdict: "not_pdf_ready_extra_regression",
    expected_final_options: sourceEvidenceFor(extraReplay.row, extraReview.expected_final_options),
    extra_regression: true,
    regression_test_status: "covered_as_no_total_structural_ambiguity",
  });

  return records;
}

function writeManifest(records, outPath, summaryPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const authoritative = records.filter((record) => record.cohort_membership === "authoritative_34");
  const extra = records.filter((record) => record.extra_regression);
  const covered = records.filter((record) => /^covered/.test(record.regression_test_status || "")).length;
  const summary = [
    "# Human Review 34 Readiness Reconciliation Manifest",
    "",
    `- Manifest version: ${MANIFEST_VERSION}`,
    `- Authoritative records: ${authoritative.length}`,
    `- Extra regression records: ${extra.length}`,
    `- Authoritative position 1: ${authoritative[0]?.observation_id || ""}`,
    `- Extra regression ID: ${extra[0]?.observation_id || ""}`,
    `- Records with covered regression status: ${covered}`,
    "- Privacy: JSONL stores SHA-256 hashes and structured expected options only; it does not store raw customer notes.",
    "",
    "## Verification Command",
    "",
    "```bash",
    "node scripts/generate-human-review-readiness-manifest.js --verify-existing",
    "```",
    "",
  ].join("\n");
  fs.writeFileSync(summaryPath, summary);
}

function verifyExisting({ sourcePath, outPath }) {
  const sourceAvailable = fs.existsSync(sourcePath);
  const replayRows = sourceAvailable ? readJsonl(sourcePath) : [];
  const byId = new Map(replayRows.map(({ line, row }) => [row.id, { line, row }]));
  const records = fs.readFileSync(outPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const authoritative = records.filter((record) => record.cohort_membership === "authoritative_34");
  const extra = records.filter((record) => record.extra_regression);
  const failures = [];

  if (authoritative.length !== 34) failures.push(`Expected 34 authoritative records, found ${authoritative.length}`);
  if (authoritative[0]?.observation_id !== "obs_0724") failures.push("Authoritative position 1 must be obs_0724");
  if (extra.length !== 1 || extra[0].observation_id !== "obs_0730") failures.push("Expected exactly one extra regression record, obs_0730");
  if (records.some((record) => Object.hasOwn(record, "raw_text"))) failures.push("Manifest must not contain raw_text");
  for (const record of records) {
    if (!Array.isArray(record.expected_final_options) || record.expected_final_options.length !== 2) {
      failures.push(`Expected two final options for ${record.observation_id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.raw_text_sha256 || "")) {
      failures.push(`Invalid raw-text hash for ${record.observation_id}`);
    }
    if (!sourceAvailable) continue;
    const replay = byId.get(record.observation_id);
    if (!replay) {
      failures.push(`Missing source row for ${record.observation_id}`);
      continue;
    }
    if (sha256(replay.row.input) !== record.raw_text_sha256) failures.push(`Raw-text hash drift for ${record.observation_id}`);
    if (record.source_records?.[0]?.line !== replay.line) failures.push(`Source line drift for ${record.observation_id}`);
  }

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    ok: true,
    authoritative_count: authoritative.length,
    extra_regression_count: extra.length,
    authoritative_position_1: authoritative[0].observation_id,
    extra_regression_id: extra[0].observation_id,
    source_drift_checked: sourceAvailable,
  }, null, 2));
}

const sourcePath = argValue("--source", DEFAULT_SOURCE);
const sourceCasesPath = argValue("--source-cases", DEFAULT_SOURCE_CASES);
const reviewPath = argValue("--review", DEFAULT_REVIEW);
const outPath = argValue("--out", DEFAULT_OUT);
const summaryPath = argValue("--summary", DEFAULT_SUMMARY);

if (hasArg("--verify-existing")) {
  verifyExisting({ sourcePath, outPath });
} else {
  const records = buildManifest({ sourcePath, sourceCasesPath, reviewPath });
  writeManifest(records, outPath, summaryPath);
  console.log(JSON.stringify({
    wrote: outPath,
    summary: summaryPath,
    records: records.length,
    authoritative_34: records.filter((record) => record.cohort_membership === "authoritative_34").length,
    extra_regression: records.filter((record) => record.extra_regression).length,
  }, null, 2));
}
