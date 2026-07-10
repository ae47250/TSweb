import { createHash } from "node:crypto";

export const CANONICAL_SERVICE_ASSEMBLER_VERSION = "canonical-service-assembler-v0.1-shadow";
export const ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG = "ENABLE_CANONICAL_SERVICE_ASSEMBLER";

export const SERVICE_KINDS = Object.freeze([
  "tree_removal",
  "tree_trim",
  "limb_removal",
  "stump_grinding",
  "haul_away",
  "brush_cleanup",
  "storm_cleanup",
  "other_supported_service",
  "unresolved_service",
]);

export const RELATIONSHIP_TYPES = Object.freeze([
  "primary_service",
  "required_component",
  "optional_add_on",
  "total",
  "component_of",
  "restates",
  "alternative_to",
  "alternative_customer_choice",
  "unresolved_relationship",
]);

export const CANONICAL_SEMANTIC_ERROR_CODES = Object.freeze([
  "SERVICE_KIND_EVIDENCE_MISMATCH",
  "AMOUNT_SERVICE_PAIRING_MISMATCH",
  "TITLE_DESCRIPTION_ACTION_CONFLICT",
  "DUPLICATE_SEMANTIC_ITEM",
  "UNSUPPORTED_SERVICE_SCOPE",
  "FABRICATED_SCOPE_FACT",
  "UNRESOLVED_RELATIONSHIP",
  "UNSUPPORTED_FINAL_PRICE",
  "UNPRICED_RENDERED_ITEM",
  "VALIDATED_RENDER_MISMATCH",
]);

export const CANONICAL_ASSEMBLER_INPUT_CONTRACT = Object.freeze({
  version: "canonical-service-assembler-input-v1",
  allowed_top_level_fields: [
    "normalizedJobFacts",
    "typedPriceEvidence",
    "extractedRelationships",
  ],
  forbidden_field_names: [
    "expected",
    "expected_pairs",
    "expected_amounts",
    "expected_service_kinds",
    "expected_kind",
    "expected_kinds",
    "benchmark",
    "benchmark_classification",
    "classification",
    "correct",
    "incorrect",
    "pass",
    "fail",
    "ready_and_correct",
    "ready_but_wrong",
    "correct_but_blocked",
    "current_vs_expected",
    "reviewer_conclusion",
  ],
  normalizedJobFacts: [
    "description",
    "work_action",
    "tree_count",
    "tree_count_status",
    "tree_species",
    "work_location",
    "inclusions",
    "exclusions",
    "source_evidence",
  ],
  typedPriceEvidence: [
    "price_id",
    "amount",
    "display",
    "local_text",
    "service_kind",
    "amount_confidence",
    "pairing_confidence",
    "candidate_status",
    "reason_code",
    "source",
    "source_span",
  ],
  extractedRelationships: [
    "monetary_relationships",
    "add_on_interpretations",
    "duplicate_price_collapses",
    "restatements",
    "alternatives",
  ],
});

const ADD_ON_KINDS = new Set(["stump_grinding", "haul_away", "brush_cleanup", "storm_cleanup"]);
const FINAL_SERVICE_KINDS = new Set(SERVICE_KINDS.filter((kind) => kind !== "unresolved_service"));
const FORBIDDEN_FIELD_NAMES = new Set(CANONICAL_ASSEMBLER_INPUT_CONTRACT.forbidden_field_names);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const text = compact(value);
  if (!text) return "";
  const fixed = `${text.charAt(0).toUpperCase()}${text.slice(1)}`.replace(/\s+([.,;:!?])/g, "$1");
  return /[.!?]$/.test(fixed) ? fixed : `${fixed}.`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function money(amount) {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? `$${Math.round(numeric).toLocaleString("en-US")}` : "";
}

function amountFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = asString(value).replace(/,/g, "").trim();
  const direct = text.match(/^\$?(\d+(?:\.\d+)?)$/);
  if (direct) return Math.round(Number(direct[1]));
  const moneyLike = text.match(/\$?\b(\d{2,6})(?:\.\d+)?\b/);
  return moneyLike ? Math.round(Number(moneyLike[1])) : null;
}

function optionAmount(option = {}) {
  return amountFromValue(option.price?.amount ?? option.price?.min_amount ?? option.price?.display ?? option.amount);
}

export function canonicalServiceAssemblerEnabled(env = process.env) {
  return env?.[ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG] === "true";
}

export function normalizeCanonicalText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/\brmv\b/g, "remove")
    .replace(/\bpls\b|\bthx\b|\bthanks\b/g, " ")
    .replace(/\$?\s*\d[\d,]*(?:\.\d+)?\b/g, " ")
    .replace(/\b(?:prices?|priced|quote|quoted|estimate|est|bid|cost|option|opt)\b/g, " ")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanServiceWords(value) {
  return normalizeCanonicalText(value)
    .replace(/\b(?:tree\s+trim|tree\s+trimming|tree\s+removal|stump\s+grinding|haul\s+away|brush\s+cleanup|storm\s+cleanup|limb\s+removal)\b/g, " ")
    .replace(/\b(?:trim|trimming|removal|remove|stump|grinding|haul|away|tree|trees|price|quote)\b$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasContactOrAddressLeak(value) {
  const text = asString(value);
  return /\b(?:phone|cell|email|e-?mail|addr|address|not addr|not phone|customer|hotmail|yahoo|icloud|gmail|aol|comcast|att)\b|@|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d+\s+(?:[A-Za-z]+\s+){0,4}(?:st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|way|blvd|boulevard)\b/i.test(text);
}

export function inferServiceKindFromText(value) {
  const text = normalizeCanonicalText(value);
  if (!text) return "";
  if (/\bstorm\b|\bwind\b|\bdowned\b/.test(text)) {
    if (/\bcleanup|clean up|debris|limbs?|branches?\b/.test(text)) return "storm_cleanup";
  }
  if (/\bstumps?\b|\bgrind(?:ing)?\b/.test(text)) return "stump_grinding";
  if (/\bbrush\b|\bsaplings?\b/.test(text)) {
    if (/\bcleanup|clean up|clear|remove|pile|debris\b/.test(text)) return "brush_cleanup";
  }
  if (/\blimbs?\b|\bbranches?\b/.test(text)) {
    if (/\bremove|removal|cut|cut up|clear|cleanup|clean up|take\b/.test(text)) return "limb_removal";
    if (/\btrim|prune|pruning|crown\b/.test(text)) return "tree_trim";
  }
  if (/\btrim(?:ming)?\b|\bprun(?:e|ing)\b|\bcrown\b/.test(text)) return "tree_trim";
  if (/\bhaul(?: away| off)?\b|\bhaul\b|\bleave wood\b|\bwood handling\b/.test(text)) return "haul_away";
  if (/\bremove|removal|take down|cut down|drop|rmv\b/.test(text)) return "tree_removal";
  if (/\bcleanup|clean up\b/.test(text)) return "other_supported_service";
  return "";
}

function titleForKind(kind) {
  return {
    tree_removal: "Tree Removal",
    tree_trim: "Tree Trimming",
    limb_removal: "Limb Removal",
    stump_grinding: "Stump Grinding",
    haul_away: "Haul Away",
    brush_cleanup: "Brush Cleanup",
    storm_cleanup: "Storm Cleanup",
    other_supported_service: "Tree Service",
    unresolved_service: "Service Scope Needs Review",
  }[kind] || "Service Scope Needs Review";
}

function actionPatternForKind(kind) {
  return {
    tree_removal: /\b(remove|take down|cut down|drop)\b/i,
    tree_trim: /\b(trim|prune|pruning)\b/i,
    limb_removal: /\b(remove|cut up|cut|clear)\b.*\b(limb|branch)|\b(limb|branch)\b/i,
    stump_grinding: /\bgrind\b.*\bstump|\bstump\b/i,
    haul_away: /\bha(ul|uling)\b.*\b(away|off|debris|wood)|\bhaul away\b/i,
    brush_cleanup: /\b(clean up|cleanup|clear)\b.*\b(brush|debris)|\bbrush\b/i,
    storm_cleanup: /\b(clean up|cleanup|remove|cut up)\b.*\b(storm|damaged|downed|debris|limb)/i,
    other_supported_service: /\b(service|work|cleanup|clean up|remove|trim|haul|cut)\b/i,
  }[kind] || null;
}

function numberWord(value) {
  const words = {
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  };
  const number = Number(value);
  return words[number] || asString(value);
}

function extractCountPhrase(value) {
  const text = normalizeCanonicalText(value);
  const count = "(one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)";
  const descriptor = "(?:small|large|big|dead|fallen|ornamental)\\s+";
  const species = "(?:ash|cedar|cherry|locust|maple|oak|ornamental\\s+pear|pear|pine|spruce|walnut)\\s+";
  const treePhrase = text.match(new RegExp(`\\b${count}\\s+(?:${descriptor})?(?:${species})?trees?\\b`, "i"));
  if (treePhrase) return compact(treePhrase[0].replace(/^\d+/, (digit) => numberWord(digit)));
  const speciesPlural = text.match(new RegExp(`\\b${count}\\s+(?:${descriptor})?(?:ashes|cedars|cherries|locusts|maples|oaks|ornamental\\s+pears|pears|pines|spruces|walnuts)\\b`, "i"));
  if (speciesPlural) return compact(speciesPlural[0].replace(/^\d+/, (digit) => numberWord(digit)));
  return "";
}

function extractSpecies(value, fallback = "") {
  const text = normalizeCanonicalText(`${value} ${fallback}`);
  const species = [
    "ornamental pear",
    "ash",
    "cedar",
    "cherry",
    "locust",
    "maple",
    "oak",
    "pear",
    "pine",
    "spruce",
    "walnut",
  ];
  for (const item of species) {
    const singular = item.replace(" ", "\\s+");
    const plural = `${item}s`.replace(" ", "\\s+");
    if (new RegExp(`\\b${singular}\\b`).test(text)) return item;
    if (new RegExp(`\\b${plural}\\b`).test(text)) return item;
  }
  return "";
}

function extractLocation(value) {
  const text = compact(value);
  const match = text.match(/\b(?:along|near|by|beside|behind|in front of|toward|over|next to|touching)\s+(?:the\s+)?[a-z][a-z\s-]{2,40}\b/i);
  if (!match) return "";
  return cleanServiceWords(match[0]).replace(/\.$/, "");
}

function sourceSupportsFact(sourceText, fact) {
  if (!fact) return true;
  return normalizeCanonicalText(sourceText).includes(normalizeCanonicalText(fact));
}

function supportedFact(value, evidenceId, kind = "source_span") {
  return {
    value: compact(value),
    evidence_id: evidenceId,
    support: kind,
  };
}

function optionText(option = {}) {
  return compact([option.title, option.description].filter(Boolean).join(" "));
}

function acceptedPrice(record) {
  if (!record.amount) return false;
  if (record.source === "existing_final_option") return true;
  if (/^accepted/.test(record.reason_code || "")) return true;
  if (record.candidate_status === "accepted") return true;
  return record.amount_confidence === "high" && record.pairing_confidence === "high";
}

function priceEvidenceScore(record) {
  let score = 0;
  if (record.amount_confidence === "high") score += 4;
  if (record.pairing_confidence === "high") score += 5;
  if (/^accepted/.test(record.reason_code || "") || record.candidate_status === "accepted") score += 6;
  if (record.service_kind) score += 8;
  if (hasContactOrAddressLeak(record.local_text)) score -= 20;
  if (!record.service_kind) score -= 6;
  return score;
}

export function findForbiddenBuilderInputPaths(value, pathParts = []) {
  if (!value || typeof value !== "object") return [];
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...findForbiddenBuilderInputPaths(item, [...pathParts, String(index)])));
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) hits.push([...pathParts, key].join("."));
    hits.push(...findForbiddenBuilderInputPaths(child, [...pathParts, key]));
  }
  return hits;
}

export function assertCanonicalAssemblerInput(input) {
  const topLevel = Object.keys(input || {}).sort();
  const allowed = [...CANONICAL_ASSEMBLER_INPUT_CONTRACT.allowed_top_level_fields].sort();
  if (JSON.stringify(topLevel) !== JSON.stringify(allowed)) {
    throw new Error(`Canonical assembler input must contain exactly: ${allowed.join(", ")}`);
  }
  const forbidden = findForbiddenBuilderInputPaths(input);
  if (forbidden.length) {
    throw new Error(`Canonical assembler input contains forbidden benchmark fields: ${forbidden.join(", ")}`);
  }
  return true;
}

function normalizedJobFactsFromAlpha(alphaJson = {}) {
  const tree = alphaJson.job?.tree_details || {};
  const treeCountStatus = compact(tree.tree_count_status);
  const treeCount = treeCountStatus && treeCountStatus !== "missing" ? compact(tree.tree_count) : "";
  const description = compact(alphaJson.job?.description);
  const corrected = compact(alphaJson.normalization?.corrected_interpretation);
  return {
    description: sentence(description.split(/\bOptions include\b/i)[0] || description),
    work_action: compact(alphaJson.job?.work_action),
    tree_count: treeCount,
    tree_count_status: treeCountStatus,
    tree_species: compact(tree.tree_type),
    work_location: extractLocation(`${description} ${corrected}`),
    inclusions: [],
    exclusions: [],
    source_evidence: [
      {
        evidence_id: "job.description",
        text: description,
      },
      {
        evidence_id: "normalization.corrected_interpretation",
        text: corrected,
      },
    ].filter((item) => item.text),
  };
}

function typedPriceEvidenceFromAlpha(alphaJson = {}) {
  const rec = alphaJson.normalization?.sidecar_price_reconciliation || {};
  const sidecar = Array.isArray(rec.sidecar_prices) ? rec.sidecar_prices : [];
  const records = sidecar
    .map((price, index) => {
      const localText = compact(price.description || price.context || price.reason);
      const amount = amountFromValue(price.amount ?? price.display);
      return {
        price_id: compact(price.price_id) || `sidecar_price_${index + 1}`,
        amount,
        display: compact(price.display) || money(amount),
        local_text: localText,
        service_kind: inferServiceKindFromText(localText),
        amount_confidence: compact(price.amount_confidence),
        pairing_confidence: compact(price.pairing_confidence),
        candidate_status: compact(price.candidate_status),
        reason_code: compact(price.reason_code),
        source: "sidecar_price_reconciliation",
        source_span: price.source_span || null,
      };
    })
    .filter((price) => price.amount);

  const existing = alphaJson.service_options?.items || [];
  for (const [index, option] of existing.entries()) {
    const amount = optionAmount(option);
    if (!amount) continue;
    if (records.some((record) => record.amount === amount && acceptedPrice(record))) continue;
    const localText = optionText(option);
    records.push({
      price_id: `existing_option_${index + 1}`,
      amount,
      display: compact(option.price?.display) || money(amount),
      local_text: localText,
      service_kind: inferServiceKindFromText(localText),
      amount_confidence: "displayed_currently",
      pairing_confidence: inferServiceKindFromText(localText) ? "medium" : "low",
      candidate_status: "displayed_currently",
      reason_code: "displayed_currently",
      source: "existing_final_option",
      source_span: null,
    });
  }

  return records.sort((left, right) => priceEvidenceScore(right) - priceEvidenceScore(left));
}

function relationshipEvidenceFromAlpha(alphaJson = {}) {
  const rec = alphaJson.normalization?.sidecar_price_reconciliation || {};
  return {
    monetary_relationships: clone(rec.monetary_relationships || []),
    add_on_interpretations: clone(rec.add_on_interpretations || []),
    duplicate_price_collapses: clone(rec.duplicate_price_collapses || []),
    restatements: clone(rec.restatements || []),
    alternatives: clone(rec.alternatives || []),
  };
}

export function buildCanonicalAssemblerInput(alphaJson = {}) {
  const input = {
    normalizedJobFacts: normalizedJobFactsFromAlpha(alphaJson),
    typedPriceEvidence: typedPriceEvidenceFromAlpha(alphaJson),
    extractedRelationships: relationshipEvidenceFromAlpha(alphaJson),
  };
  assertCanonicalAssemblerInput(input);
  return input;
}

function explicitTotalPriceIds(extractedRelationships = {}) {
  return new Set((extractedRelationships.monetary_relationships || [])
    .filter((relationship) => relationship.type === "total_of" && (relationship.component_price_ids || []).length >= 2)
    .map((relationship) => relationship.total_price_id)
    .filter(Boolean));
}

function scopeFactsForEvidence(record) {
  const localText = record.local_text || "";
  const count = extractCountPhrase(localText);
  const species = extractSpecies(localText);
  const location = extractLocation(localText);
  return {
    count: count ? supportedFact(count, `${record.price_id}.local_text`) : null,
    species: species ? supportedFact(species, `${record.price_id}.local_text`) : null,
    location: location ? supportedFact(location, `${record.price_id}.local_text`) : null,
  };
}

function relationshipForItem(record, kind, allRecords, extractedRelationships) {
  const relationships = extractedRelationships.monetary_relationships || [];
  if (relationships.some((relationship) => relationship.total_price_id === record.price_id)) return "total";
  if (relationships.some((relationship) => (relationship.component_price_ids || []).includes(record.price_id))) return "component_of";
  const sameKind = allRecords.filter((item) => item.service_kind === kind && item.amount !== record.amount);
  if (sameKind.length && /\b(option|alternative|either|or)\b/i.test(record.local_text)) return "alternative_to";
  if (ADD_ON_KINDS.has(kind)) return "optional_add_on";
  if (!kind || kind === "unresolved_service") return "unresolved_relationship";
  return "primary_service";
}

function itemIdFor(record, kind) {
  const token = `${record.price_id}_${record.amount}_${kind}`.replace(/[^a-z0-9_]+/gi, "_").replace(/_+/g, "_");
  return `csa_${token}`;
}

function itemScopeProjection(scope = {}) {
  return {
    count: scope.count?.value || "",
    species: scope.species?.value || "",
    location: scope.location?.value || "",
    inclusions: scope.inclusions || [],
    exclusions: scope.exclusions || [],
  };
}

export function buildCanonicalServiceItems(normalizedJobFacts, typedPriceEvidence, extractedRelationships) {
  const input = { normalizedJobFacts, typedPriceEvidence, extractedRelationships };
  assertCanonicalAssemblerInput(input);

  const totalIds = explicitTotalPriceIds(extractedRelationships);
  const usableEvidence = typedPriceEvidence.filter(acceptedPrice);
  const assignedPriceIds = new Set();
  const amountKindKeys = new Set();
  const items = [];
  const quarantined_price_evidence = [];

  for (const record of usableEvidence) {
    if (assignedPriceIds.has(record.price_id)) continue;
    const serviceKind = record.service_kind || inferServiceKindFromText(record.local_text) || "unresolved_service";
    const leaky = hasContactOrAddressLeak(record.local_text);

    if (totalIds.has(record.price_id)) {
      quarantined_price_evidence.push({
        price_id: record.price_id,
        amount: record.amount,
        display: record.display || money(record.amount),
        reason: "total_price_represented_by_components",
      });
      assignedPriceIds.add(record.price_id);
      continue;
    }
    if (leaky && serviceKind === "unresolved_service") {
      quarantined_price_evidence.push({
        price_id: record.price_id,
        amount: record.amount,
        display: record.display || money(record.amount),
        local_text: record.local_text,
        reason: "contact_or_address_like_price_evidence_not_customer_wording",
      });
      assignedPriceIds.add(record.price_id);
      continue;
    }

    const amountKindKey = `${record.amount}|${serviceKind}`;
    if (amountKindKeys.has(amountKindKey)) {
      quarantined_price_evidence.push({
        price_id: record.price_id,
        amount: record.amount,
        display: record.display || money(record.amount),
        service_kind: serviceKind,
        reason: "duplicate_amount_service_pair_without_restatement",
      });
      assignedPriceIds.add(record.price_id);
      continue;
    }

    const relationship = relationshipForItem(record, serviceKind, usableEvidence, extractedRelationships);
    const uncertainty = [];
    if (serviceKind === "unresolved_service") uncertainty.push("unsupported_service_scope");
    if (relationship === "unresolved_relationship") uncertainty.push("unresolved_relationship");
    if (record.pairing_confidence && !["high", "displayed_currently"].includes(record.pairing_confidence)) uncertainty.push("low_pairing_confidence");
    if (leaky) uncertainty.push("leaky_local_price_context");

    assignedPriceIds.add(record.price_id);
    amountKindKeys.add(amountKindKey);
    items.push({
      stable_id: itemIdFor(record, serviceKind),
      service_kind: serviceKind,
      amount: record.amount,
      display: record.display || money(record.amount),
      price_occurrence_id: record.price_id,
      relationship_type: relationship,
      supporting_price_occurrence_ids: [record.price_id],
      supporting_scope_evidence: [
        {
          evidence_id: `${record.price_id}.local_text`,
          text: record.local_text,
          kind: "local_price_adjacent_scope",
        },
      ],
      scope: {
        ...scopeFactsForEvidence(record),
        inclusions: [],
        exclusions: [],
      },
      uncertainty_status: uncertainty.length ? "uncertain" : "resolved",
      uncertainty_reasons: uncertainty,
      manual_edit_provenance: null,
      source: {
        price_id: record.price_id,
        local_text: record.local_text,
        service_kind: record.service_kind || "",
        amount_confidence: record.amount_confidence,
        pairing_confidence: record.pairing_confidence,
        candidate_status: record.candidate_status,
        reason_code: record.reason_code,
        source: record.source,
      },
    });
  }

  return {
    version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    items,
    quarantined_price_evidence,
    input_contract_hash: stableHash(CANONICAL_ASSEMBLER_INPUT_CONTRACT),
  };
}

function subjectForItem(item) {
  const scope = itemScopeProjection(item.scope);
  const parts = [];
  if (scope.count) parts.push(scope.count);
  if (scope.species && !normalizeCanonicalText(parts.join(" ")).includes(normalizeCanonicalText(scope.species))) {
    parts.push(scope.species);
  }
  let subject = compact(parts.join(" "));
  if (!subject) {
    if (item.service_kind === "limb_removal") subject = "limbs";
    else if (item.service_kind === "tree_trim") subject = scope.species ? `${scope.species} limbs` : "tree limbs";
    else if (item.service_kind === "tree_removal") subject = scope.species ? `${scope.species} tree` : "tree";
    else subject = "";
  }
  if (scope.location && !normalizeCanonicalText(subject).includes(normalizeCanonicalText(scope.location))) {
    subject = compact(`${subject} ${scope.location}`);
  }
  return subject;
}

function descriptionForItem(item) {
  const subject = subjectForItem(item);
  switch (item.service_kind) {
    case "tree_removal":
      return sentence(`Remove ${subject || "tree work as described in the job notes"}`);
    case "tree_trim":
      return sentence(`Trim ${subject || "tree limbs as described in the job notes"}`);
    case "limb_removal":
      return sentence(`Remove or cut up ${subject || "limbs as described in the job notes"}`);
    case "stump_grinding":
      return sentence("Grind the stump as described in the job notes");
    case "haul_away":
      return sentence("Haul away debris from the tree work");
    case "brush_cleanup":
      return sentence("Clean up brush and debris as described in the job notes");
    case "storm_cleanup":
      return sentence("Clean up storm-damaged limbs and debris as described in the job notes");
    case "other_supported_service":
      return sentence("Complete the supported tree service work described in the job notes");
    default:
      return sentence("Confirm the service scope before sending this option");
  }
}

export function renderCanonicalOptionWording(canonicalServiceItems) {
  return (canonicalServiceItems.items || []).map((item, index) => ({
    label: `Option ${String.fromCharCode(65 + index)}`,
    raw_label: "",
    sort_order: index + 1,
    title: titleForKind(item.service_kind),
    description: descriptionForItem(item),
    price: {
      price_type: "fixed",
      currency: "USD",
      amount: item.amount,
      min_amount: null,
      max_amount: null,
      display: item.display || money(item.amount),
      is_range: false,
      is_unclear: false,
      status: item.uncertainty_status === "resolved" ? "firm_candidate" : "needs_review",
      review_warning: item.uncertainty_status !== "resolved",
    },
    preserve_order: true,
    scope_unclear: item.uncertainty_status !== "resolved",
    source: "canonical_service_assembler_shadow",
    canonical_service_item: {
      stable_id: item.stable_id,
      service_kind: item.service_kind,
      relationship_type: item.relationship_type,
      supporting_price_occurrence_ids: item.supporting_price_occurrence_ids,
      supporting_scope_evidence: item.supporting_scope_evidence,
      scope: itemScopeProjection(item.scope),
      uncertainty_status: item.uncertainty_status,
      uncertainty_reasons: item.uncertainty_reasons,
      manual_edit_provenance: item.manual_edit_provenance,
      builder_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    },
  }));
}

function optionProjection(option = {}, index = 0) {
  const meta = option.canonical_service_item || option.canonical_option || {};
  return {
    stable_id: meta.stable_id || `option_${index + 1}`,
    label: compact(option.label) || `Option ${String.fromCharCode(65 + index)}`,
    service_kind: meta.service_kind || inferServiceKindFromText(optionText(option)) || "unresolved_service",
    title: compact(option.title),
    description: compact(option.description),
    amount: optionAmount(option),
    display: compact(option.price?.display) || money(optionAmount(option)),
    relationship_type: meta.relationship_type || "unresolved_relationship",
    supporting_price_occurrence_ids: meta.supporting_price_occurrence_ids || [],
    scope: meta.scope || {},
    uncertainty_status: meta.uncertainty_status || (option.scope_unclear ? "uncertain" : "resolved"),
  };
}

export function canonicalSemanticProjection(alphaJson = {}, optionsOverride = null) {
  const options = Array.isArray(optionsOverride)
    ? optionsOverride
    : Array.isArray(alphaJson.service_options?.items)
      ? alphaJson.service_options.items
      : [];
  return {
    canonical_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    items: options.map(optionProjection),
  };
}

export function canonicalSemanticHash(alphaJson = {}, optionsOverride = null) {
  return stableHash(canonicalSemanticProjection(alphaJson, optionsOverride));
}

function titleDescriptionConflict(option) {
  const titleKind = inferServiceKindFromText(option.title);
  const descriptionKind = inferServiceKindFromText(option.description);
  if (titleKind && descriptionKind && titleKind !== descriptionKind) return true;
  if (option.service_kind && option.service_kind !== "unresolved_service" && titleKind && titleKind !== option.service_kind) return true;
  const pattern = actionPatternForKind(option.service_kind);
  return Boolean(pattern && !pattern.test(option.description));
}

function duplicateSemanticErrors(options) {
  const errors = [];
  const bySemanticKey = new Map();
  const byKind = new Map();
  for (const option of options) {
    const semanticKey = [
      option.service_kind,
      normalizeCanonicalText(option.description),
      option.amount,
    ].join("|");
    bySemanticKey.set(semanticKey, [...(bySemanticKey.get(semanticKey) || []), option]);
    if (FINAL_SERVICE_KINDS.has(option.service_kind)) {
      byKind.set(option.service_kind, [...(byKind.get(option.service_kind) || []), option]);
    }
  }
  for (const group of bySemanticKey.values()) {
    if (group.length > 1) {
      errors.push({
        code: "DUPLICATE_SEMANTIC_ITEM",
        message: "Rendered options contain duplicate semantic items.",
        item_ids: group.map((item) => item.stable_id),
      });
    }
  }
  for (const [kind, group] of byKind.entries()) {
    if (group.length < 2) continue;
    const allowed = group.every((item) => ["alternative_to", "alternative_customer_choice", "restates", "component_of"].includes(item.relationship_type));
    if (!allowed) {
      errors.push({
        code: "DUPLICATE_SEMANTIC_ITEM",
        message: "Multiple amounts share a service kind without an explicit allowed relationship.",
        service_kind: kind,
        item_ids: group.map((item) => item.stable_id),
      });
    }
  }
  return errors;
}

function fabricatedScopeErrors(item, option) {
  const errors = [];
  const renderedText = `${option.title} ${option.description}`;
  for (const [field, fact] of Object.entries(item.scope || {})) {
    if (!fact || typeof fact !== "object" || !fact.value) continue;
    const sourceText = (item.supporting_scope_evidence || []).map((evidence) => evidence.text).join(" ");
    if (!sourceSupportsFact(sourceText, fact.value)) {
      errors.push({
        code: "FABRICATED_SCOPE_FACT",
        item_id: item.stable_id,
        field,
        value: fact.value,
        message: "Scope fact is not supported by item evidence.",
      });
    }
    if (!sourceSupportsFact(renderedText, fact.value)) {
      errors.push({
        code: "FABRICATED_SCOPE_FACT",
        item_id: item.stable_id,
        field,
        value: fact.value,
        message: "Rendered wording changed or omitted a supported scope fact.",
      });
    }
  }
  return errors;
}

export function validateCanonicalServiceEstimate({
  alphaJson = {},
  canonicalServiceItems = { items: [] },
  renderedOptions = null,
  expectedRendererHash = "",
} = {}) {
  const options = (renderedOptions || alphaJson.service_options?.items || []).map(optionProjection);
  const errors = [];

  (canonicalServiceItems.items || []).forEach((item, index) => {
    const option = options[index] || {};
    if (!item.amount || item.amount <= 0) {
      errors.push({ code: "UNSUPPORTED_FINAL_PRICE", item_id: item.stable_id, message: "Canonical item has no supported final amount." });
    }
    if (!option.amount) {
      errors.push({ code: "UNPRICED_RENDERED_ITEM", item_id: item.stable_id, message: "Rendered item has no final price." });
    }
    if (option.amount && item.amount && option.amount !== item.amount) {
      errors.push({ code: "AMOUNT_SERVICE_PAIRING_MISMATCH", item_id: item.stable_id, message: "Rendered amount differs from canonical amount." });
    }
    if (option.service_kind !== item.service_kind) {
      errors.push({ code: "AMOUNT_SERVICE_PAIRING_MISMATCH", item_id: item.stable_id, message: "Rendered service kind differs from canonical service kind." });
    }
    if (!FINAL_SERVICE_KINDS.has(item.service_kind) || item.service_kind === "unresolved_service") {
      errors.push({ code: "UNSUPPORTED_SERVICE_SCOPE", item_id: item.stable_id, message: "Canonical item has unresolved or unsupported service kind." });
    }
    if (item.source?.service_kind && item.source.service_kind !== item.service_kind) {
      errors.push({ code: "SERVICE_KIND_EVIDENCE_MISMATCH", item_id: item.stable_id, message: "Canonical service kind differs from local price evidence." });
    }
    if (titleDescriptionConflict(option)) {
      errors.push({ code: "TITLE_DESCRIPTION_ACTION_CONFLICT", item_id: item.stable_id, message: "Title and description action do not match service kind." });
    }
    if (item.relationship_type === "unresolved_relationship") {
      errors.push({ code: "UNRESOLVED_RELATIONSHIP", item_id: item.stable_id, message: "Canonical item relationship is unresolved." });
    }
    if (item.uncertainty_status !== "resolved") {
      errors.push({ code: "UNRESOLVED_RELATIONSHIP", item_id: item.stable_id, message: `Canonical item remains uncertain: ${item.uncertainty_reasons.join(", ")}` });
    }
    errors.push(...fabricatedScopeErrors(item, option));
  });

  errors.push(...duplicateSemanticErrors(options));

  const validatedHash = alphaJson.validation?.canonical_service_semantic_hash || "";
  const rendererHash = expectedRendererHash || canonicalSemanticHash(alphaJson, renderedOptions || alphaJson.service_options?.items || []);
  if (validatedHash && rendererHash && validatedHash !== rendererHash) {
    errors.push({ code: "VALIDATED_RENDER_MISMATCH", message: "Canonical validated hash does not match renderer input hash." });
  }

  const uniqueErrors = [...new Map(errors.map((error) => [JSON.stringify(error), error])).values()];
  return {
    can_generate_pdf: uniqueErrors.length === 0,
    structural_errors: uniqueErrors,
    structural_error_codes: [...new Set(uniqueErrors.map((error) => error.code))].sort(),
  };
}

export function buildCanonicalShadowEstimate(alphaJson = {}) {
  const input = buildCanonicalAssemblerInput(alphaJson);
  const canonicalServiceItems = buildCanonicalServiceItems(
    input.normalizedJobFacts,
    input.typedPriceEvidence,
    input.extractedRelationships,
  );
  const renderedOptions = renderCanonicalOptionWording(canonicalServiceItems);
  const proposedAlphaJson = clone(alphaJson);
  proposedAlphaJson.service_options = {
    ...(proposedAlphaJson.service_options || {}),
    items: renderedOptions,
  };
  const canonicalHash = canonicalSemanticHash(proposedAlphaJson, renderedOptions);
  proposedAlphaJson.normalization = {
    ...(proposedAlphaJson.normalization || {}),
    canonical_service_assembler_shadow: {
      enabled: false,
      feature_flag: ENABLE_CANONICAL_SERVICE_ASSEMBLER_FLAG,
      builder_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
      input_contract_hash: stableHash(CANONICAL_ASSEMBLER_INPUT_CONTRACT),
      canonical_service_items: canonicalServiceItems.items,
      quarantined_price_evidence: canonicalServiceItems.quarantined_price_evidence,
    },
  };
  proposedAlphaJson.validation = {
    ...(proposedAlphaJson.validation || {}),
    canonical_service_semantic_hash: canonicalHash,
    canonical_service_validator_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
  };
  const semanticValidation = validateCanonicalServiceEstimate({
    alphaJson: proposedAlphaJson,
    canonicalServiceItems,
    renderedOptions,
    expectedRendererHash: canonicalHash,
  });
  return {
    feature_flag_enabled: false,
    input,
    input_hash: stableHash(input),
    canonicalServiceItems,
    renderedOptions,
    alphaJson: proposedAlphaJson,
    canonical_semantic_hash: canonicalHash,
    semanticValidation,
  };
}

export function approvalBindingForCanonicalEstimate({
  alphaJson = {},
  approver = "",
  reason = "",
  timestamp = new Date().toISOString(),
} = {}) {
  const validatedHash = alphaJson.validation?.canonical_service_semantic_hash || "";
  const currentHash = canonicalSemanticHash(alphaJson);
  const approvalValidForCurrentSemantics = !validatedHash || validatedHash === currentHash;
  return {
    canonical_service_semantic_hash: validatedHash || currentHash,
    current_canonical_service_semantic_hash: currentHash,
    approval_valid_for_current_semantics: approvalValidForCurrentSemantics,
    validator_version: CANONICAL_SERVICE_ASSEMBLER_VERSION,
    error_codes: alphaJson.validation?.canonical_service_structural_error_codes || [],
    approver,
    reason,
    timestamp,
  };
}
