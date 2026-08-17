import { createClaimGraph, createRelationship } from "./claimGraph.js";
import { extractClaimsFromRaw } from "./extractClaims.js";

const CORRECTION_MARKER_PATTERN =
  /\b(?:actually|instead|make\s+that|scratch\s+that|correction)\b/i;

const OPINION_FILLER_PATTERN =
  /\bi\s+actually\s+(?:think|believe|feel|prefer|want)\b/i;

const SCOPE_RESTRICTION_PATTERN = /\b(?:only|just)\b/i;

const SCOPE_EXPANSION_PATTERN = /\b(?:also|add|adding|as\s+well|too|plus|and\s+also)\b/i;

const QUALIFIER_DETAIL_PATTERN = /\b(?:it'?s|which\s+is|that'?s|specifically|meaning)\b/i;

const NEGATION_LEAVE_PATTERN =
  /\b(?:leave|don't|do\s+not|dont|keep|not\s+remove)\b/i;

const OPTION_OR_PATTERN = /\bor\b/i;

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function claimText(claim) {
  return asString(claim?.evidence);
}

function speciesTokens(text) {
  const species =
    "oak|maple|pine|elm|ash|walnut|hickory|poplar|cedar|spruce|fir|beech|birch|cherry|locust|sycamore|tulip|sweetgum|tree";
  return [...asString(text).toLowerCase().matchAll(new RegExp(`\\b(?:${species})s?\\b`, "g"))]
    .map((match) => match[0].replace(/s$/, ""));
}

function locationTokens(text) {
  const locs = "rear|front|back|side|left|right|garage|house|driveway|fence|yard|street";
  return [...asString(text).toLowerCase().matchAll(new RegExp(`\\b(?:${locs})\\b`, "g"))]
    .map((match) => match[0]);
}

function entityTokensFromValue(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => asString(entry).toLowerCase().split(/[_\s]+/)).filter(Boolean);
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.entities)) {
      return value.entities.flatMap((entry) => asString(entry).toLowerCase().split(/[_\s]+/)).filter(Boolean);
    }
  }
  return [];
}

function claimEntityTokens(claim) {
  const fromValue = entityTokensFromValue(claim?.value);
  const fromEvidence = [...speciesTokens(claimText(claim)), ...locationTokens(claimText(claim))];
  return [...new Set([...fromValue, ...fromEvidence])];
}

function shareEntityFamily(earlier, later) {
  const a = new Set(claimEntityTokens(earlier));
  const b = new Set(claimEntityTokens(later));
  if (!a.size || !b.size) return false;
  for (const token of a) {
    if (b.has(token)) return true;
  }
  // Species-only overlap via evidence
  const speciesA = new Set(speciesTokens(claimText(earlier)));
  const speciesB = new Set(speciesTokens(claimText(later)));
  for (const token of speciesA) {
    if (speciesB.has(token)) return true;
  }
  return false;
}

function isLeaveClaim(claim) {
  if (claim?.value && typeof claim.value === "object" && claim.value.action === "leave") return true;
  return NEGATION_LEAVE_PATTERN.test(claimText(claim));
}

function isPluralScope(claim) {
  if (Array.isArray(claim?.value) && claim.value.length > 1) return true;
  return /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\s+\w*s\b/i.test(claimText(claim))
    || /\b(?:oaks|maples|pines|trees)\b/i.test(claimText(claim));
}

function isSingularScope(claim) {
  if (Array.isArray(claim?.value) && claim.value.length === 1) return true;
  if (claim?.value && typeof claim.value === "object" && Array.isArray(claim.value.entities)) {
    return claim.value.entities.length === 1;
  }
  return /\b(?:the\s+)?(?:rear|front|back|side)?\s*(?:oak|maple|pine|elm|ash|tree)\b/i.test(claimText(claim))
    && !isPluralScope(claim);
}

function surroundingPrefix(claim, rawText = "") {
  if (!rawText || !Number.isFinite(claim?.start)) return "";
  return rawText.slice(Math.max(0, claim.start - 48), claim.start);
}

function hasRevisionCorrectionMarker(claim, rawText = "") {
  const text = claimText(claim);
  const prefix = surroundingPrefix(claim, rawText);
  const combined = `${prefix}${text}`;
  if (OPINION_FILLER_PATTERN.test(combined) || OPINION_FILLER_PATTERN.test(text)) return false;
  if (CORRECTION_MARKER_PATTERN.test(text)) return true;
  // Leading marker in the same sentence, just before the matched span
  return /\b(?:actually|instead|make\s+that|scratch\s+that|correction)\b[,:]?\s*(?:(?:use|make\s+it|set|switch\s+to)\s+)?(?:(?:my|our|the)\s+)?(?:(?:phone|number|cell|mobile|price|quote|address)\b[,:]?\s*)?(?:is|to)?\s*$/i.test(prefix);
}

function betweenText(claims, earlier, later, rawText = "") {
  const start = Number.isFinite(earlier?.end) ? earlier.end : 0;
  const end = Number.isFinite(later?.start) ? later.start : start;
  if (rawText && end >= start) return rawText.slice(start, end);
  // Fall back to joining nearby evidence when raw slice unavailable
  return " ";
}

function samePhone(a, b) {
  return a?.value?.digits && a.value.digits === b?.value?.digits;
}

function sameAddress(a, b) {
  return a?.value?.normalized && a.value.normalized === b?.value?.normalized;
}

function priceQualifiersComplementary(a, b) {
  const left = a?.value?.qualifier || "";
  const right = b?.value?.qualifier || "";
  if (!left || !right) return false;
  const pair = new Set([left, right]);
  return (
    (pair.has("without_stump_grinding") && pair.has("with_stump_grinding"))
    || (pair.has("without_addon") && pair.has("with_addon"))
  );
}

function detectScopePair(earlier, later, rawText) {
  const signals = [];
  const laterText = claimText(later);
  const earlierLeave = isLeaveClaim(earlier);
  const laterLeave = isLeaveClaim(later);

  if (laterLeave && !earlierLeave) {
    // Positive scope + exclusion (leave X)
    if (!shareEntityFamily(earlier, later)) {
      signals.push("leave_exclusion", "distinct_entity");
      return createRelationship({
        from: later.id,
        to: earlier.id,
        type: "excludes",
        reason: "leave_exclusion",
        confidence: "confirmed",
        signals,
      });
    }
  }

  if (earlierLeave || laterLeave) return null;

  const correction = hasRevisionCorrectionMarker(later, rawText);
  const restriction = SCOPE_RESTRICTION_PATTERN.test(laterText);
  const sameFamily = shareEntityFamily(earlier, later);
  const pluralToSingular = isPluralScope(earlier) && isSingularScope(later);
  const singularToPlural = isSingularScope(earlier) && isPluralScope(later) && sameFamily;
  const sameCardinalitySingular = isSingularScope(earlier) && isSingularScope(later) && sameFamily;
  const combinedLater = `${surroundingPrefix(later, rawText)}${laterText}`;
  const expansionCue = SCOPE_EXPANSION_PATTERN.test(combinedLater);
  const qualifierDetail = QUALIFIER_DETAIL_PATTERN.test(laterText) ||
    locationTokens(laterText).some((token) => !locationTokens(claimText(earlier)).includes(token));

  if (correction) signals.push("correction_marker");
  if (restriction) signals.push("scope_restriction");
  if (sameFamily) signals.push("same_entity_family");
  if (pluralToSingular) signals.push("plural_to_singular");
  if (singularToPlural) signals.push("singular_to_plural");
  signals.push("document_order");

  // Opinion filler must never become supersession ("I actually think both trees...")
  if (OPINION_FILLER_PATTERN.test(combinedLater) || OPINION_FILLER_PATTERN.test(laterText)) {
    return null;
  }

  if (correction && sameFamily && (restriction || pluralToSingular)) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals,
    });
  }

  if (restriction && pluralToSingular && sameFamily) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "narrows",
      reason: "scope_restriction_singular",
      confidence: "confirmed",
      signals,
    });
  }

  if (correction && sameFamily) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals,
    });
  }

  if (sameFamily && pluralToSingular) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "narrows",
      reason: "plural_to_singular_same_entity",
      confidence: "needs_review",
      signals,
    });
  }

  if (singularToPlural && expansionCue) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "expands",
      reason: "scope_expansion_marker",
      confidence: "confirmed",
      signals: [...signals, "expansion_marker"],
    });
  }

  if (singularToPlural) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "expands",
      reason: "singular_to_plural_same_entity",
      confidence: "needs_review",
      signals,
    });
  }

  if (sameCardinalitySingular && !correction && !restriction && qualifierDetail) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "qualifies",
      reason: "same_entity_additional_detail",
      confidence: "needs_review",
      signals: [...signals, "qualifier_detail"],
    });
  }

  if (sameFamily && !correction && !restriction) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "contradicts",
      reason: "same_field_distinct_values_no_cue",
      confidence: "needs_review",
      signals: [...signals, "no_correction_cue"],
    });
  }

  return null;
}

function detectPricePair(earlier, later, rawText) {
  const signals = [];
  const between = betweenText([], earlier, later, rawText);
  const bridging = `${claimText(earlier)} ${between} ${claimText(later)}`;
  const complementary = priceQualifiersComplementary(earlier, later);
  const hasOr = OPTION_OR_PATTERN.test(bridging) || OPTION_OR_PATTERN.test(claimText(earlier)) || OPTION_OR_PATTERN.test(claimText(later));
  const correction = hasRevisionCorrectionMarker(later, rawText);

  if (complementary) signals.push("with_without_pair");
  if (hasOr) signals.push("option_or");
  if (correction) signals.push("correction_marker");
  signals.push("document_order");

  if (correction) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals,
    });
  }

  if (complementary || (hasOr && earlier?.value?.amount !== later?.value?.amount)) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "alternative_to",
      reason: complementary ? "with_without_price_options" : "or_linked_price_options",
      confidence: "confirmed",
      signals,
    });
  }

  if (earlier?.value?.amount !== later?.value?.amount) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "contradicts",
      reason: "distinct_prices_no_option_cue",
      confidence: "needs_review",
      signals: [...signals, "no_option_cue"],
    });
  }

  return createRelationship({
    from: later.id,
    to: earlier.id,
    type: "duplicates",
    reason: "same_price_amount",
    confidence: "confirmed",
    signals,
  });
}

function detectPhonePair(earlier, later, rawText) {
  if (hasRevisionCorrectionMarker(later, rawText)) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals: ["correction_marker", "document_order"],
    });
  }
  if (samePhone(earlier, later)) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "duplicates",
      reason: "normalized_phone_equivalent",
      confidence: "confirmed",
      signals: ["normalized_equality", "document_order"],
    });
  }
  return createRelationship({
    from: later.id,
    to: earlier.id,
    type: "contradicts",
    reason: "distinct_phones_no_correction_cue",
    confidence: "needs_review",
    signals: ["no_correction_cue", "document_order"],
  });
}

function detectAddressPair(earlier, later, rawText = "") {
  if (sameAddress(earlier, later)) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "duplicates",
      reason: "normalized_address_equivalent",
      confidence: "confirmed",
      signals: ["normalized_equality", "document_order"],
    });
  }
  const laterCorrection = hasRevisionCorrectionMarker(later, rawText);
  if (laterCorrection) {
    return createRelationship({
      from: later.id,
      to: earlier.id,
      type: "supersedes",
      reason: "explicit_correction_marker",
      confidence: "confirmed",
      signals: ["correction_marker", "document_order"],
    });
  }
  return createRelationship({
    from: later.id,
    to: earlier.id,
    type: "contradicts",
    reason: "distinct_addresses_no_correction_cue",
    confidence: "confirmed",
    signals: ["no_correction_cue", "document_order"],
  });
}

/**
 * Deterministic multi-signal relationship detector.
 * Does not invent winners; emits typed edges with confidence.
 *
 * @param {import("./claimGraph.js").Claim[]} claims
 * @param {string} [rawText]
 * @returns {import("./claimGraph.js").ClaimEdge[]}
 */
export function detectClaimRelationships(claims = [], rawText = "") {
  const list = Array.isArray(claims) ? [...claims] : [];
  list.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  const byField = new Map();
  for (const claim of list) {
    const field = asString(claim?.field);
    if (!field) continue;
    if (!byField.has(field)) byField.set(field, []);
    byField.get(field).push(claim);
  }

  const relationships = [];
  const seenPairs = new Set();

  for (const [, fieldClaims] of byField) {
    for (let i = 0; i < fieldClaims.length; i += 1) {
      for (let j = i + 1; j < fieldClaims.length; j += 1) {
        const earlier = fieldClaims[i];
        const later = fieldClaims[j];
        const pairKey = `${later.id}->${earlier.id}`;
        if (seenPairs.has(pairKey)) continue;

        let edge = null;
        if (earlier.field === "job.target_trees") {
          edge = detectScopePair(earlier, later, rawText);
        } else if (earlier.field === "job.price") {
          edge = detectPricePair(earlier, later, rawText);
        } else if (earlier.field === "customer.phone") {
          edge = detectPhonePair(earlier, later, rawText);
        } else if (earlier.field === "customer.address") {
          edge = detectAddressPair(earlier, later, rawText);
        }

        if (!edge) continue;
        seenPairs.add(pairKey);
        relationships.push(edge);
      }
    }
  }

  return relationships;
}

/**
 * Extract claims and detect relationships from raw notes.
 *
 * @param {string} rawInput
 * @returns {import("./claimGraph.js").ClaimGraph}
 */
export function buildClaimGraphFromRaw(rawInput = "") {
  const text = asString(rawInput);
  const claims = extractClaimsFromRaw(text);
  const relationships = detectClaimRelationships(claims, text);
  return createClaimGraph({ claims, relationships });
}
