import { canonicalReadinessField } from "./readinessReview.js";
import { explicitSourceOptionsForCoverage } from "./sourceFinalFactCoverage.js";

/**
 * Readiness safety invariants.
 *
 * The evaluator always returns the complete shadow diagnostic set. Findings
 * with a stable review target are also marked enforceable so the caller can
 * enable the staging gate without turning targetless diagnostics into silent
 * blockers.
 */

export const READINESS_SAFETY_VERSION = "readiness-safety-v0.2";

export const READINESS_INVARIANT_CODES = Object.freeze([
  "UNRESOLVED_EXPLICIT_CORRECTION",
  "CONFLICTING_SUPPORTED_CANDIDATES",
  "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
  "UNSUPPORTED_CUSTOMER_FACING_VALUE",
  "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
  "SOURCE_FACT_OMITTED_WITHOUT_REASON",
  "GENERATED_STATEMENT_AS_EVIDENCE",
]);

const CRITICAL_DECISION_FIELDS = new Set([
  "phone",
  "email",
  "address",
  "service_address",
  "tree_count",
  "prices",
  "service_options.prices",
]);

const MATERIAL_SOURCE_FINAL_FACTS = new Set([
  "option_label",
  "price",
  "work_actions",
  "species",
  "tree_quantity",
  "stump_quantity",
  "stump_treatment",
  "debris_disposition",
  "target_qualifiers",
  "customer_phone",
  "customer_email",
  "service_address",
]);

const CORRECTION_EDGE_TYPES = new Set(["supersedes", "narrows"]);

const PRICE_RESOLVED_REASON_PREFIXES = [
  "accepted_",
  "rejected_",
  "quarantined_",
  "not_used_",
];

const GENERATED_EVIDENCE_FIELD_KEYS = [
  "customer_name",
  "phone",
  "email",
  "service_address",
  "tree_count",
  "tree_type",
  "work_scope",
  "price",
  "options",
];

const PRICE_STRUCTURE_ERROR_CODES = new Set([
  "AMBIGUOUS_PRICE_ROLE",
  "AMBIGUOUS_OPTION_RELATIONSHIP",
  "BASE_SCOPE_INCLUDES_ADDON",
  "DEPENDENT_ADDON_STANDALONE",
  "DEPENDENT_ADDON_MISSING_BASE",
  "EXPLICIT_TOTAL_ADDED_TWICE",
  "EXPANDED_PRICE_MISMATCH",
  "EXPANDED_SCOPE_INCOMPLETE",
  "INCREMENTAL_ADDON_USED_AS_TOTAL",
  "MISSING_BASE_CHOICE",
  "MISSING_EXPANDED_CHOICE",
  "REVERSED_BASE_ADDON_ORDER",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeComparable(value) {
  return asString(value)
    .toLowerCase()
    .replace(/[^\w\s@$./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactWhitespace(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function rawCustomerText(json = {}) {
  return asString(json?.raw_input?.customer_text || "");
}

function rawServiceText(json = {}) {
  return rawCustomerText(json)
    .replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/\b\d+\s+[A-Za-z][A-Za-z .'-]*(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct|Way|Blvd|Boulevard|Highway|Hwy)\b[^.!?;]*?(?:,?\s+)(?:\bIN\b|\bIndiana\b)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourcePriceAmounts(text) {
  return [...String(text || "").matchAll(/(?<![\w@.-])\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,6})(?![\w@-])/g)]
    .map((match) => Number(String(match[1] || "").replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function candidateIdsForPriceField(json = {}) {
  return asArray(json?.normalization?.decisions?.prices?.candidates)
    .filter((candidate) => candidate?.status !== "quarantined")
    .map((candidate) => candidate?.id)
    .filter(Boolean);
}

function hasDependentPriceLanguage(text) {
  return /\b(?:same\s+work|same\s+removal|plus|extra|additional|add(?:itional)?|on\s+top|with|includes?|included|total|more|and|if\s+(?:the\s+)?customer\s+wants?|maybe\s+included)\b/i.test(text);
}

function hasIndependentPriceLanguage(text) {
  const value = String(text || "");
  if (/\b(?:both\s+ways|each\s+option|separately|separate|different)\b/i.test(value)) return true;
  return /\b(?:price|priced|option|quote|extra|total)\b[^.!?;]{0,30}\bor\b|\bor\b[^.!?;]{0,30}\b(?:price|priced|option|quote|extra|total)\b/i.test(value);
}

function hasSeparatePricedServiceSegments(text) {
  const segments = String(text || "").match(
    /(?:^|[.!?;])[^.!?;]*(?:tree|trees|stump|stumps|grind|trim|prune|haul|cleanup|brush)[^.!?;]*\$?\s*\d{3,6}/gi,
  ) || [];
  return segments.some((segment) => /\b(?:stump|stumps|stumping|grind|grinding)\b/i.test(segment)) &&
    segments.some((segment) => /\b(?:tree|trees|removal|remove|trim|prune)\b/i.test(segment));
}

function hasPriceAdjacentAmbiguity(text) {
  const source = String(text || "");
  const pricePattern = /(?<![\w@.-])\$?\s*(?:\d{1,3}(?:,\d{3})+|\d{3,6})(?![\w-])/g;
  for (const match of source.matchAll(pricePattern)) {
    const start = match.index ?? 0;
    const before = source.slice(0, start);
    const segmentStart = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf(";"),
      before.lastIndexOf("\n"),
      before.lastIndexOf("--"),
      before.lastIndexOf("—"),
    ) + 1;
    const segment = source.slice(segmentStart, Math.min(source.length, start + match[0].length + 48));
    if (/\b(?:maybe|possibly|not\s+sure|unclear|tbd|depending|if\s+(?:they|he|she|customer)\s+wants?|approximate(?:ly)?|around)\b/i.test(segment)) {
      return true;
    }
  }
  return false;
}

function evaluateRawPriceAmbiguity(json, options = []) {
  const text = rawServiceText(json);
  const amounts = [...new Set(sourcePriceAmounts(text))];
  if (amounts.length < 2) return [];

  const hasOptionLabels = /\b(?:option|opt)\s*[A-E1-5]\b/i.test(text);
  const finalAmounts = [...new Set(asArray(options)
    .map((option) => Number(option?.price?.amount ?? option?.price?.min_amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0))];
  const labeledPricesAreResolved = hasOptionLabels &&
    finalAmounts.length === amounts.length &&
    amounts.every((amount) => finalAmounts.includes(amount));
  if (labeledPricesAreResolved) return [];

  const ambiguous = hasPriceAdjacentAmbiguity(text);
  const dependent = hasDependentPriceLanguage(text);
  const independent = hasIndependentPriceLanguage(text) ||
    (!dependent && hasSeparatePricedServiceSegments(text)) ||
    (!dependent && hasOptionLabels) ||
    (!hasOptionLabels && ambiguous);
  if (!independent) return [];
  return [createFinding({
    invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
    reason: "The source contains multiple price amounts whose option or inclusion relationship is not resolved.",
    field: "service_options.prices",
    candidate_ids: candidateIdsForPriceField(json),
    evidence: {
      kind: "raw_price_relationship",
      amounts,
      option_labels_present: hasOptionLabels,
      independent_language: hasIndependentPriceLanguage(text),
      ambiguous_language: ambiguous,
      source_excerpt: text.slice(0, 500),
      final_option_count: asArray(options).length,
    },
  })];
}

function evaluateRawOptionScopeMismatch(json, options = []) {
  const source = rawServiceText(json).toLowerCase();
  if (!source || !options.length) return [];
  const final = options
    .map((option) => [option?.title, option?.description].filter(Boolean).join(" ").toLowerCase())
    .join(" ");
  const mismatches = [];

  if (/\b(?:branch|limb)\b/.test(source) && !/\b(?:branch|limb)\b/.test(final)) {
    mismatches.push({ fact: "work_actions", source_signal: "branch_or_limb", final_signal: "branch_or_limb" });
  }
  if (/\b(?:fell|take\s+down|cut\s+down)\b/.test(source) &&
      !/\b(?:remove|removal|fell|take\s+down|cut\s+down|tree)\b/.test(final)) {
    mismatches.push({ fact: "work_actions", source_signal: "removal_action", final_signal: "removal_action" });
  }
  if (/\bbackfill\b/.test(source) && !/\bbackfill\b/.test(final)) {
    mismatches.push({ fact: "stump_treatment", source_signal: "backfill", final_signal: "backfill" });
  }
  if (/\b(?:split\s+logs?|firewood)\b/.test(source) && !/\b(?:split|logs?|firewood)\b/.test(final)) {
    mismatches.push({ fact: "work_actions", source_signal: "split_logs", final_signal: "split_logs" });
  }
  if (/\b(?:stump|stumps|stumping|grind|grinding)\b/.test(source) &&
      !/\b(?:not\s+included|excluded|without|no\s+(?:stump|grind))/i.test(source) &&
      !/\b(?:stump|stumps|stumping|grind|grinding)\b/.test(final)) {
    mismatches.push({ fact: "stump_treatment", source_signal: "stump_work", final_signal: "stump_work" });
  }

  return mismatches.map((mismatch) => createFinding({
    invariant_code: "UNSUPPORTED_CUSTOMER_FACING_VALUE",
    reason: `The final priced option does not preserve the explicit source ${mismatch.fact.replaceAll("_", " ")} detail.`,
    field: "service_options.prices",
    candidate_ids: candidateIdsForPriceField(json),
    option_id: options[0]?.label || "Option A",
    evidence: {
      kind: "raw_option_scope_mismatch",
      fact: mismatch.fact,
      source_signal: mismatch.source_signal,
      final_signal: mismatch.final_signal,
      source_excerpt: source.slice(0, 500),
      final_option_excerpt: final.slice(0, 500),
    },
  }));
}

function sourceCustomerText(json = {}) {
  return asString(json?.raw_input?.customer_text || "");
}

function optionTextForLabel(options = [], optionLabel = "") {
  const option = optionForLabel(options, optionLabel);
  return compactWhitespace([option?.title, option?.description].filter(Boolean).join(" "));
}

function optionForLabel(options = [], optionLabel = "") {
  const token = asString(optionLabel).replace(/^option\s+/i, "").trim().toUpperCase();
  return asArray(options).find((candidate, index) => {
    const label = asString(candidate?.label).replace(/^option\s+/i, "").trim().toUpperCase();
    return label === token || (!label && token === String.fromCharCode(65 + index));
  });
}

function isDependentOption(options = [], optionLabel = "") {
  const option = optionForLabel(options, optionLabel);
  const canonical = option?.canonical_option || {};
  return canonical.option_kind === "base_plus_dependent_addon" ||
    (canonical.price_relationship === "total_of" && asArray(canonical.add_on_item_ids).length > 0);
}

function isExplicitTotalOption(options = [], optionLabel = "") {
  const option = optionForLabel(options, optionLabel);
  return option?.canonical_option?.price_role === "EXPLICIT_OPTION_TOTAL";
}

function optionLocalFactNeedsEnforcement(result = {}) {
  if (!result?.option_label || !["missing", "changed"].includes(result.status)) return false;
  if (result.override_recorded) return false;
  const sourceValue = normalizeComparable(result.source_value || "");
  if (result.fact === "work_actions") {
    return /full\s+removal|cut\s+rounds?|haul\b/.test(sourceValue);
  }
  if (result.fact === "debris_disposition") {
    return /haul\s+(?:brush|debris)|leave\s+|stack\s+|chip\s+/.test(sourceValue);
  }
  return false;
}

function evaluateOptionLocalSourceFidelity(sourceFinalCoverage, options = []) {
  return asArray(sourceFinalCoverage?.results)
    .filter((result) => optionLocalFactNeedsEnforcement(result) && isDependentOption(options, result.option_label))
    .map((result) => createFinding({
      invariant_code: "UNSUPPORTED_CUSTOMER_FACING_VALUE",
      reason: result.message ||
        `Final ${result.option_label} does not preserve the source option-local ${result.fact_label || result.fact} detail.`,
      field: "service_options.prices",
      option_id: result.option_label,
      evidence: {
        kind: "source_option_local_fact_mismatch",
        option_label: result.option_label,
        fact: result.fact,
        status: result.status,
        source_value: result.source_value || "",
        final_value: result.final_value || "",
        missing_source_values: result.missing_source_values || [],
        code: result.code || "",
      },
    }));
}

function hasSpecificCleanupTarget(text) {
  return /\b(?:brush|debris|wood|logs?|chips?|rounds?|yard|site|work\s+area|area|drive(?:way)?|everything)\b/i.test(text);
}

function evaluateInferredOptionCleanupSpecificity(json, options = []) {
  const sourceOptions = explicitSourceOptionsForCoverage(sourceCustomerText(json));
  if (sourceOptions.length < 2) return [];

  return sourceOptions.flatMap((sourceOption, index) => {
    const sourceSegment = compactWhitespace(sourceOption.segment);
    if (!/\b(?:cleanup|clean\s+up|final\s+cleanup)\b/i.test(sourceSegment)) return [];
    if (hasSpecificCleanupTarget(sourceSegment)) return [];
    const finalText = optionTextForLabel(options, sourceOption.label) ||
      optionTextForLabel(options, `Option ${String.fromCharCode(65 + index)}`);
    if (!isDependentOption(options, sourceOption.label) &&
        !isDependentOption(options, `Option ${String.fromCharCode(65 + index)}`)) return [];
    if (!isExplicitTotalOption(options, sourceOption.label) &&
        !isExplicitTotalOption(options, `Option ${String.fromCharCode(65 + index)}`)) return [];
    if (!finalText || !hasSpecificCleanupTarget(finalText)) return [];
    return [createFinding({
      invariant_code: "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
      reason: `${sourceOption.label} gives a priced generic cleanup scope, but the final option adds a specific cleanup target without reviewer approval.`,
      field: "service_options.prices",
      option_id: sourceOption.label,
      evidence: {
        kind: "source_option_cleanup_specificity",
        option_label: sourceOption.label,
        source_excerpt: sourceSegment.slice(0, 300),
        final_option_excerpt: finalText.slice(0, 300),
        source_cleanup_scope: "generic",
        final_cleanup_scope: "specific",
      },
    })];
  });
}

function evaluateOptionSpecificityIntroducedByAssembler(json, options = []) {
  const sourceOptions = explicitSourceOptionsForCoverage(sourceCustomerText(json));
  if (sourceOptions.length < 2) return [];

  return sourceOptions.flatMap((sourceOption, index) => {
    const sourceSegment = compactWhitespace(sourceOption.segment);
    const optionLabel = sourceOption.label || `Option ${String.fromCharCode(65 + index)}`;
    const finalOption = optionForLabel(options, optionLabel) ||
      optionForLabel(options, `Option ${String.fromCharCode(65 + index)}`);
    const finalText = compactWhitespace([finalOption?.title, finalOption?.description].filter(Boolean).join(" "));
    const finalTitle = compactWhitespace(finalOption?.title);
    if (!finalText) return [];
    if (!isDependentOption(options, optionLabel) &&
        !isDependentOption(options, `Option ${String.fromCharCode(65 + index)}`)) return [];

    const sourceHasGenericHaul = /\b(?:haul|hual|hawl)\b/i.test(sourceSegment) &&
      !/\b(?:brush|debris|logs?|wood|chips?)\b.{0,24}\b(?:haul|hual|hawl)\b|\b(?:haul|hual|hawl)\b.{0,24}\b(?:brush|debris|logs?|wood|chips?)\b/i.test(sourceSegment);
    const bareHaulPattern = /\b(?:haul|hual|hawl)\b(?!\s+(?:away|it|the)\b)/i;
    const sourceHasBareHaulWithDependentAction = sourceHasGenericHaul &&
      bareHaulPattern.test(sourceSegment) &&
      /\b(?:haul|hual|hawl)\b\s*(?:and|plus|,)|\b(?:stump|grind|grinding)\b.{0,24}\b(?:haul|hual|hawl)\b/i.test(sourceSegment);
    const finalAddsHaulMaterial = /\b(?:brush|debris|logs?|wood|chips?)\b/i.test(finalText);
    const sourceHasLogHaul = /\b(?:haul|hual|hawl)\b.{0,24}\blogs?\b|\blogs?\b.{0,24}\b(?:haul|hual|hawl)\b/i.test(sourceSegment);
    const sourceHasCutRounds = /\bcut\s+(?:the\s+)?rounds?\b/i.test(sourceSegment);
    const titleDropsMaterial = (sourceHasLogHaul && !/\blogs?\b/i.test(finalTitle)) ||
      (sourceHasCutRounds && !/\brounds?\b/i.test(finalTitle));
    if ((!sourceHasBareHaulWithDependentAction || !finalAddsHaulMaterial) && !titleDropsMaterial) return [];
    const enforceable = sourceHasBareHaulWithDependentAction && finalAddsHaulMaterial;

    return [createFinding({
      invariant_code: "UNSUPPORTED_CUSTOMER_FACING_VALUE",
      reason: `${optionLabel} final wording adds or drops a material-specific scope detail that is not represented at the source option level.`,
      field: enforceable ? "service_options.prices" : "",
      option_id: optionLabel,
      evidence: {
        kind: "source_option_specificity_change",
        option_label: optionLabel,
        source_excerpt: sourceSegment.slice(0, 300),
        final_option_excerpt: finalText.slice(0, 300),
        final_title: finalTitle,
        source_generic_haul: sourceHasGenericHaul,
        source_bare_haul_with_dependent_action: sourceHasBareHaulWithDependentAction,
        final_adds_haul_material: finalAddsHaulMaterial,
        source_log_haul: sourceHasLogHaul,
        source_cut_rounds: sourceHasCutRounds,
      },
    })];
  });
}

function evaluateIndependentAlternativeReview(json, options = []) {
  const source = sourceCustomerText(json);
  const sourceOptions = explicitSourceOptionsForCoverage(source);
  if (sourceOptions.length < 2 || !/\bdifferent\b/i.test(source)) return [];
  return [createFinding({
    invariant_code: "CONFLICTING_SUPPORTED_CANDIDATES",
    reason: "The source explicitly describes different alternatives; retain the review requirement even when both option prices are resolved.",
    evidence: {
      kind: "independent_alternative_review",
      option_labels: sourceOptions.map((option) => option.label),
      source_excerpt: source.slice(0, 500),
      final_option_count: asArray(options).length,
    },
  })];
}

function finalCustomerText(json = {}, options = []) {
  const optionText = asArray(options)
    .map((option) => [option?.title, option?.description, option?.price?.display].filter(Boolean).join(" "))
    .join(" ");
  return [
    json?.customer?.name,
    json?.customer?.phone_display,
    json?.customer?.phone_primary,
    json?.customer?.email,
    json?.job?.service_address?.display,
    json?.job?.description,
    json?.job?.tree_details?.tree_count,
    json?.job?.tree_details?.tree_type,
    optionText,
  ]
    .filter(Boolean)
    .join(" ");
}

function quoteFoundInRaw(quote, rawText) {
  const needle = normalizeComparable(quote);
  if (!needle || needle.length < 3) return true;
  const haystack = normalizeComparable(rawText);
  if (!haystack) return false;
  if (haystack.includes(needle)) return true;

  // Allow minor formatting drift (commas in prices, optional $).
  const looseNeedle = needle.replace(/\$/g, "").replace(/,/g, "");
  const looseHaystack = haystack.replace(/\$/g, "").replace(/,/g, "");
  return Boolean(looseNeedle) && looseHaystack.includes(looseNeedle);
}

function claimById(graph, id) {
  return asArray(graph?.claims).find((claim) => claim?.id === id) || null;
}

function claimValueText(claim) {
  const value = claim?.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return asString(value);
  }
  if (Array.isArray(value)) return value.map((entry) => asString(entry)).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return [
      value.action,
      value.digits,
      value.display,
      value.count,
      ...(Array.isArray(value.entities) ? value.entities : []),
    ]
      .map((entry) => asString(entry))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function claimAdoptedInFinal(claim, finalText) {
  if (!claim) return false;
  const evidence = compactWhitespace(claim.evidence);
  const valueText = compactWhitespace(claimValueText(claim));
  const haystack = normalizeComparable(finalText);
  if (!haystack) return false;
  if (evidence && haystack.includes(normalizeComparable(evidence))) return true;
  if (valueText && haystack.includes(normalizeComparable(valueText))) return true;
  return false;
}

function hasReviewerScopeApproval(json = {}, option = {}) {
  const overrides = json?.review?.overrides || {};
  if (overrides.unclearScopeWithPrice) return true;
  const flags = option?.review_flags || {};
  return Boolean(
    flags.description_server_verified_td_edit ||
    flags.source_to_final_verified_override ||
    flags.scope_approved_by_reviewer,
  );
}

function hasReviewerValueApproval(json = {}, result = {}) {
  if (result?.override_recorded) return true;
  const overrides = json?.review?.overrides || {};
  if (result?.fact === "service_address" && overrides.missingAddress) return true;
  if (result?.fact === "customer_phone" && (overrides.missingPhone || overrides.missingContact)) return true;
  if (result?.fact === "customer_email" && (overrides.missingEmail || overrides.missingContact)) return true;
  return false;
}

function priceReasonResolved(reasonCode = "") {
  const code = asString(reasonCode);
  if (!code) return false;
  return PRICE_RESOLVED_REASON_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function highConfidencePriceUnresolved(entry = {}) {
  if (asString(entry.amount_confidence) !== "high") return false;
  const status = asString(entry.candidate_status);
  const reasonCode = asString(entry.reason_code);
  const priceRole = asString(entry.price_role);

  // Ambiguous role that was still accepted into a final quote needs explicit review.
  if (priceRole === "AMBIGUOUS_PRICE_ROLE" && (status === "accepted" || /^accepted_/.test(reasonCode))) {
    return true;
  }

  if (status === "accepted" || status === "rejected" || status === "quarantined") {
    if (/^needs_review_/.test(reasonCode)) return true;
    if (reasonCode === "accepted_exact_final_price_with_warning") return true;
    return false;
  }
  if (priceReasonResolved(reasonCode)) return false;
  if (/^needs_review_/.test(reasonCode)) return true;
  if (!reasonCode && (status === "eligible" || !status)) return true;
  return !priceReasonResolved(reasonCode);
}

function finalOptionText(options = []) {
  return asArray(options)
    .map((option) => [option?.label, option?.title, option?.description].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();
}

function priceWarningIsCoveredByResolvedScope(json = {}, options = []) {
  const source = rawServiceText(json);
  const final = finalOptionText(options);
  if (!source || !final || !options.length) return false;

  const ambiguous = /\b(?:unclear|not\s+sure|maybe|possibly|tbd|depending|unclear\s+whether)\b/i.test(source);
  const independent = hasIndependentPriceLanguage(source);
  if (ambiguous || independent) return false;

  const sourceSignals = [
    [/(?:stump|stumps|stumping|grind|grinding)/i, /(?:stump|stumps|stumping|grind|grinding)/i],
    [/(?:split\s+logs?|firewood)/i, /(?:split\s+logs?|firewood)/i],
    [/(?:haul|brush|debris)/i, /(?:haul|brush|debris)/i],
    [/(?:cleanup|clean\s+up)/i, /(?:cleanup|clean\s+up)/i],
    [/(?:leave\s+(?:the\s+)?(?:wood|logs?|rounds?|trunk|brush))/i, /(?:leave|wood|logs?|rounds?|trunk|brush)/i],
  ];
  const signalsCovered = sourceSignals.every(([sourcePattern, finalPattern]) =>
    !sourcePattern.test(source) || finalPattern.test(final),
  );
  if (!signalsCovered) return false;

  const amounts = [...new Set(sourcePriceAmounts(source))];
  const finalAmounts = [...new Set(options.map((option) => Number(option?.price?.amount ?? option?.price?.min_amount)))]
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const hasClearMultipleOptions = amounts.length >= 2 && finalAmounts.length >= 2;
  return hasDependentPriceLanguage(source) || hasClearMultipleOptions;
}

function decisionFieldIsCritical(field) {
  const name = asString(field);
  if (CRITICAL_DECISION_FIELDS.has(name)) return true;
  return /phone|email|address|tree_count|price/i.test(name);
}

function supportedCandidate(candidate = {}) {
  return ["explicit", "normalized_explicit"].includes(candidate.support) &&
    ["eligible", "selected"].includes(candidate.status);
}

function candidateValueKey(candidate = {}) {
  const value = candidate.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return normalizeComparable(value);
  }
  if (typeof value === "object") {
    if (value.amount != null) return normalizeComparable(value.amount);
    if (value.display != null) return normalizeComparable(value.display);
    if (value.count != null) return normalizeComparable(value.count);
    if (value.digits != null) return normalizeComparable(value.digits);
  }
  return normalizeComparable(JSON.stringify(value));
}

function supportedDistinctValues(candidates = []) {
  const values = [];
  for (const candidate of asArray(candidates).filter(supportedCandidate)) {
    const key = candidateValueKey(candidate);
    if (key && !values.includes(key)) values.push(key);
  }
  return values;
}

function conflictingSupportedCandidates(envelope = {}) {
  const status = envelope?.resolution?.status;
  const reasonCode = envelope?.resolution?.reasonCode;
  const candidates = asArray(envelope.candidates).filter((candidate) => {
    if (envelope.field !== "job.tree_details.tree_count") return true;
    const count = Number(asString(candidate?.value).match(/\d+/)?.[0] || 0);
    if (count > 49) return false;
    return !(candidate?.evidence || []).some((evidence) =>
      /\b\d+\s+[A-Za-z][A-Za-z .'-]*(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|way|highway|hwy)\b/i.test(asString(evidence?.quote)),
    );
  });
  const distinct = supportedDistinctValues(candidates);

  // Equivalent restatements (e.g. "1 tree" vs "one maple" → same count) are not conflicts.
  if (distinct.length < 2) return false;

  if (status === "unresolved" || status === "requires_review") return true;
  if (reasonCode === "conflicting_supported_candidates") return true;
  return !envelope?.resolution?.selectedCandidateId;
}

function inferredFindingField(invariantCode, evidence = {}) {
  const evidenceField = canonicalReadinessField(evidence.field || evidence.fact || "");
  if (evidenceField) return evidenceField;
  if (invariantCode === "UNRESOLVED_EXPLICIT_CORRECTION") {
    return canonicalReadinessField(evidence.correction_field || "");
  }
  if ([
    "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
    "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
  ].includes(invariantCode)) {
    return "service_options.prices";
  }
  if ([
    "SOURCE_FACT_OMITTED_WITHOUT_REASON",
    "UNSUPPORTED_CUSTOMER_FACING_VALUE",
  ].includes(invariantCode)) {
    const factField = canonicalReadinessField(evidence.fact || "");
    if (factField) return factField;
    if (!evidence.option_label) return "";
    if (["price"].includes(evidence.fact)) return "service_options.prices";
    if (["tree_quantity", "stump_quantity"].includes(evidence.fact)) {
      return "job.tree_details.tree_count";
    }
    return "";
  }
  return "";
}

function candidateIdsFromEvidence(evidence = {}) {
  return [
    ...asArray(evidence.candidate_ids),
    ...asArray(evidence.supported_candidate_ids),
    evidence.candidate_id,
    evidence.price_id,
  ].map(asString).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
}

const VOLATILE_FINDING_EVIDENCE_KEYS = new Set([
  "candidate_id",
  "candidate_ids",
  "supported_candidate_ids",
  "candidate_status",
  "decision_key",
  "final_option_count",
  "final_option_excerpt",
  "price_id",
  "reason_code",
  "resolution_status",
]);

function stableFindingEvidence(value, key = "") {
  if (VOLATILE_FINDING_EVIDENCE_KEYS.has(key)) return undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => stableFindingEvidence(entry)).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([entryKey]) => !VOLATILE_FINDING_EVIDENCE_KEYS.has(entryKey))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryKey, entryValue]) => [entryKey, stableFindingEvidence(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined),
  );
}

function decisionKeyForField(field) {
  const reviewField = canonicalReadinessField(field);
  return reviewField === "customer.phone"
    ? "phone"
    : reviewField === "customer.email"
      ? "email"
      : reviewField === "job.service_address"
        ? "service_address"
        : reviewField === "job.tree_details.tree_count"
          ? "tree_count"
          : reviewField === "service_options.prices"
            ? "prices"
            : "";
}

function correctionCandidateIds(json, correction) {
  const envelope = json?.normalization?.decisions?.[decisionKeyForField(correction?.field)] || {};
  const correctionEvidence = normalizeComparable(correction?.evidence || "");
  const correctionValue = normalizeComparable(claimValueText(correction));
  const candidates = asArray(envelope.candidates);
  const matching = candidates.filter((candidate) => {
    const candidateEvidence = asArray(candidate?.evidence)
      .map((evidence) => normalizeComparable(evidence?.quote))
      .filter(Boolean);
    const candidateValue = normalizeComparable(candidateValueKey(candidate));
    return (correctionEvidence && candidateEvidence.some((quote) => quote.includes(correctionEvidence) || correctionEvidence.includes(quote))) ||
      (correctionValue && candidateValue && (candidateValue.includes(correctionValue) || correctionValue.includes(candidateValue)));
  });
  const selected = matching.length ? matching : candidates;
  return selected.map((candidate) => asString(candidate?.id)).filter(Boolean);
}

function createFinding({
  invariant_code,
  reason,
  evidence = {},
  field = "",
  candidate_ids = [],
  option_id = "",
} = {}) {
  const nextEvidence = evidence && typeof evidence === "object" ? evidence : {};
  const reviewField = canonicalReadinessField(field) || inferredFindingField(invariant_code, nextEvidence);
  const candidateIds = [...new Set([
    ...candidateIdsFromEvidence(nextEvidence),
    ...asArray(candidate_ids).map(asString).filter(Boolean),
  ])];
  const optionId = asString(option_id || nextEvidence.option_id || nextEvidence.option_label);
  const findingKey = JSON.stringify({
    invariant_code,
    field: reviewField,
    option_id: optionId,
    evidence: stableFindingEvidence(nextEvidence),
  });
  const enforceable = Boolean(reviewField && (candidateIds.length || optionId || [
    "UNRESOLVED_EXPLICIT_CORRECTION",
    "CONFLICTING_SUPPORTED_CANDIDATES",
    "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
    "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
    "SOURCE_FACT_OMITTED_WITHOUT_REASON",
    "UNSUPPORTED_CUSTOMER_FACING_VALUE",
  ].includes(invariant_code)));
  return {
    finding_id: `finding_${stableHash(findingKey)}`,
    invariant_code,
    field: reviewField,
    candidate_ids: candidateIds,
    option_id: optionId,
    enforceable,
    would_block: true,
    reason: asString(reason),
    evidence: nextEvidence,
  };
}

function evaluateUnresolvedExplicitCorrection(json, options) {
  const graph = json?.normalization?.claim_graph || {};
  const finalText = finalCustomerText(json, options);
  const findings = [];

  for (const edge of asArray(graph.relationships)) {
    if (!CORRECTION_EDGE_TYPES.has(edge?.type)) continue;
    const correction = claimById(graph, edge.from);
    const prior = claimById(graph, edge.to);
    if (!correction) continue;

    const correctionAdopted = claimAdoptedInFinal(correction, finalText);
    const priorStillSelected = claimAdoptedInFinal(prior, finalText) && !correctionAdopted;
    if (!correctionAdopted || priorStillSelected) {
      findings.push(createFinding({
        invariant_code: "UNRESOLVED_EXPLICIT_CORRECTION",
        reason: `Explicit ${edge.type} correction remains unresolved for ${correction.field || "field"}.`,
        field: correction.field,
        candidate_ids: correctionCandidateIds(json, correction),
        evidence: {
          edge_type: edge.type,
          correction_field: correction.field || "",
          from_claim_id: edge.from,
          to_claim_id: edge.to,
          correction_evidence: correction.evidence || "",
          prior_evidence: prior?.evidence || "",
          correction_adopted: correctionAdopted,
          prior_still_selected: priorStillSelected,
        },
      }));
    }
  }

  return findings;
}

function evaluateConflictingSupportedCandidates(json) {
  const decisions = json?.normalization?.decisions || {};
  const findings = [];

  for (const [key, envelope] of Object.entries(decisions)) {
    if (!envelope || typeof envelope !== "object") continue;
    const field = envelope.field || key;
    if (!decisionFieldIsCritical(field)) continue;
    if (!conflictingSupportedCandidates(envelope)) continue;
    findings.push(createFinding({
      invariant_code: "CONFLICTING_SUPPORTED_CANDIDATES",
      reason: `Two or more supported candidates conflict on critical field ${field}.`,
      field,
      candidate_ids: asArray(envelope.candidates)
        .filter(supportedCandidate)
        .map((candidate) => candidate.id),
      evidence: {
        field,
        decision_key: key,
        resolution_status: envelope.resolution?.status || "",
        reason_code: envelope.resolution?.reasonCode || "",
        supported_candidate_ids: asArray(envelope.candidates)
          .filter(supportedCandidate)
          .map((candidate) => candidate.id),
      },
    }));
  }

  return findings;
}

function evaluateHighConfidencePriceUnresolved(json, options = []) {
  const sidecar = json?.normalization?.sidecar_price_reconciliation || {};
  const findings = [];
  const entries = [
    ...asArray(sidecar.sidecar_prices).map((entry) => ({ ...entry, _kind: "sidecar_price" })),
    ...asArray(sidecar.add_on_interpretations).map((entry) => ({
      ...entry,
      amount: entry.add_on_amount ?? entry.amount,
      amount_confidence: entry.amount_confidence,
      reason_code: entry.reason_code,
      candidate_status: entry.candidate_status,
      price_role: entry.price_role,
      _kind: "add_on_interpretation",
    })),
  ];

  for (const entry of entries) {
    if (!highConfidencePriceUnresolved(entry)) continue;
    if (priceWarningIsCoveredByResolvedScope(json, options)) continue;
    const amount = Number(entry.amount);
    findings.push(createFinding({
      invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
      reason: `High-confidence price ${Number.isFinite(amount) ? `$${Math.round(amount).toLocaleString("en-US")}` : "(unknown)"} has not been accepted, rejected, or explicitly reviewed.`,
      field: "service_options.prices",
      candidate_ids: [entry.candidate_id, entry.price_id].filter(Boolean),
      option_id: entry.option_id || "",
      evidence: {
        kind: entry._kind,
        amount: Number.isFinite(amount) ? Math.round(amount) : null,
        amount_confidence: entry.amount_confidence || "",
        pairing_confidence: entry.pairing_confidence || "",
        candidate_status: entry.candidate_status || "",
        reason_code: entry.reason_code || "",
        price_role: entry.price_role || "",
      },
    }));
  }

  for (const [index, option] of asArray(options).entries()) {
    const flags = option?.review_flags || {};
    if (!flags.add_on_interpretation_downgraded_to_warning) continue;
    if (priceWarningIsCoveredByResolvedScope(json, options)) continue;
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    findings.push(createFinding({
      invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
      reason: `${option.label || `Option ${index + 1}`} carries a high-confidence price warning that still needs explicit review.`,
      field: "service_options.prices",
      option_id: option.id || option.label || `Option ${index + 1}`,
      evidence: {
        kind: "option_warning_downgrade",
        option_label: option.label || "",
        amount: Number.isFinite(amount) ? Math.round(amount) : null,
        price_warning: flags.price_warning || "",
      },
    }));
  }

  return findings;
}

function evaluateAmbiguousMultiPriceReview(json, options = []) {
  const rawText = rawCustomerText(json);
  const priced = asArray(options).filter((option) => {
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    return Number.isFinite(amount) && amount > 0 && !option?.price?.is_unclear;
  });
  if (priced.length < 2) return [];

  const ambiguous = hasPriceAdjacentAmbiguity(rawText);
  if (!ambiguous) return [];
  return [createFinding({
    invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
    reason: "Multiple firm option prices were selected despite ambiguous source language; explicit review is required.",
    field: "service_options.prices",
    evidence: {
      kind: "ambiguous_multi_price",
      priced_option_count: priced.length,
      amounts: priced.map((option) => Math.round(Number(option.price.amount ?? option.price.min_amount))),
    },
  })];
}

function evaluateUnsupportedCustomerFacingValues(json, sourceFinalCoverage) {
  const findings = [];
  const results = asArray(sourceFinalCoverage?.results);

  for (const result of results) {
    if (!MATERIAL_SOURCE_FINAL_FACTS.has(result?.fact)) continue;
    if (!["missing", "changed"].includes(result?.status)) continue;
    if (hasReviewerValueApproval(json, result)) continue;

    findings.push(createFinding({
      invariant_code: "UNSUPPORTED_CUSTOMER_FACING_VALUE",
      reason: result.message ||
        `Final ${result.fact_label || result.fact} lacks source support and has no reviewer approval.`,
      field: result.fact,
      option_id: result.option_label || "",
      evidence: {
        option_label: result.option_label || "",
        fact: result.fact,
        status: result.status,
        source_value: result.source_value || "",
        final_value: result.final_value || "",
        code: result.code || "",
      },
    }));
  }

  return findings;
}

function evaluateInferredScopeAffectsPrice(json, options) {
  const findings = [];
  const hasRawContext = Boolean(rawCustomerText(json).trim());

  for (const [index, option] of asArray(options).entries()) {
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    const hasFirmPrice = Number.isFinite(amount) && amount > 0 && !option?.price?.is_unclear;
    if (!hasFirmPrice) continue;
    if (hasReviewerScopeApproval(json, option)) continue;

    const flags = option?.review_flags || {};
    const unclear = Boolean(
      option?.scope_unclear ||
      flags.scope_unclear ||
      /\bwork\s+scope\s+unclear\b|\bscope\s+unclear\b/i.test(`${option?.title || ""} ${option?.description || ""}`),
    );
    const inferred = Boolean(
      flags.inferred_from_higher_option ||
      (!hasRawContext && flags.inferred_base_only_scope) ||
      (!hasRawContext && flags.inferred_base_scope) ||
      ((flags.inferred_base_scope || flags.inferred_from_job_scope) && (
        unclear ||
        flags.scope_warning ||
        flags.price_warning
      )),
    );

    if (!inferred && !unclear) continue;

    findings.push(createFinding({
      invariant_code: "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
      reason: unclear
        ? `${option.label || `Option ${index + 1}`} has unclear scope that materially affects a firm price without reviewer approval.`
        : `${option.label || `Option ${index + 1}`} uses inferred scope that materially affects price without reviewer approval.`,
      field: "service_options.prices",
      option_id: option.id || option.label || `Option ${index + 1}`,
      evidence: {
        option_label: option.label || "",
        amount: Math.round(amount),
        inferred,
        unclear,
        inferred_from_job_scope: flags.inferred_from_job_scope || "",
        inferred_from_higher_option: flags.inferred_from_higher_option || "",
      },
    }));
  }

  return findings;
}

function evaluateSourceFactOmittedWithoutReason(sourceFinalCoverage) {
  const findings = [];

  for (const result of asArray(sourceFinalCoverage?.results)) {
    if (!MATERIAL_SOURCE_FINAL_FACTS.has(result?.fact)) continue;
    if (result?.status !== "missing") continue;
    if (result?.override_recorded) continue;
    if (!asArray(result?.missing_source_values).length && !result?.source_value) continue;

    findings.push(createFinding({
      invariant_code: "SOURCE_FACT_OMITTED_WITHOUT_REASON",
      reason: result.message ||
        `Final option omits explicit source fact ${result.fact_label || result.fact} without a recorded reason.`,
      field: result.fact,
      option_id: result.option_label || "",
      evidence: {
        option_label: result.option_label || "",
        fact: result.fact,
        missing_source_values: result.missing_source_values || [],
        source_value: result.source_value || "",
        code: result.code || "",
      },
    }));
  }

  return findings;
}

function evaluateFinalOptionStructure(structuralValidation = null) {
  const errors = asArray(
    structuralValidation?.structural_errors || structuralValidation?.final_blocking_errors,
  );
  return errors
    .filter((error) => PRICE_STRUCTURE_ERROR_CODES.has(asString(error?.code)))
    .map((error) => createFinding({
      invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
      reason: error.message || "Final option price relationship is not resolved.",
      field: "service_options.prices",
      candidate_ids: asArray(error.evidence_ids),
      evidence: {
        kind: "final_option_structure",
        structural_code: error.code,
        structural_message: error.message || "",
        evidence_ids: asArray(error.evidence_ids),
      },
    }));
}

function evidenceQuotesFromFieldEvidence(fieldEvidence = {}) {
  const quotes = [];
  for (const key of GENERATED_EVIDENCE_FIELD_KEYS) {
    const value = fieldEvidence[key];
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const quote = compactWhitespace(entry);
        if (quote) quotes.push({ field: key, quote });
      }
      continue;
    }
    if (typeof value === "object") {
      const quote = compactWhitespace(value.quote || value.evidence || value.value || value.display);
      if (quote) quotes.push({ field: key, quote });
      continue;
    }
    const quote = compactWhitespace(value);
    if (quote) quotes.push({ field: key, quote });
  }
  return quotes;
}

function evidenceQuotesFromClaims(graph = {}) {
  return asArray(graph.claims)
    .map((claim) => ({
      field: `claim:${claim.field || "unknown"}`,
      quote: compactWhitespace(claim.evidence),
      claim_id: claim.id || "",
    }))
    .filter((entry) => entry.quote);
}

function evidenceQuotesFromDecisions(decisions = {}) {
  const quotes = [];
  for (const [key, envelope] of Object.entries(decisions || {})) {
    for (const candidate of asArray(envelope?.candidates)) {
      for (const evidence of asArray(candidate?.evidence)) {
        const quote = compactWhitespace(evidence?.quote);
        if (!quote) continue;
        quotes.push({
          field: `decision:${envelope.field || key}`,
          quote,
          candidate_id: candidate.id || "",
        });
      }
    }
  }
  return quotes;
}

function looksLikeGeneratedSummary(quote, json = {}) {
  const generatedSummary = compactWhitespace(json?.job?.description);
  const needle = normalizeComparable(quote);
  if (!needle) return false;
  if (generatedSummary && needle === normalizeComparable(generatedSummary)) return true;
  return /^(?:tree service work as described|full service .+ with .+ and .+|options include)\b/i.test(
    compactWhitespace(quote),
  );
}

function isPhoneStrippedRawVariant(quote, rawText) {
  const rawWithoutPhones = asString(rawText)
    .replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return quoteFoundInRaw(quote, rawWithoutPhones);
}

function evaluateGeneratedStatementAsEvidence(json) {
  const rawText = rawCustomerText(json);
  const findings = [];
  const quotes = [
    ...evidenceQuotesFromFieldEvidence(json?.normalization?.field_evidence || {}),
    ...evidenceQuotesFromClaims(json?.normalization?.claim_graph || {}),
    ...evidenceQuotesFromDecisions(json?.normalization?.decisions || {}),
  ];

  const seen = new Set();
  for (const entry of quotes) {
    const key = `${entry.field}::${normalizeComparable(entry.quote)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (quoteFoundInRaw(entry.quote, rawText)) continue;
    if (isPhoneStrippedRawVariant(entry.quote, rawText)) continue;
    // Only flag when evidence is literally the generated customer-facing summary
    // (or a known generated template), not lightly normalized source text.
    if (!looksLikeGeneratedSummary(entry.quote, json)) continue;

    findings.push(createFinding({
      invariant_code: "GENERATED_STATEMENT_AS_EVIDENCE",
      reason: `Generated or normalized statement is being treated as evidence for ${entry.field}.`,
      field: entry.field,
      evidence: {
        field: entry.field,
        quote: entry.quote,
        claim_id: entry.claim_id || "",
        candidate_id: entry.candidate_id || "",
      },
    }));
  }

  return findings;
}

/**
 * Evaluate shadow readiness-safety invariants for an AlphaJSON payload.
 *
 * @param {object} params
 * @param {object} params.alphaJson
 * @param {object[]} [params.options]
 * @param {object} [params.sourceFinalCoverage]
 * @param {object} [params.structuralValidation]
 * @returns {{
 *   version: string,
 *   shadow_mode: boolean,
 *   would_block_pdf: boolean,
 *   enforced_findings: object[],
 *   shadow_findings: object[],
 *   invariant_codes: string[],
 *   findings: object[],
 *   invariants: object[],
 * }}
 */
export function evaluateReadinessSafety({
  alphaJson = {},
  options = null,
  sourceFinalCoverage = null,
  structuralValidation = null,
} = {}) {
  const json = alphaJson || {};
  const finalOptions = Array.isArray(options)
    ? options
    : asArray(json?.service_options?.items);
  const coverage = sourceFinalCoverage ||
    json?.validation?.source_final_fact_coverage ||
    {};

  const generatedFindings = [
    ...evaluateUnresolvedExplicitCorrection(json, finalOptions),
    ...evaluateConflictingSupportedCandidates(json),
    ...evaluateHighConfidencePriceUnresolved(json, finalOptions),
    ...evaluateAmbiguousMultiPriceReview(json, finalOptions),
    ...evaluateRawPriceAmbiguity(json, finalOptions),
    ...evaluateRawOptionScopeMismatch(json, finalOptions),
    ...evaluateIndependentAlternativeReview(json, finalOptions),
    ...evaluateUnsupportedCustomerFacingValues(json, coverage),
    ...evaluateOptionLocalSourceFidelity(coverage, finalOptions),
    ...evaluateInferredOptionCleanupSpecificity(json, finalOptions),
    ...evaluateOptionSpecificityIntroducedByAssembler(json, finalOptions),
    ...evaluateInferredScopeAffectsPrice(json, finalOptions),
    ...evaluateSourceFactOmittedWithoutReason(coverage),
    ...evaluateFinalOptionStructure(structuralValidation),
    ...evaluateGeneratedStatementAsEvidence(json),
  ];

  const findings = generatedFindings;
  const enforcedFindings = findings.filter((finding) => finding.enforceable !== false);
  const shadowFindings = findings.filter((finding) => finding.enforceable === false);
  const invariantCodes = [...new Set(findings.map((finding) => finding.invariant_code))];
  const invariants = READINESS_INVARIANT_CODES.map((code) => {
    const codeFindings = findings.filter((finding) => finding.invariant_code === code);
    return {
      code,
      would_block: codeFindings.length > 0,
      finding_count: codeFindings.length,
      findings: codeFindings,
    };
  });

  return {
    version: READINESS_SAFETY_VERSION,
    shadow_mode: true,
    would_block_pdf: findings.length > 0,
    would_block_enforced_pdf: enforcedFindings.length > 0,
    enforced_findings: enforcedFindings,
    shadow_findings: shadowFindings,
    invariant_codes: invariantCodes,
    findings,
    invariants,
  };
}
