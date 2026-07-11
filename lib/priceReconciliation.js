import { TREE_SERVICE_PATTERN_SOURCES } from "./treeServiceLexicon.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function money(amount) {
  const numeric = Number(amount);
  return Number.isFinite(numeric) && numeric > 0 ? `$${Math.round(numeric).toLocaleString("en-US")}` : "";
}

function amountFromOption(option = {}) {
  const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1, unpaired: 0, "": 0 };
const SAFE_STANDALONE_SECOND_PRICE_SCOPE_PATTERN =
  /\b(?:stumps?|grind(?:ing)?|haul(?:ing|\s+away|\s+off)?|hawl|hual|brush\s+cleanup|cleanup|clean\s+up|tree\s+trim|trim(?:ming)?|prun(?:e|ing)|crown\s+reduction|remov(?:e|al)|take\s+down|cut\s+down|drop(?:\s+tree)?|tree\s+removal)\b/i;
const PER_UNIT_PRICE_PATTERN = /\bper\s+(?:stump|tree|limb|branch|brush|load|hour|hr|each|ea)\b/i;
const SAFETY_ACCESS_SCOPE_PATTERNS = [
  /\b(?:touching|against|on|near)\s+(?:the\s+)?(?:service|power|utility)\s+line\b/gi,
  /\bleaning\s+toward\s+(?:the\s+)?(?:garage|house|shed|building)\b/gi,
  /\bover\s+(?:the\s+)?roof\b/gi,
  /\bnear\s+(?:the\s+)?driveway\b/gi,
];
const TREE_SPECIES_SCOPE_RE = /\b(ash|beech|birch|cedar|cherry|elm|hickory|locust|maple|oak|pear|pine|poplar|sycamore|walnut|willow)\b/i;
export const PRICE_RELATIONSHIP_RESOLVER_VERSION = "price-relationship-resolver-v0.1";
export const PRICE_RELATIONSHIP_ROLES = Object.freeze({
  EXPLICIT_OPTION_TOTAL: "EXPLICIT_OPTION_TOTAL",
  INCREMENTAL_ADDON_PRICE: "INCREMENTAL_ADDON_PRICE",
  AMBIGUOUS_PRICE_ROLE: "AMBIGUOUS_PRICE_ROLE",
});
export const EXPLICIT_OPTION_TOTAL = PRICE_RELATIONSHIP_ROLES.EXPLICIT_OPTION_TOTAL;
export const INCREMENTAL_ADDON_PRICE = PRICE_RELATIONSHIP_ROLES.INCREMENTAL_ADDON_PRICE;
export const AMBIGUOUS_PRICE_ROLE = PRICE_RELATIONSHIP_ROLES.AMBIGUOUS_PRICE_ROLE;

const PRICE_RELATIONSHIP_ROLE_SET = new Set(Object.values(PRICE_RELATIONSHIP_ROLES));

export function isPriceRelationshipRole(value = "") {
  return PRICE_RELATIONSHIP_ROLE_SET.has(asString(value));
}

export function normalizePriceRelationshipRole(value = "") {
  const role = asString(value);
  return isPriceRelationshipRole(role) ? role : "";
}

function confidenceRank(value) {
  return CONFIDENCE_RANK[value || ""] || 0;
}

function cleanScope(value) {
  let text = asString(value)
    .replace(
      /\b\d{1,5}\s+(?:[A-Za-z0-9.]+\s+){0,5}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|way|pike|trail|trl|highway|hwy|route|terrace|parkway|bend)\b(?:\s+(?:in\s+)?[A-Za-z]+(?:\s+[A-Za-z]+){0,2})?/gi,
      " ",
    )
    .replace(/\b(?:prices?|priced|quote|quoted|estimate|est|bid|cost|total|option|opt)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,=-]+|[\s:;.,=-]+$/g, "")
    .trim();
  const workStart = text.search(new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`, "i"));
  if (workStart > 0) text = text.slice(workStart).trim();
  return text;
}

function stripSafetyAccessScope(value) {
  let text = cleanScope(value);
  for (const pattern of SAFETY_ACCESS_SCOPE_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  return text
    .replace(/\b(?:touching|against|near|over|toward|leaning)\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,=-]+|[\s:;.,=-]+$/g, "")
    .trim();
}

function customerFacingServiceScope(value) {
  return stripSafetyAccessScope(value)
    .replace(/\b(?:prices?|priced|quote|quoted|estimate|est|bid|cost|total|option|opt)\b/gi, " ")
    .replace(/\b\d[\d,]*\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,=-]+|[\s:;.,=-]+$/g, "")
    .trim();
}

function specificBaseScopeFromOption(option = {}) {
  const text = customerFacingServiceScope(optionScopeText(option));
  const species = text.match(TREE_SPECIES_SCOPE_RE)?.[1]?.toLowerCase() || "";
  if (/\b(?:remove|removal|take\s+down|cut\s+down|drop)\b/i.test(text)) {
    return species ? `remove ${species}` : "tree removal";
  }
  if (/\b(?:trim|prune|pruning)\b/i.test(text)) {
    if (/\bbranches?\b/i.test(text)) return "trim branches";
    if (/\blimbs?\b/i.test(text)) return "trim limbs";
    return "tree trim";
  }
  return text;
}

function optionWithCustomerFacingScope(option = {}, scope = "", action = "confirmed_customer_facing_scope") {
  const clean = compact(scope);
  if (!clean) return option;
  return {
    ...option,
    title: clean,
    description: clean,
    sidecar_price_reconciliation: {
      ...(option.sidecar_price_reconciliation || {}),
      action,
    },
  };
}

function sidecarPriceScope(price = {}) {
  return cleanScope(price.description_raw || price.context || "") || asString(price.description_raw || price.context);
}

function optionScopeText(option = {}) {
  return [option.title, option.description].filter(Boolean).join(" ");
}

function normalizedOptionScope(option = {}) {
  return cleanScope(optionScopeText(option))
    .toLowerCase()
    .replace(/\b(?:thx|thanks|pls|please|only|just)\b/g, " ")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serviceCategory(text) {
  const value = cleanScope(text).toLowerCase();
  if (/\bstumps?\b|\bgrind(?:ing)?\b/.test(value)) return "stump";
  if (/\bhaul(?:ing|\s+away|\s+off)?\b|\bcleanup\b|\bclean\s+up\b|\bdebris\b|\bbrush\b|\brake\b|\bchip(?:ping)?\b/.test(value)) return "haul_cleanup";
  if (/\btrim(?:ming)?\b|\bprun(?:e|ing)\b|\blimbs?\b|\bbranches?\b|\bcrown\b/.test(value)) return "trim";
  if (/\bremove\b|\bremoval\b|\brmv\b|\btake\s+down\b|\bcut\s+down\b|\bdrop\b/.test(value)) return "removal";
  return "";
}

function genericScope(scope) {
  if (!scope) return true;
  if (/^(?:tree service|service|tree work|work|job|scope unclear|work scope unclear|details missing|option)$/.test(scope)) return true;
  const words = scope.split(/\s+/).filter(Boolean);
  const genericWords = new Set(["tree", "service", "work", "job", "scope", "unclear", "details", "missing", "option"]);
  return words.length > 0 && words.every((word) => genericWords.has(word));
}

function optionScopeQuality(option = {}) {
  const scope = normalizedOptionScope(option);
  const text = optionScopeText(option);
  if (/\b(?:phone|cell|email|e-?mail|addr|address|not\s+addr|not\s+phone|customer|hotmail|yahoo|icloud|gmail|aol)\b|@/i.test(text)) {
    return serviceCategory(scope) ? "service" : "admin_or_contact";
  }
  if (genericScope(scope)) return "generic";
  return serviceCategory(scope) ? "service" : "weak";
}

function optionScopeScore(option = {}) {
  const scope = normalizedOptionScope(option);
  let score = scope.length;
  const quality = optionScopeQuality(option);
  if (quality === "service") score += 100;
  if (quality === "generic") score -= 100;
  if (quality === "admin_or_contact") score -= 125;
  if (option.price?.is_unclear || option.scope_unclear) score -= 25;
  return score;
}

function rawAmountMentionCount(raw, amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const plain = String(Math.round(numeric));
  const comma = Math.round(numeric).toLocaleString("en-US").replace(",", "\\,");
  const pattern = new RegExp(`(?:\\$\\s*)?(?:${plain}|${comma})\\b`, "g");
  return [...String(raw || "").matchAll(pattern)].length;
}

function sidecarPriceAmountCount(prices = [], amount) {
  return prices.filter((price) => Number(price.price_value) === Number(amount)).length;
}

function shouldCollapseSameAmountOptions(group, rawText, prices) {
  if (group.length < 2) return false;
  const amount = amountFromOption(group[0]);
  const scopes = group.map(normalizedOptionScope);
  const duplicateScopes = new Set(scopes).size < scopes.length;
  const qualities = group.map(optionScopeQuality);
  const hasWeakOption = qualities.some((quality) => quality !== "service");
  const hasServiceOption = qualities.some((quality) => quality === "service");
  const hasRepeatedEvidence = rawAmountMentionCount(rawText, amount) > 1 || sidecarPriceAmountCount(prices, amount) > 1;

  if (duplicateScopes) return true;
  if (hasWeakOption && (hasServiceOption || hasRepeatedEvidence)) return true;
  return false;
}

function collapseRepeatedSamePriceOptions(options, rawText, prices) {
  const groups = new Map();
  const withoutAmount = [];
  for (const option of options) {
    const amount = amountFromOption(option);
    if (!amount) {
      withoutAmount.push(option);
      continue;
    }
    groups.set(amount, [...(groups.get(amount) || []), option]);
  }

  const items = [];
  const collapses = [];
  for (const [amount, group] of groups.entries()) {
    if (!shouldCollapseSameAmountOptions(group, rawText, prices)) {
      items.push(...group);
      continue;
    }
    const ranked = [...group].sort((left, right) => optionScopeScore(right) - optionScopeScore(left));
    const kept = ranked[0];
    items.push(kept);
    collapses.push({
      amount,
      display: money(amount),
      kept: {
        label: kept.label || "",
        description: kept.description || kept.title || "",
      },
      removed: ranked.slice(1).map((option) => ({
        label: option.label || "",
        description: option.description || option.title || "",
      })),
    });
  }

  return { items: [...items, ...withoutAmount], collapses };
}

function safeStandaloneSecondPriceReview(option, interpretation, sidecarPrice) {
  const amount = amountFromOption(option);
  const addOnAmount = Number(interpretation?.add_on_price_value);
  if (!amount || amount !== addOnAmount) return false;
  if (interpretation?.add_on_price_id !== "price_2") return false;
  if (sidecarPrice?.amount_confidence !== "high" || sidecarPrice?.pairing_confidence !== "high") return false;

  const scopeEvidence = [
    interpretation?.add_on_description,
    sidecarPriceScope(sidecarPrice),
    option?.description,
    option?.title,
  ].filter(Boolean).join(" ");
  const ambiguityEvidence = [
    interpretation?.context,
    interpretation?.review_reason,
    option?.description,
    option?.title,
  ].filter(Boolean).join(" ");

  return SAFE_STANDALONE_SECOND_PRICE_SCOPE_PATTERN.test(scopeEvidence) && !PER_UNIT_PRICE_PATTERN.test(ambiguityEvidence);
}

function optionForSidecarPrice(price, index) {
  const scope = cleanScope(price.description_raw || price.context || "") || "work scope unclear";
  const display = price.price_display || money(price.price_value);
  return {
    label: `Option ${String.fromCharCode(65 + index)}`,
    raw_label: price.raw_label || "",
    sort_order: index + 1,
    title: scope,
    description: scope,
    price: {
      price_type: "fixed",
      currency: "USD",
      amount: price.price_value,
      min_amount: null,
      max_amount: null,
      display,
      is_range: false,
      is_unclear: false,
      status: price.price_status || "firm_candidate",
      review_warning: false,
    },
    preserve_order: true,
    scope_unclear: false,
    price_review_warning: false,
    source: "sidecar_price_reconciliation",
    sidecar_price_id: price.price_id,
    sidecar_price_reconciliation: {
      price_id: price.price_id,
      amount_confidence: price.amount_confidence,
      pairing_confidence: price.pairing_confidence,
      action: "auto_added_missing_high_confidence_price",
    },
  };
}

function optionForComputedAddOn(interpretation, index) {
  const scope = combinedAddOnScope(interpretation);
  const amount = Number(interpretation.combined_price_value);
  return {
    label: `Option ${String.fromCharCode(65 + index)}`,
    raw_label: "",
    sort_order: index + 1,
    title: scope,
    description: scope,
    price: {
      price_type: "fixed",
      currency: "USD",
      amount,
      min_amount: null,
      max_amount: null,
      display: interpretation.combined_price_display || money(amount),
      is_range: false,
      is_unclear: false,
      status: "firm_candidate",
      review_warning: false,
    },
    preserve_order: true,
    scope_unclear: false,
    price_review_warning: false,
    source: "sidecar_add_on_price_reconciliation",
    sidecar_price_id: interpretation.add_on_price_id,
    sidecar_price_reconciliation: {
      interpretation_id: interpretation.interpretation_id,
      base_price_id: interpretation.base_price_id,
      add_on_price_id: interpretation.add_on_price_id,
      amount_confidence: interpretation.amount_confidence,
      pairing_confidence: interpretation.pairing_confidence,
      addon_interpretation_confidence: interpretation.addon_interpretation_confidence,
      action: "auto_added_computed_add_on_bundle",
    },
  };
}

function baseOptionForInterpretation(options = [], interpretation = {}) {
  const baseAmount = Number(interpretation.base_price_value);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;
  return options.find((option) => amountFromOption(option) === Math.round(baseAmount)) || null;
}

function customerFacingBaseScope(interpretation = {}, options = []) {
  const optionScope = specificBaseScopeFromOption(baseOptionForInterpretation(options, interpretation) || {});
  const sidecarScope = customerFacingServiceScope(interpretation.base_description || "");
  return optionScope || sidecarScope || cleanScope(interpretation.base_description || "");
}

function withCustomerFacingBaseScope(interpretation = {}, options = []) {
  const baseScope = customerFacingBaseScope(interpretation, options);
  return baseScope ? { ...interpretation, base_description: baseScope } : interpretation;
}

function combinedAddOnScope(interpretation) {
  const baseScope = customerFacingServiceScope(interpretation.base_description || "") || "base tree work";
  const addOnScope = (customerFacingServiceScope(interpretation.add_on_description || "")
    .replace(/^(?:option\s*)?[a-e1-5]\s+(?:plus\s+)?/i, "")
    .replace(/^plus\s+/i, "")
    .trim()) || "add-on work";
  return addOnScope && !baseScope.toLowerCase().includes(addOnScope.toLowerCase())
    ? `${baseScope} and ${addOnScope}`
    : baseScope;
}

function markBundledTotalScope(option, interpretation) {
  const scope = combinedAddOnScope(interpretation);
  return {
    ...option,
    title: scope || option.title,
    description: scope || option.description,
    sidecar_price_id: interpretation.add_on_price_id,
    sidecar_price_reconciliation: {
      ...(option.sidecar_price_reconciliation || {}),
      interpretation_id: interpretation.interpretation_id,
      base_price_id: interpretation.base_price_id,
      add_on_price_id: interpretation.add_on_price_id,
      amount_confidence: interpretation.amount_confidence,
      pairing_confidence: interpretation.pairing_confidence,
      addon_interpretation_confidence: interpretation.addon_interpretation_confidence,
      action: "confirmed_bundled_total_scope",
    },
  };
}

function bestPairingsByPriceId(pairings = []) {
  const best = new Map();
  for (const pairing of pairings) {
    const key = pairing.price_id || "";
    if (!key) continue;
    const current = best.get(key);
    const confidence = pairing.pairing_confidence || pairing.confidence || "low";
    const currentConfidence = current?.pairing_confidence || current?.confidence || "";
    if (!current || confidenceRank(confidence) > confidenceRank(currentConfidence)) {
      best.set(key, pairing);
    }
  }
  return best;
}

function bestSidecarPriceByAmount(prices = []) {
  const best = new Map();
  for (const price of prices) {
    const amount = Number(price.price_value);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const current = best.get(amount);
    const score = confidenceRank(price.amount_confidence) + confidenceRank(price.pairing_confidence);
    const currentScore = current
      ? confidenceRank(current.amount_confidence) + confidenceRank(current.pairing_confidence)
      : -1;
    if (!current || score > currentScore) best.set(amount, price);
  }
  return best;
}

function sidecarAddOnInterpretations(optionPriceCandidateView = {}) {
  const clues = optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
  return asArray(clues.add_on_price_interpretations)
    .map((interpretation) => enrichAddOnInterpretationRole({
      ...interpretation,
      base_price_value: Number(interpretation.base_price_value),
      add_on_price_value: Number(interpretation.add_on_price_value),
      combined_price_value: Number(interpretation.combined_price_value),
    }))
    .filter((interpretation) =>
      Number.isFinite(interpretation.base_price_value) &&
      Number.isFinite(interpretation.add_on_price_value) &&
      Number.isFinite(interpretation.combined_price_value),
    );
}

function amountPattern(amount) {
  const rounded = Math.round(Number(amount));
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  const plain = String(rounded);
  const comma = rounded.toLocaleString("en-US").replace(",", "\\,");
  return `(?:\\$\\s*)?(?:${plain}|${comma})\\b`;
}

function explicitOptionTotalEvidence(interpretation = {}) {
  const baseAmount = Math.round(Number(interpretation.base_price_value));
  const addOnAmount = Math.round(Number(interpretation.add_on_price_value));
  const amountRe = amountPattern(addOnAmount);
  if (!amountRe || !Number.isFinite(baseAmount) || addOnAmount <= baseAmount) return false;
  const evidence = compact([
    interpretation.context,
    interpretation.add_on_description,
  ].filter(Boolean).join(" "));
  const optionLabelToAmount = new RegExp(`(?:\\b(?:option|opt)\\s*(?:b|2)\\b|(?:^|[\\s.;,/])b\\s+)[\\s\\S]{0,180}${amountRe}`, "i");
  const totalCueToAmount = new RegExp(`\\b(?:total|package|all\\s*in|all-in|complete\\s+(?:option|choice)|for|priced?|quote(?:d)?|cost)\\b[\\s\\S]{0,80}${amountRe}`, "i");
  return optionLabelToAmount.test(evidence) || (
    interpretation.interpretation === "bundled_total" &&
    totalCueToAmount.test(evidence)
  );
}

function incrementalAddOnEvidence(interpretation = {}) {
  if (interpretation.interpretation === "bundled_total") return false;
  const evidence = compact([
    interpretation.context,
    interpretation.add_on_description,
  ].filter(Boolean).join(" "));
  if (/\b(?:option|opt)\s*(?:b|2)\b|(?:^|[\s.;,/])b\s+/i.test(evidence)) return false;
  if (!serviceCategory(interpretation.add_on_description || evidence)) return false;
  if (PER_UNIT_PRICE_PATTERN.test(evidence)) return false;
  return Boolean(
    interpretation.simple_two_price_shape &&
    Number(interpretation.base_price_value) > 0 &&
    Number(interpretation.add_on_price_value) > 0,
  );
}

function enrichAddOnInterpretationRole(interpretation = {}) {
  const baseAmount = Math.round(Number(interpretation.base_price_value));
  const addOnAmount = Math.round(Number(interpretation.add_on_price_value));
  let priceRole = AMBIGUOUS_PRICE_ROLE;
  let priceRoleConfidence = "low";
  let priceRoleEvidence = "";
  let priceRoleAmbiguityReason = "Price role could not be safely classified as either an explicit option total or an incremental add-on amount.";

  if (explicitOptionTotalEvidence(interpretation)) {
    priceRole = EXPLICIT_OPTION_TOTAL;
    priceRoleConfidence = "high";
    priceRoleEvidence = "The later amount is attached to an explicit complete option or bundled total.";
    priceRoleAmbiguityReason = "";
  } else if (incrementalAddOnEvidence(interpretation)) {
    priceRole = INCREMENTAL_ADDON_PRICE;
    priceRoleConfidence = "high";
    priceRoleEvidence = "The later amount is attached to a dependent add-on scope with no complete Option B total.";
    priceRoleAmbiguityReason = "";
  } else if (interpretation.interpretation === "bundled_total" && addOnAmount > baseAmount) {
    priceRole = EXPLICIT_OPTION_TOTAL;
    priceRoleConfidence = "medium";
    priceRoleEvidence = "The later scoped amount is higher than the base and was classified as a bundled total.";
    priceRoleAmbiguityReason = "";
  }

  const combinedPriceValue = priceRole === INCREMENTAL_ADDON_PRICE
    ? baseAmount + addOnAmount
    : priceRole === EXPLICIT_OPTION_TOTAL
      ? addOnAmount
      : Number(interpretation.combined_price_value);
  const incrementalAmount = priceRole === EXPLICIT_OPTION_TOTAL
    ? addOnAmount - baseAmount
    : priceRole === INCREMENTAL_ADDON_PRICE
      ? addOnAmount
      : null;

  return {
    ...interpretation,
    combined_price_value: combinedPriceValue,
    combined_price_display: money(combinedPriceValue) || interpretation.combined_price_display,
    price_role: priceRole,
    price_role_confidence: priceRoleConfidence,
    price_role_evidence_text: priceRoleEvidence,
    price_role_ambiguity_reason: priceRoleAmbiguityReason,
    incremental_add_on_amount: Number.isFinite(incrementalAmount) && incrementalAmount > 0 ? incrementalAmount : null,
  };
}

function sidecarPrices(optionPriceCandidateView = {}) {
  const clues = optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
  const moneyLikeNumbers = asArray(clues.money_like_numbers);
  const pairings = asArray(clues.option_price_pairings);
  const pairingsById = bestPairingsByPriceId(pairings);
  return moneyLikeNumbers
    .map((candidate, index) => {
      const priceId = candidate.price_id || `price_${index + 1}`;
      const pairing = pairingsById.get(priceId) || null;
      const amount = Number(candidate.price_value);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        price_id: priceId,
        price_value: Math.round(amount),
        price_display: candidate.price_display || candidate.normalized_money_like || money(amount),
        raw: candidate.raw || "",
        span: candidate.span || null,
        context: candidate.context || "",
        amount_confidence: candidate.amount_confidence || candidate.confidence || "low",
        pairing_confidence: pairing?.pairing_confidence || pairing?.confidence || "low",
        description_raw: pairing?.description_raw || "",
        label: pairing?.label || "",
        raw_label: pairing?.raw_label || "",
        raw_label_token: pairing?.raw_label_token || "",
        price_status: pairing?.price_status || candidate.price_status || "firm_candidate",
        source: pairing?.source || "money_like_number",
      };
    })
    .filter(Boolean);
}

function quarantinedFinalPrice(option, amount, sidecarPrice, reason) {
  return {
    amount,
    display: money(amount),
    label: option.label || "",
    title: option.title || "",
    description: option.description || "",
    price_id: sidecarPrice?.price_id || "",
    amount_confidence: sidecarPrice?.amount_confidence || "",
    pairing_confidence: sidecarPrice?.pairing_confidence || "",
    context: sidecarPrice?.context || "",
    reason,
  };
}

function candidateDecision({
  priceId = "",
  amount = null,
  acceptedExactAmounts = new Set(),
  acceptedExactPriceIds = new Set(),
  acceptedBundlePriceIds = new Set(),
  acceptedTotalPriceIds = new Set(),
  acceptedComponentPriceIds = new Set(),
  quarantinedPriceIds = new Set(),
  addOnPriceIdsNeedingReview = new Set(),
  addOnPriceIdsToCompute = new Set(),
  highConfidenceBundledTotalsByAmount = new Map(),
  preferBundledStatus = false,
}) {
  const priceKey = priceId || "";
  if (acceptedTotalPriceIds.has(priceKey)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_total_component_relationship",
      reason: "This amount is typed as a total of final component prices, not a separate customer option.",
    };
  }
  if (acceptedComponentPriceIds.has(priceKey) && acceptedExactAmounts.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_component_of_total",
      reason: "Final TD2 keeps this amount as a component option in a verified total/component relationship.",
    };
  }
  if (quarantinedPriceIds.has(priceKey)) {
    return {
      candidate_status: "quarantined",
      reason_code: "quarantined_weak_sidecar_evidence",
        reason: "Sidecar price evidence was not strong enough for a final TD2 quote price.",
    };
  }
  if (
    preferBundledStatus &&
    (acceptedBundlePriceIds.has(priceKey) || addOnPriceIdsToCompute.has(priceKey) || highConfidenceBundledTotalsByAmount.has(amount))
  ) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this price as part of an accepted bundled option.",
    };
  }
  if (acceptedExactPriceIds.has(priceKey) || acceptedExactAmounts.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_exact_final_price",
      reason: "Final TD2 keeps this price as a quote amount.",
    };
  }
  if (acceptedBundlePriceIds.has(priceKey) || addOnPriceIdsToCompute.has(priceKey) || highConfidenceBundledTotalsByAmount.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this price as part of an accepted bundled option.",
    };
  }
  if (addOnPriceIdsNeedingReview.has(priceKey)) {
    return {
      candidate_status: "rejected",
      reason_code: "needs_review_addon_ambiguity",
      reason: "Add-on arithmetic or pairing is not strong enough for automatic final TD2 use.",
    };
  }
  return {
    candidate_status: "rejected",
    reason_code: "not_used_in_final_td2",
    reason: "Candidate price was not used in the final TD2 output.",
  };
}

function interpretationDecision({
  interpretation = "",
  needsReview = false,
  reviewReason = "",
  addOnPriceId = "",
  amount = null,
  priceRole = "",
  acceptedExactAmounts = new Set(),
  highConfidenceComputedAddOns = new Set(),
  highConfidenceBundledTotalsByAmount = new Map(),
  addOnPriceIdsAllowedAsStandalone = new Set(),
  acceptedComponentPriceIds = new Set(),
}) {
  if (acceptedComponentPriceIds.has(addOnPriceId) && acceptedExactAmounts.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_component_of_total",
      reason: "Final TD2 keeps this amount as a component option in a verified total/component relationship.",
    };
  }
  if (needsReview && addOnPriceIdsAllowedAsStandalone.has(addOnPriceId) && acceptedExactAmounts.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_exact_final_price_with_warning",
      reason: "Final TD2 keeps this high-confidence second price as a standalone quote amount; add-on ambiguity was downgraded to a warning.",
    };
  }
  if (priceRole === INCREMENTAL_ADDON_PRICE && highConfidenceComputedAddOns.has(addOnPriceId)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this incremental add-on price as part of an accepted bundled option.",
    };
  }
  if (priceRole === EXPLICIT_OPTION_TOTAL && highConfidenceBundledTotalsByAmount.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this explicit complete option total as the bundled option price.",
    };
  }
  if (needsReview) {
    return {
      candidate_status: "rejected",
      reason_code: "needs_review_addon_ambiguity",
      reason: reviewReason || "Add-on arithmetic or pairing is not strong enough for automatic final TD2 use.",
    };
  }
  if (interpretation === "additive_amount" && highConfidenceComputedAddOns.has(addOnPriceId)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this add-on as part of an accepted bundled option.",
    };
  }
  if (interpretation === "bundled_total" && highConfidenceBundledTotalsByAmount.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_into_bundled_option",
      reason: "Final TD2 uses this amount as the bundled option price.",
    };
  }
  if (acceptedExactAmounts.has(amount)) {
    return {
      candidate_status: "accepted",
      reason_code: "accepted_exact_final_price",
      reason: "Final TD2 keeps this price as a quote amount.",
    };
  }
  return {
    candidate_status: "rejected",
    reason_code: "not_used_in_final_td2",
    reason: "Candidate price was not used in the final TD2 output.",
  };
}

function markAddOnInterpretationForReview(option, interpretation) {
  return {
    ...option,
    price: {
      ...(option.price || {}),
      review_warning: true,
    },
    price_review_warning: true,
    review_flags: {
      ...(option.review_flags || {}),
      add_on_interpretation_unclear: true,
      price_warning: interpretation.review_reason || "Possible add-on price needs TD2 review before PDF.",
    },
  };
}

function markAddOnInterpretationAsWarning(option, interpretation) {
  return {
    ...option,
    price: {
      ...(option.price || {}),
      review_warning: true,
    },
    price_review_warning: true,
    review_flags: {
      ...(option.review_flags || {}),
      add_on_interpretation_downgraded_to_warning: true,
      price_warning: `High-confidence second price ${money(interpretation.add_on_price_value)} is tied to a clear work scope; review if needed before sending.`,
    },
  };
}

function sidecarMonetaryRelationships(optionPriceCandidateView = {}) {
  const clues = optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
  return asArray(clues.monetary_relationships)
    .filter((relationship) =>
      relationship?.type === "total_of" &&
      relationship.total_price_id &&
      Number.isFinite(Number(relationship.total_amount)) &&
      asArray(relationship.component_price_ids).length >= 2,
    )
    .map((relationship) => ({
      ...relationship,
      total_amount: Math.round(Number(relationship.total_amount)),
      component_amounts: asArray(relationship.component_amounts).map((amount) => Math.round(Number(amount))).filter((amount) => Number.isFinite(amount)),
    }));
}

function relationshipComponentsAreRepresented(relationship, amounts = new Set()) {
  return asArray(relationship.component_amounts).every((amount) => amounts.has(Math.round(Number(amount))));
}

function acceptedTotalRelationshipsForAmounts(relationships = [], amounts = new Set()) {
  return relationships.filter((relationship) =>
    relationship.confidence === "high" &&
    relationshipComponentsAreRepresented(relationship, amounts),
  );
}

export function reconcileSidecarPrices(alphaJson = {}, optionPriceCandidateView = null) {
  if (!optionPriceCandidateView) return alphaJson;

  const reconciled = structuredClone(alphaJson || {});
  const options = asArray(reconciled.service_options?.items);
  const prices = sidecarPrices(optionPriceCandidateView);
  const addOnInterpretations = sidecarAddOnInterpretations(optionPriceCandidateView);
  const monetaryRelationships = sidecarMonetaryRelationships(optionPriceCandidateView);
  if (!prices.length) return reconciled;

  const initialOptionAmounts = new Set(options.map(amountFromOption).filter(Boolean));
  const initiallyAcceptedTotalRelationships = acceptedTotalRelationshipsForAmounts(monetaryRelationships, initialOptionAmounts);
  const initiallyAcceptedComponentPriceIds = new Set(initiallyAcceptedTotalRelationships.flatMap((relationship) => relationship.component_price_ids || []));

  const highConfidenceComputedAddOns = addOnInterpretations
    .filter((interpretation) =>
      interpretation.price_role === INCREMENTAL_ADDON_PRICE &&
      interpretation.price_role_confidence === "high" &&
      interpretation.amount_confidence === "high" &&
      confidenceRank(interpretation.pairing_confidence) >= confidenceRank("medium"),
    )
    .map((interpretation) => withCustomerFacingBaseScope(interpretation, options));
  const highConfidenceBundledTotalsByAmount = new Map(addOnInterpretations
    .filter((interpretation) =>
      interpretation.price_role === EXPLICIT_OPTION_TOTAL &&
      confidenceRank(interpretation.price_role_confidence) >= confidenceRank("medium") &&
      interpretation.amount_confidence === "high" &&
      confidenceRank(interpretation.pairing_confidence) >= confidenceRank("medium"),
    )
    .map((interpretation) => withCustomerFacingBaseScope(interpretation, options))
    .map((interpretation) => [interpretation.add_on_price_value, interpretation]));
  const highConfidenceExplicitTotalBasePriceIds = new Set([...highConfidenceBundledTotalsByAmount.values()]
    .map((interpretation) => interpretation.base_price_id)
    .filter(Boolean));
  const highConfidenceExplicitTotalBaseAmounts = new Set([...highConfidenceBundledTotalsByAmount.values()]
    .map((interpretation) => interpretation.base_price_value)
    .filter((amount) => Number.isFinite(Number(amount)) && Number(amount) > 0));
  const addOnPriceIdsToCompute = new Set(highConfidenceComputedAddOns.map((interpretation) => interpretation.add_on_price_id).filter(Boolean));
  const addOnPriceIdsNeedingReview = new Set(addOnInterpretations
    .filter((interpretation) =>
      interpretation.price_role === AMBIGUOUS_PRICE_ROLE &&
      !initiallyAcceptedComponentPriceIds.has(interpretation.add_on_price_id),
    )
    .map((interpretation) => interpretation.add_on_price_id)
    .filter(Boolean));
  const addOnReviewByAmount = new Map(addOnInterpretations
    .filter((interpretation) =>
      interpretation.price_role === AMBIGUOUS_PRICE_ROLE &&
      !initiallyAcceptedComponentPriceIds.has(interpretation.add_on_price_id),
    )
    .map((interpretation) => [interpretation.add_on_price_value, interpretation]));
  const acceptedComputedAmounts = highConfidenceComputedAddOns.map((interpretation) => interpretation.combined_price_value);
  const addOnAmountsToReplace = new Set(highConfidenceComputedAddOns.map((interpretation) => interpretation.add_on_price_value));
  const sidecarAmounts = new Set([...prices.map((price) => price.price_value), ...acceptedComputedAmounts]);
  const sidecarByAmount = bestSidecarPriceByAmount(prices);
  const strongSidecarAmounts = new Set(prices
    .filter((price) =>
      price.amount_confidence === "high" &&
      price.pairing_confidence === "high" &&
      !addOnPriceIdsToCompute.has(price.price_id),
    )
    .map((price) => price.price_value));
  const acceptedSidecarAmounts = new Set([
    ...prices
      .filter((price) =>
        price.amount_confidence === "high" &&
        price.pairing_confidence === "high" &&
        !addOnPriceIdsToCompute.has(price.price_id) &&
        !addOnPriceIdsNeedingReview.has(price.price_id),
      )
      .map((price) => price.price_value),
    ...acceptedComputedAmounts,
    ...highConfidenceBundledTotalsByAmount.keys(),
    ...highConfidenceExplicitTotalBaseAmounts,
  ]);
  const hasStrongSidecarPrice = strongSidecarAmounts.size > 0 || acceptedComputedAmounts.length > 0;
  const addedOptions = [];
  const needsReview = [];
  const downgradedAddOnReviews = [];
  const inventedPrices = [];
  const quarantinedFinalPrices = [];
  const replacedStandaloneAddOnOptions = [];

  let updatedOptions = options.flatMap((option) => {
    const amount = amountFromOption(option);
    if (amount && addOnAmountsToReplace.has(amount)) {
      replacedStandaloneAddOnOptions.push({
        amount,
        display: money(amount),
        label: option.label || "",
        description: option.description || option.title || "",
      });
      return [];
    }
    const bundledTotal = highConfidenceBundledTotalsByAmount.get(amount);
    if (bundledTotal) return [markBundledTotalScope(option, bundledTotal)];
    const addOnReview = addOnReviewByAmount.get(amount);
    if (addOnReview) {
      const sidecarPrice = sidecarByAmount.get(amount);
      if (safeStandaloneSecondPriceReview(option, addOnReview, sidecarPrice)) {
        downgradedAddOnReviews.push({
          kind: "add_on_interpretation_downgraded",
          price_id: addOnReview.add_on_price_id,
          amount,
          display: money(amount),
          amount_confidence: sidecarPrice?.amount_confidence || addOnReview.amount_confidence,
          pairing_confidence: sidecarPrice?.pairing_confidence || addOnReview.pairing_confidence,
          description: sidecarPriceScope(sidecarPrice) || option.description || option.title || "",
          context: addOnReview.context,
          reason: "High-confidence second price is already present in TD2 and tied to a clear work scope.",
        });
        return [markAddOnInterpretationAsWarning(option, addOnReview)];
      }
      needsReview.push({
        kind: "add_on_interpretation",
        price_id: addOnReview.add_on_price_id,
        amount,
        display: money(amount),
        amount_confidence: addOnReview.amount_confidence,
        pairing_confidence: addOnReview.pairing_confidence,
        context: addOnReview.context,
        reason: addOnReview.review_reason || "Possible add-on price needs TD2 review before PDF.",
      });
      return [markAddOnInterpretationForReview(option, addOnReview)];
    }
    if (!amount) return [option];
    if (acceptedSidecarAmounts.has(amount)) return [option];
    if (sidecarAmounts.has(amount)) {
      if (!hasStrongSidecarPrice) return [option];
      const sidecarPrice = sidecarByAmount.get(amount);
      quarantinedFinalPrices.push(quarantinedFinalPrice(
        option,
        amount,
        sidecarPrice,
        "Sidecar price evidence was not strong enough for a final quote price.",
      ));
      return [];
    }
    inventedPrices.push({ amount, display: money(amount), label: option.label || "" });
    return [];
  });
  updatedOptions = updatedOptions.filter((option) => {
    const amount = amountFromOption(option);
    if (!amount || !addOnAmountsToReplace.has(amount)) return true;
    replacedStandaloneAddOnOptions.push({
      amount,
      display: money(amount),
      label: option.label || "",
      description: option.description || option.title || "",
    });
    return false;
  });
  const computedAddOnByBaseAmount = new Map(highConfidenceComputedAddOns
    .map((interpretation) => [Math.round(Number(interpretation.base_price_value)), interpretation]));
  updatedOptions = updatedOptions.map((option) => {
    const amount = amountFromOption(option);
    const interpretation = computedAddOnByBaseAmount.get(amount);
    if (!interpretation) return option;
    return optionWithCustomerFacingScope(
      option,
      customerFacingBaseScope(interpretation, [option]),
      "confirmed_base_scope_for_computed_add_on",
    );
  });

  const existingAmounts = new Set(updatedOptions.map(amountFromOption).filter(Boolean));

  for (const price of prices) {
    if (existingAmounts.has(price.price_value)) continue;
    if (addOnPriceIdsToCompute.has(price.price_id)) continue;
    if (acceptedTotalRelationshipsForAmounts(monetaryRelationships, existingAmounts).some((relationship) => relationship.total_price_id === price.price_id)) {
      continue;
    }
    if (addOnPriceIdsNeedingReview.has(price.price_id)) {
      if (price.amount_confidence === "high") {
        needsReview.push({
          price_id: price.price_id,
          amount: price.price_value,
          display: price.price_display || money(price.price_value),
          amount_confidence: price.amount_confidence,
          pairing_confidence: price.pairing_confidence,
          context: price.context,
          reason: "Possible add-on price is missing from TD2, but add-on arithmetic was not high confidence.",
        });
      }
      continue;
    }
    if (
      price.amount_confidence === "high" &&
      (
        price.pairing_confidence === "high" ||
        (
          highConfidenceExplicitTotalBasePriceIds.has(price.price_id) &&
          confidenceRank(price.pairing_confidence) >= confidenceRank("medium")
        )
      )
    ) {
      let option = optionForSidecarPrice(price, updatedOptions.length + addedOptions.length);
      const bundledTotal = highConfidenceBundledTotalsByAmount.get(price.price_value);
      if (bundledTotal) option = markBundledTotalScope(option, bundledTotal);
      addedOptions.push(option);
      existingAmounts.add(price.price_value);
    } else if (price.amount_confidence === "high") {
      needsReview.push({
        price_id: price.price_id,
        amount: price.price_value,
        display: price.price_display || money(price.price_value),
        amount_confidence: price.amount_confidence,
        pairing_confidence: price.pairing_confidence,
        context: price.context,
        reason: "High-confidence price amount is missing from TD2, but its option/scope pairing is not high confidence.",
      });
    }
  }

  for (const interpretation of highConfidenceComputedAddOns) {
    if (existingAmounts.has(interpretation.combined_price_value)) continue;
    if (!existingAmounts.has(interpretation.base_price_value)) {
      needsReview.push({
        price_id: interpretation.add_on_price_id,
        amount: interpretation.combined_price_value,
        display: interpretation.combined_price_display || money(interpretation.combined_price_value),
        amount_confidence: interpretation.amount_confidence,
        pairing_confidence: interpretation.pairing_confidence,
        context: interpretation.context,
        reason: "High-confidence add-on arithmetic found a bundled option, but the base price is not represented in TD2.",
      });
      continue;
    }
    const option = optionForComputedAddOn(interpretation, updatedOptions.length + addedOptions.length);
    addedOptions.push(option);
    existingAmounts.add(interpretation.combined_price_value);
  }

  const rawText = asString(reconciled.raw_input?.customer_text || reconciled.raw_input || "");
  const duplicatePriceCollapse = collapseRepeatedSamePriceOptions([...updatedOptions, ...addedOptions], rawText, prices);
  const finalOptions = duplicatePriceCollapse.items;
  const acceptedExactAmounts = new Set(finalOptions.map(amountFromOption).filter(Boolean));
  const acceptedTotalRelationships = acceptedTotalRelationshipsForAmounts(monetaryRelationships, acceptedExactAmounts);
  const acceptedTotalPriceIds = new Set(acceptedTotalRelationships.map((relationship) => relationship.total_price_id).filter(Boolean));
  const acceptedComponentPriceIds = new Set(acceptedTotalRelationships.flatMap((relationship) => relationship.component_price_ids || []));
  const acceptedExactPriceIds = new Set(finalOptions.map((option) => option.sidecar_price_id).filter(Boolean));
  const acceptedBundlePriceIds = new Set([
    ...highConfidenceComputedAddOns.map((interpretation) => interpretation.add_on_price_id).filter(Boolean),
    ...[...highConfidenceBundledTotalsByAmount.values()].map((interpretation) => interpretation.add_on_price_id).filter(Boolean),
  ]);
  const addOnPriceIdsAllowedAsStandalone = new Set(downgradedAddOnReviews.map((item) => item.price_id).filter(Boolean));
  const quarantinedPriceIds = new Set(quarantinedFinalPrices.map((item) => item.price_id).filter(Boolean));
  reconciled.service_options = {
    ...(reconciled.service_options || {}),
    items: finalOptions,
  };
  reconciled.layout_flags = {
    ...(reconciled.layout_flags || {}),
    option_count: finalOptions.length,
    over_normal_option_limit: Boolean(reconciled.layout_flags?.over_normal_option_limit || finalOptions.length > 4),
  };
  reconciled.normalization = {
    ...(reconciled.normalization || {}),
    sidecar_price_reconciliation: {
      sidecar_prices: prices.map((price) => ({
        price_id: price.price_id,
        amount: price.price_value,
        display: price.price_display,
        amount_confidence: price.amount_confidence,
        pairing_confidence: price.pairing_confidence,
        description: price.description_raw,
        source: price.source,
        ...candidateDecision({
          priceId: price.price_id,
          amount: price.price_value,
          acceptedExactAmounts,
          acceptedExactPriceIds,
          acceptedBundlePriceIds,
          acceptedTotalPriceIds,
          acceptedComponentPriceIds,
          quarantinedPriceIds,
          addOnPriceIdsNeedingReview,
          addOnPriceIdsToCompute,
          highConfidenceBundledTotalsByAmount,
        }),
      })),
      add_on_interpretations: addOnInterpretations.map((interpretation) => ({
        interpretation_id: interpretation.interpretation_id,
        interpretation: interpretation.interpretation,
        base_price_id: interpretation.base_price_id,
        base_amount: interpretation.base_price_value,
        add_on_price_id: interpretation.add_on_price_id,
      add_on_amount: interpretation.add_on_price_value,
        incremental_add_on_amount: interpretation.incremental_add_on_amount,
        combined_amount: interpretation.combined_price_value,
        display: interpretation.combined_price_display,
        price_role: interpretation.price_role,
        price_role_confidence: interpretation.price_role_confidence,
        price_role_evidence_text: interpretation.price_role_evidence_text,
        price_role_ambiguity_reason: interpretation.price_role_ambiguity_reason,
        amount_confidence: interpretation.amount_confidence,
        pairing_confidence: interpretation.pairing_confidence,
        addon_interpretation_confidence: interpretation.addon_interpretation_confidence,
        review_reason: interpretation.review_reason,
        ...interpretationDecision({
          interpretation: interpretation.interpretation,
          needsReview: interpretation.needs_review,
          reviewReason: interpretation.review_reason,
          addOnPriceId: interpretation.add_on_price_id,
          amount: interpretation.combined_price_value,
          priceRole: interpretation.price_role,
          acceptedExactAmounts,
          highConfidenceComputedAddOns: addOnPriceIdsToCompute,
          highConfidenceBundledTotalsByAmount,
          addOnPriceIdsAllowedAsStandalone,
          acceptedComponentPriceIds,
        }),
      })),
      monetary_relationships: monetaryRelationships.map((relationship) => ({
        ...relationship,
        accepted: acceptedTotalPriceIds.has(relationship.total_price_id),
      })),
      added_options: addedOptions.map((option) => ({
        price_id: option.sidecar_price_id,
        display: option.price.display,
        description: option.description,
      })),
      duplicate_price_collapses: duplicatePriceCollapse.collapses,
      downgraded_add_on_reviews: downgradedAddOnReviews,
      replaced_standalone_add_on_options: replacedStandaloneAddOnOptions,
      needs_review: needsReview,
      invented_prices: inventedPrices,
      quarantined_final_prices: quarantinedFinalPrices,
      final_price_gate: {
        accepted_amounts: [...acceptedSidecarAmounts].sort((left, right) => left - right).map((amount) => ({
          amount,
          display: money(amount),
        })),
        rule: "Final TD2 quote prices are quarantined when they have only weak sidecar pairing evidence and stronger accepted price evidence exists in the same note.",
      },
    },
  };

  const warnings = [
    ...addedOptions.map((option) => option.source === "sidecar_add_on_price_reconciliation"
      ? `Added computed high-confidence add-on option ${option.price.display} to TD2 as ${option.description}.`
      : `Added missing high-confidence sidecar price ${option.price.display} to TD2 as ${option.description}.`,
    ),
    ...replacedStandaloneAddOnOptions.map((option) =>
      `Replaced standalone add-on amount ${option.display} with a computed bundled option.`,
    ),
    ...downgradedAddOnReviews.map((item) =>
      `Allowed high-confidence second price ${item.display} as ${item.description || "a scoped option"}; review if needed before sending.`,
    ),
  ];
  const blockingErrors = [
    ...needsReview.map((item) => item.kind === "add_on_interpretation"
      ? `Possible add-on price ${item.display} needs TD2 review before PDF.`
      : `High-confidence sidecar price ${item.display} needs TD2 review before PDF.`,
    ),
    ...quarantinedFinalPrices.map((item) =>
      `TD2 price ${item.display} was quarantined because sidecar price evidence was not strong enough for a final quote price.`,
    ),
    ...inventedPrices.map((item) =>
      `TD2 price ${item.display} was not found in sidecar/raw price evidence.`,
    ),
  ];
  const followUps = [
    ...needsReview.map((item) =>
      `Confirm what work ${item.display} belongs to before sending the estimate.`,
    ),
    ...inventedPrices.map((item) =>
      `Confirm whether ${item.display} is a real quote price or remove it from TD2.`,
    ),
    ...quarantinedFinalPrices.map((item) =>
      `Confirm whether ${item.display} is a real quote price and what option it belongs to.`,
    ),
  ];

  reconciled.validation = {
    ...(reconciled.validation || {}),
    price_reconciliation_warnings: unique([...(reconciled.validation?.price_reconciliation_warnings || []), ...warnings]),
    price_reconciliation_blocking_errors: unique([...(reconciled.validation?.price_reconciliation_blocking_errors || []), ...blockingErrors]),
    price_reconciliation_follow_ups: unique([...(reconciled.validation?.price_reconciliation_follow_ups || []), ...followUps]),
  };

  return reconciled;
}
