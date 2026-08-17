import {
  TREE_SCOPE_POLICY_VERSION,
  attachDecisionEnvelopes,
  createCandidate,
  createEnvelope,
  selectCandidate,
} from "./decisionEnvelope.js";

const NUMBER_WORDS = new Map([
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
]);

const CORRECTION_CUE_PATTERN =
  /\b(?:actually|instead|make\s+that|correction|only\s+(?:remove|take|cut|grind)|just\s+(?:remove|take|cut)\s+the)\b/i;

const TREE_COUNT_DESCRIPTORS =
  "dead|large|big|small|leaning|fallen|mature|ornamental|damaged|storm|silver|river|sweet|bradford";
const TREE_COUNT_SPECIES =
  "oak|maple|pine|elm|ash|walnut|hickory|poplar|cedar|spruce|fir|beech|birch|cherry|locust|sycamore|tulip|sweetgum";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeCountDisplay(value) {
  const text = asString(value).trim();
  if (!text) return "";
  if (/^\s*5\+/.test(text)) return "5+ trees";
  if (/^3\s*\+/i.test(text)) return "3+ trees";
  if (/^unknown$/i.test(text)) return "Unknown";
  if (/still\s+unclear.*ok.*proceed/i.test(text)) return "Still unclear but OK to proceed";

  const numeric = text.match(/\b\d+\b/);
  if (numeric) {
    const count = Number(numeric[0]);
    if (!Number.isFinite(count)) return text;
    return `${numeric[0]} ${count === 1 ? "tree" : "trees"}`;
  }
  const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word) {
    const count = NUMBER_WORDS.get(word[1]);
    return `${count} ${count === "1" ? "tree" : "trees"}`;
  }
  return text;
}

function comparableCount(value) {
  return normalizeCountDisplay(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function countValueFromClaim(claim = {}) {
  if (Array.isArray(claim.value)) {
    const count = claim.value.length;
    return count ? `${count} ${count === 1 ? "tree" : "trees"}` : "";
  }
  if (claim.value && typeof claim.value === "object" && Array.isArray(claim.value.entities)) {
    const count = claim.value.entities.length;
    return count ? `${count} ${count === 1 ? "tree" : "trees"}` : "";
  }
  return normalizeCountDisplay(claim.value);
}

function claimEvidenceMatchesCandidate(candidate, claim) {
  const claimStart = Number(claim?.start);
  const claimEnd = Number(claim?.end);
  return (candidate?.evidence || []).some((evidence) => {
    if (Number.isFinite(claimStart) && Number.isFinite(claimEnd) && Number.isFinite(evidence.start) && Number.isFinite(evidence.end)) {
      return evidence.start < claimEnd && claimStart < evidence.end;
    }
    const candidateQuote = asString(evidence.quote).toLowerCase();
    const claimQuote = asString(claim.evidence).toLowerCase();
    return Boolean(candidateQuote && claimQuote && (candidateQuote.includes(claimQuote) || claimQuote.includes(candidateQuote)));
  });
}

function graphCorrectionCandidate(candidates, claimGraph) {
  const claimsById = new Map((claimGraph?.claims || []).map((claim) => [claim.id, claim]));
  const corrections = (claimGraph?.relationships || [])
    .filter((relationship) => relationship.confidence === "confirmed" && ["supersedes", "narrows"].includes(relationship.type))
    .map((relationship) => ({ relationship, claim: claimsById.get(relationship.from) }))
    .filter(({ claim }) => claim?.field === "job.target_trees")
    .sort((left, right) => (right.claim.start ?? -1) - (left.claim.start ?? -1));

  for (const { relationship, claim } of corrections) {
    const claimValue = countValueFromClaim(claim);
    if (!claimValue) continue;
    const candidate = candidates.find((item) => claimEvidenceMatchesCandidate(item, claim) && comparableCount(item.value) === comparableCount(claimValue));
    if (candidate) return { candidate, relationship };
  }
  return null;
}

function pushUniqueCandidate(list, candidate, seen) {
  const key = `${candidate.source}|${comparableCount(candidate.value)}|${candidate.evidence?.[0]?.quote || ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(candidate);
}

function findQuoteSpan(rawText, quote) {
  const text = asString(rawText);
  const needle = asString(quote);
  if (!text || !needle) return null;
  const start = text.toLowerCase().indexOf(needle.toLowerCase());
  if (start < 0) return null;
  return { start, end: start + needle.length };
}

/**
 * Collect competing raw tree-count claims without changing selection.
 * Includes explicit counts and correction-language phrases for preservation.
 */
export function collectRawTreeCountClaimQuotes(rawInput = "") {
  const text = asString(rawInput);
  if (!text) return [];

  const claims = [];
  const seen = new Set();

  const countPatterns = [
    new RegExp(
      `\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:(?:${TREE_COUNT_DESCRIPTORS})\\s+){0,4}trees?\\b`,
      "gi",
    ),
    new RegExp(
      `\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:(?:${TREE_COUNT_DESCRIPTORS})\\s+){0,4}(?:${TREE_COUNT_SPECIES})s?\\b`,
      "gi",
    ),
  ];

  for (const pattern of countPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const quote = asString(match[0]).trim();
      const key = quote.toLowerCase();
      if (!quote || seen.has(key)) continue;
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 16);
      const addressTail = /^\s+(?:(?:[A-Za-z0-9.'-]+)\s+){0,3}(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|way|highway|hwy|route)\b/i;
      if (addressTail.test(after) || /\b(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|way|highway|hwy|route)\b/i.test(quote)) continue;
      seen.add(key);
      const token = match[1];
      const count = /^\d+$/.test(token) ? token : NUMBER_WORDS.get(token.toLowerCase());
      claims.push({
        quote,
        value: count ? `${count} ${count === "1" ? "tree" : "trees"}` : quote,
        support: "explicit",
        start: match.index,
        end: match.index + match[0].length,
        reasonCodes: ["raw_count_claim"],
      });
    }
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  let cursor = 0;
  for (const sentence of sentences) {
    const trimmed = asString(sentence).trim();
    const start = text.indexOf(trimmed, cursor);
    const end = start >= 0 ? start + trimmed.length : cursor;
    if (start >= 0) cursor = end;
    if (!trimmed || !CORRECTION_CUE_PATTERN.test(trimmed)) continue;
    if (!/\b(?:tree|trees|oak|oaks|maple|maples|pine|pines|elm|elms|ash|ashes|cedar|cedars|remove|removal|take\s+down|cut|drop|trim|prune|stump|grind)\b/i.test(trimmed)) continue;
    if (seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());

    const singularOnly = /\bonly\b.{0,40}\b(?:the\s+)?(?:rear\s+|front\s+|back\s+)?(?:oak|maple|pine|elm|ash|walnut|hickory|tree)\b/i.test(trimmed);
    const explicitCount = trimmed.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+){0,4}trees?\b/i);
    let value = "";
    if (explicitCount) {
      value = normalizeCountDisplay(explicitCount[0]);
    } else if (singularOnly) {
      value = "1 tree";
    } else {
      value = trimmed;
    }

    claims.push({
      quote: trimmed,
      value,
      support: explicitCount ? "explicit" : "inferred",
      start: start >= 0 ? start : undefined,
      end: start >= 0 ? end : undefined,
      reasonCodes: ["correction_language_claim", "preserved_not_arbitrated"],
    });
  }

  return claims;
}

function buildSourceCandidate({
  id,
  value,
  source,
  support,
  quote,
  rawText,
  status = "eligible",
  reasonCodes = [],
}) {
  const display = normalizeCountDisplay(value);
  if (!display && source !== "reviewer") return null;
  const evidenceQuote = asString(quote || value).trim();
  const span = findQuoteSpan(rawText, evidenceQuote);
  const evidence = evidenceQuote
    ? [{ quote: evidenceQuote, ...(span || {}) }]
    : [];
  return createCandidate({
    id,
    value: display || asString(value),
    source,
    support,
    evidence,
    status,
    reasonCodes,
  });
}

/**
 * Build a tree-count DecisionEnvelope from already-resolved selection inputs.
 * Winner must match current firstString / override behavior; this only preserves candidates.
 */
export function buildTreeCountDecisionEnvelope({
  selectedValue = "",
  rawInput = "",
  treeCountOverride = "",
  modelCandidates = [],
  rawExtracted = "",
  uncertainTreeCount = false,
  requiresReview = false,
  abstained = false,
  claimGraph = null,
} = {}) {
  const candidates = [];
  const seen = new Set();
  let index = 0;

  const add = (candidate) => {
    if (!candidate) return;
    pushUniqueCandidate(candidates, candidate, seen);
  };

  if (treeCountOverride) {
    add(buildSourceCandidate({
      id: `tree_override_${++index}`,
      value: treeCountOverride,
      source: "reviewer",
      support: "explicit",
      quote: `Tree count override: ${treeCountOverride}`,
      rawText: rawInput,
      reasonCodes: ["tree_count_override"],
    }));
  }

  for (const entry of Array.isArray(modelCandidates) ? modelCandidates : []) {
    const value = asString(entry?.value);
    if (!value || uncertainTreeCount) continue;
    add(buildSourceCandidate({
      id: `tree_model_${++index}`,
      value,
      source: "model",
      support: "explicit",
      quote: value,
      rawText: rawInput,
      reasonCodes: [asString(entry?.reasonCode) || "model_tree_count"],
    }));
  }

  if (rawExtracted) {
    add(buildSourceCandidate({
      id: `tree_raw_extract_${++index}`,
      value: rawExtracted,
      source: "raw_notes",
      support: "explicit",
      quote: rawExtracted,
      rawText: rawInput,
      reasonCodes: ["extract_tree_count_from_raw"],
    }));
  }

  for (const claim of collectRawTreeCountClaimQuotes(rawInput)) {
    add(buildSourceCandidate({
      id: `tree_raw_claim_${++index}`,
      value: claim.value,
      source: "raw_notes",
      support: claim.support,
      quote: claim.quote,
      rawText: rawInput,
      reasonCodes: claim.reasonCodes,
    }));
  }

  const graphCorrection = treeCountOverride ? null : graphCorrectionCandidate(candidates, claimGraph);
  const selectedDisplay = graphCorrection?.candidate?.value || normalizeCountDisplay(selectedValue);
  let selectedId = "";
  if (selectedDisplay) {
    const match = graphCorrection?.candidate || candidates.find((candidate) => comparableCount(candidate.value) === comparableCount(selectedDisplay));
    if (match) {
      selectedId = match.id;
    } else {
      const synthetic = buildSourceCandidate({
        id: `tree_selected_${++index}`,
        value: selectedDisplay,
        source: treeCountOverride ? "reviewer" : "deterministic_rule",
        support: "normalized_explicit",
        quote: selectedDisplay,
        rawText: rawInput,
        reasonCodes: ["selected_by_existing_policy"],
      });
      if (synthetic) {
        add(synthetic);
        selectedId = synthetic.id;
      }
    }
  }

  let resolvedCandidates = candidates;
  if (selectedId) {
    resolvedCandidates = selectCandidate(candidates, selectedId);
  }

  let resolution;
  if (abstained || /^unknown$/i.test(asString(treeCountOverride)) || /still\s+unclear.*ok.*proceed/i.test(asString(treeCountOverride))) {
    resolution = {
      status: "abstained",
      reasonCode: "insufficient_support",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: treeCountOverride ? "reviewer" : "tree_scope_policy",
    };
  } else if (graphCorrection?.candidate) {
    resolution = {
      status: "selected",
      selectedCandidateId: selectedId,
      reasonCode: "explicit_correction",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    };
  } else if (requiresReview) {
    resolution = {
      status: "requires_review",
      ...(selectedId ? { selectedCandidateId: selectedId } : {}),
      reasonCode: resolvedCandidates.length > 1
        ? "conflicting_supported_candidates"
        : "insufficient_support",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    };
  } else if (!selectedId) {
    resolution = {
      status: "unresolved",
      reasonCode: "insufficient_support",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    };
  } else if (treeCountOverride) {
    resolution = {
      status: "selected",
      selectedCandidateId: selectedId,
      reasonCode: "explicit_correction",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "reviewer",
    };
  } else if (resolvedCandidates.filter((candidate) => candidate.source === "raw_notes").length > 1) {
    resolution = {
      status: "selected",
      selectedCandidateId: selectedId,
      reasonCode: "conflicting_supported_candidates",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    };
  } else {
    resolution = {
      status: "selected",
      selectedCandidateId: selectedId,
      reasonCode: "single_explicit_candidate",
      policyVersion: TREE_SCOPE_POLICY_VERSION,
      resolvedBy: "tree_scope_policy",
    };
  }

  return createEnvelope({
    field: "job.tree_details.tree_count",
    candidates: resolvedCandidates,
    resolution,
  });
}

export function attachTreeCountDecisionEnvelope(alphaJson = {}, envelope = null) {
  if (!envelope) return alphaJson;
  return attachDecisionEnvelopes(alphaJson, { tree_count: envelope });
}
