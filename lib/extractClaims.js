import { createClaim } from "./claimGraph.js";
import { normalizePhoneCandidate } from "./contactNormalizer.js";

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

const TREE_SPECIES =
  "oak|maple|pine|elm|ash|walnut|hickory|poplar|cedar|spruce|fir|beech|birch|cherry|locust|sycamore|tulip|sweetgum|tree";

const LOCATION_MODIFIERS = "rear|front|back|side|left|right|near|by|beside|behind|garage|house|driveway|fence|yard|street";

const PHONE_PATTERN = /(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g;

const ADDRESS_SUFFIX =
  "(?:Street|St|Road|Rd|Ave|Avenue|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy|Route|Pike|Circle|Cir|Place|Pl|Terrace|Ter|Trail|Trl|Parkway|Pkwy)";

const ADDRESS_PATTERN = new RegExp(
  `\\b\\d+\\s+(?:[A-Za-z0-9.]+\\s+){0,5}${ADDRESS_SUFFIX}\\b(?:\\s*,?\\s*[A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,2}(?:\\s*,?\\s*(?:[A-Z]{2}|Indiana))?(?:\\s+\\d{5}(?:-\\d{4})?)?)?`,
  "gi",
);

const PRICE_PATTERN = /\$\s*([\d,]+(?:\.\d{2})?)/g;

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function countTokenToNumber(token) {
  const raw = asString(token).toLowerCase();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (NUMBER_WORDS.has(raw)) return Number(NUMBER_WORDS.get(raw));
  return null;
}

function pushUniqueBySpan(list, claim, seen) {
  const key = `${claim.field}|${claim.start ?? ""}|${claim.end ?? ""}|${asString(claim.evidence).toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(claim);
}

function expandScopeEvidence(text, matchStart, matchEnd) {
  const prefix = text.slice(Math.max(0, matchStart - 40), matchStart);
  const marker = prefix.match(/\b((?:actually|instead|make\s+that|scratch\s+that|correction)\b[,:]?\s*)$/i);
  if (!marker) {
    return {
      evidence: text.slice(matchStart, matchEnd).trim(),
      start: matchStart,
      end: matchEnd,
    };
  }
  const start = matchStart - marker[1].length;
  return {
    evidence: text.slice(start, matchEnd).trim(),
    start,
    end: matchEnd,
  };
}

function spansOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function preferScopeClaim(existing, candidate) {
  const existingLen = (existing.end ?? 0) - (existing.start ?? 0);
  const candidateLen = (candidate.end ?? 0) - (candidate.start ?? 0);
  const existingRestriction = /\b(?:only|just|actually|instead|make\s+that|scratch\s+that|correction)\b/i.test(existing.evidence);
  const candidateRestriction = /\b(?:only|just|actually|instead|make\s+that|scratch\s+that|correction)\b/i.test(candidate.evidence);
  if (candidateRestriction && !existingRestriction) return candidate;
  if (existingRestriction && !candidateRestriction) return existing;
  return candidateLen >= existingLen ? candidate : existing;
}

function addScopeClaim(scopeClaims, claim) {
  const overlappingIndex = scopeClaims.findIndex((existing) =>
    spansOverlap(existing.start ?? 0, existing.end ?? 0, claim.start ?? 0, claim.end ?? 0),
  );
  if (overlappingIndex < 0) {
    scopeClaims.push(claim);
    return;
  }
  scopeClaims[overlappingIndex] = preferScopeClaim(scopeClaims[overlappingIndex], claim);
}

function extractScopeClaims(text, claims, seen) {
  const scopeClaims = [];

  const countedPattern = new RegExp(
    `\\b(?:remove|take\\s+down|cut\\s+down|cut|grind)\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:(?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})s?\\b(?:\\s+(?:by|near|beside|behind|at)\\s+the\\s+[a-z]+)?`,
    "gi",
  );
  const restrictedPattern = new RegExp(
    `\\b(?:only|just)\\s+(?:remove|take\\s+down|cut)\\s+(?:the\\s+)?((?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})\\b`,
    "gi",
  );
  const singularPattern = new RegExp(
    `\\b(?:remove|take\\s+down|cut\\s+down|cut)\\s+(?:the\\s+)?((?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})\\b`,
    "gi",
  );
  // "Make that one pine" / "Scratch that, the rear oak" without an explicit remove verb
  const revisionCountPattern = new RegExp(
    `\\b(?:make\\s+that|scratch\\s+that|correction)\\b[,:]?\\s+(?:remove\\s+)?(?:the\\s+)?(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:(?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})s?\\b`,
    "gi",
  );

  const pushRemoveMatch = (match, countHint = null) => {
    const expanded = expandScopeEvidence(text, match.index, match.index + match[0].length);
    const evidence = expanded.evidence;
    if (!evidence) return;

    const count = countHint != null ? countHint : countTokenToNumber(match[1]);
    const speciesRaw = asString(match[2] || match[1]).toLowerCase().replace(/s$/, "");
    const resolvedSpecies = TREE_SPECIES.split("|").includes(speciesRaw)
      ? speciesRaw
      : asString(match[2]).toLowerCase().replace(/s$/, "");

    const modifiers = [...(evidence.match(new RegExp(`\\b(?:${LOCATION_MODIFIERS})\\b`, "ig")) || [])]
      .map((m) => m.toLowerCase())
      .filter((m) => !["by", "near", "beside", "behind", "at"].includes(m));
    const uniqueMods = [...new Set(modifiers.filter(Boolean))];
    const entityCount = Number.isFinite(count) && count > 0 ? count : 1;
    const entities = [];
    for (let i = 0; i < entityCount; i += 1) {
      const base = [...uniqueMods, resolvedSpecies || "tree"].filter(Boolean).join("_") || "tree";
      entities.push(entityCount > 1 ? `${base}_${i + 1}` : base);
    }

    addScopeClaim(scopeClaims, createClaim({
      id: "scope-temp",
      field: "job.target_trees",
      value: entities,
      evidence,
      start: expanded.start,
      end: expanded.end,
      source: "raw_notes",
    }));
  };

  for (const match of text.matchAll(countedPattern)) {
    pushRemoveMatch(match, countTokenToNumber(match[1]));
  }
  for (const match of text.matchAll(restrictedPattern)) {
    pushRemoveMatch(match, 1);
  }
  for (const match of text.matchAll(singularPattern)) {
    pushRemoveMatch(match, 1);
  }
  for (const match of text.matchAll(revisionCountPattern)) {
    pushRemoveMatch(match, countTokenToNumber(match[1]) || 1);
  }

  const bothPattern = new RegExp(
    `\\bboth\\s+(?:(?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})s?\\b`,
    "gi",
  );
  for (const match of text.matchAll(bothPattern)) {
    const expanded = expandScopeEvidence(text, match.index, match.index + match[0].length);
    // Prefer full sentence evidence when opinion filler precedes
    const sentenceStart = text.lastIndexOf(".", match.index);
    const start = Math.max(sentenceStart + 1, Math.max(0, match.index - 40));
    const evidence = text.slice(start, match.index + match[0].length).trim();
    const species = asString(match[1]).toLowerCase().replace(/s$/, "") || "tree";
    addScopeClaim(scopeClaims, createClaim({
      id: "scope-temp",
      field: "job.target_trees",
      value: [`${species}_1`, `${species}_2`],
      evidence: evidence || expanded.evidence,
      start: evidence ? start + (text.slice(start).length - text.slice(start).trimStart().length) : expanded.start,
      end: match.index + match[0].length,
      source: "raw_notes",
    }));
  }

  const leavePattern = new RegExp(
    `\\b(?:leave|don't\\s+remove|do\\s+not\\s+remove|keep)\\s+(?:the\\s+)?((?:${LOCATION_MODIFIERS})\\s+)?(${TREE_SPECIES})s?\\b`,
    "gi",
  );
  for (const match of text.matchAll(leavePattern)) {
    const evidence = asString(match[0]).trim();
    if (!evidence) continue;
    const species = asString(match[2] || match[1]).toLowerCase().replace(/s$/, "");
    const mods = [...(evidence.match(new RegExp(`\\b(?:${LOCATION_MODIFIERS})\\b`, "ig")) || [])]
      .map((m) => m.toLowerCase());
    const label = [...new Set([...mods, species].filter(Boolean))].join("_") || "tree";
    addScopeClaim(scopeClaims, createClaim({
      id: "scope-temp",
      field: "job.target_trees",
      value: { action: "leave", entities: [label] },
      evidence,
      start: match.index,
      end: match.index + match[0].length,
      source: "raw_notes",
    }));
  }

  scopeClaims.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  scopeClaims.forEach((claim, index) => {
    claim.id = `scope-${index + 1}`;
    pushUniqueBySpan(claims, claim, seen);
  });
}

function extractPriceClaims(text, claims, seen) {
  let priceIndex = 0;
  PRICE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const amountRaw = asString(match[1]).replace(/,/g, "");
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) continue;
    const start = match.index;
    const windowEnd = Math.min(text.length, start + match[0].length + 80);
    const window = text.slice(start, windowEnd);
    const without = /\bwithout\b/i.test(window);
    const withAddon = /\bwith\b/i.test(window) && !without;
    const stump = /\bstump\b/i.test(window);
    let qualifier = "";
    if (without && stump) qualifier = "without_stump_grinding";
    else if (withAddon && stump) qualifier = "with_stump_grinding";
    else if (without) qualifier = "without_addon";
    else if (withAddon) qualifier = "with_addon";

    const evidenceEnd = (() => {
      const clause = window.match(/^\$\s*[\d,]+(?:\.\d{2})?(?:\s+(?:without|with)\s+[^. ord][^.]{0,60})?/i);
      return start + (clause ? clause[0].length : match[0].length);
    })();
    const evidence = text.slice(start, evidenceEnd).trim();

    pushUniqueBySpan(claims, createClaim({
      id: `price-${++priceIndex}`,
      field: "job.price",
      value: {
        amount,
        display: `$${amountRaw}`,
        qualifier: qualifier || null,
      },
      evidence,
      start,
      end: evidenceEnd,
      source: "raw_notes",
    }), seen);
  }

  const priceClaims = claims.filter((claim) => claim.field === "job.price");
  priceClaims.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  priceClaims.forEach((claim, index) => {
    claim.id = `price-${index + 1}`;
  });
}

function extractPhoneClaims(text, claims, seen) {
  let phoneIndex = 0;
  PHONE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const evidence = asString(match[0]).trim();
    const normalized = normalizePhoneCandidate(evidence);
    if (!normalized) continue;
    pushUniqueBySpan(claims, createClaim({
      id: `phone-${++phoneIndex}`,
      field: "customer.phone",
      value: {
        digits: normalized.value,
        display: normalized.display,
        raw: evidence,
      },
      evidence,
      start: match.index,
      end: match.index + match[0].length,
      source: "raw_notes",
    }), seen);
  }

  const phoneClaims = claims.filter((claim) => claim.field === "customer.phone");
  phoneClaims.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  phoneClaims.forEach((claim, index) => {
    claim.id = `phone-${index + 1}`;
  });
}

function normalizeAddressKey(value) {
  return asString(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractAddressClaims(text, claims, seen) {
  let addressIndex = 0;
  ADDRESS_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(ADDRESS_PATTERN)) {
    const evidence = asString(match[0]).trim();
    if (!evidence) continue;
    pushUniqueBySpan(claims, createClaim({
      id: `address-${++addressIndex}`,
      field: "customer.address",
      value: {
        raw: evidence,
        normalized: normalizeAddressKey(evidence),
      },
      evidence,
      start: match.index,
      end: match.index + match[0].length,
      source: "raw_notes",
    }), seen);
  }

  const addressClaims = claims.filter((claim) => claim.field === "customer.address");
  addressClaims.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  addressClaims.forEach((claim, index) => {
    claim.id = `address-${index + 1}`;
  });
}

/**
 * Extract ordered claims for scope, price, phone, and address from raw notes.
 *
 * @param {string} rawInput
 * @returns {import("./claimGraph.js").Claim[]}
 */
export function extractClaimsFromRaw(rawInput = "") {
  const text = asString(rawInput);
  if (!text.trim()) return [];

  const claims = [];
  const seen = new Set();
  extractScopeClaims(text, claims, seen);
  extractPriceClaims(text, claims, seen);
  extractPhoneClaims(text, claims, seen);
  extractAddressClaims(text, claims, seen);

  return claims.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}
