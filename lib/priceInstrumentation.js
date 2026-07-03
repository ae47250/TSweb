const MONEY_PATTERN = /\$?\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*k|\d{3,6})\b/gi;
const PHONE_PATTERN = /\b(?:\d{3})[-.\s]?(?:\d{3})[-.\s]?(\d{4})\b/g;
const ADDRESS_PATTERN = /\b(\d{1,5})\s+[A-Z][A-Za-z0-9.]*\s+(?:St|Street|Road|Rd|Ave|Avenue|Lane|Ln|Drive|Dr|Court|Ct|Way|Pike|Trail|Trl|Highway|Hwy)\b/gi;
const PRICE_CONTEXT_PATTERN =
  /\b(?:price|prices|priced|quote|quoted|option|opt|bid|estimate|budget|cost|total|each|per|remove|removal|drop|cut|haul|hual|hawl|cleanup|clean\s*up|stump|grind|base|full|only|with|plus)\b/i;
const UNCERTAIN_CONTEXT_PATTERN =
  /\b(?:maybe|around|about|roughly|approx(?:\.|imately)?|ish|not\s+sure|could\s+be|if\s+needed|depending|depends|between|old\s+quote|not\s+final|unknown|blank|\?)\b/i;

export function normalizeMoney(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, "").trim();
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return `$${Math.round(Number(kMatch[1]) * 1000).toLocaleString("en-US")}`;
  const numeric = text.replace(/[^\d]/g, "");
  if (!numeric) return "";
  return `$${Number(numeric).toLocaleString("en-US")}`;
}

function sentenceAround(text, index) {
  const before = text.lastIndexOf(".", index);
  const after = text.indexOf(".", index);
  return text.slice(before < 0 ? 0 : before + 1, after < 0 ? text.length : after).trim();
}

function valueSet(matches, normalize) {
  return new Set(matches.map((match) => normalize(match)).filter(Boolean));
}

function phoneValues(text) {
  return valueSet([...String(text || "").matchAll(PHONE_PATTERN)], (match) => normalizeMoney(match[1]));
}

function addressValues(text) {
  return valueSet([...String(text || "").matchAll(ADDRESS_PATTERN)], (match) => normalizeMoney(match[1]));
}

function treeCountValues(text) {
  const values = new Set();
  for (const match of String(text || "").matchAll(/\b(\d{1,2})\s+(?:small\s+|large\s+|dead\s+)?(?:trees?|maples?|oaks?|pines?|cedars?|ashes?|walnuts?|elms?)\b/gi)) {
    values.add(normalizeMoney(match[1]));
  }
  return values;
}

export function extractRawPriceEvidence(rawInput = "") {
  const text = String(rawInput || "");
  const phoneCandidates = phoneValues(text);
  const addressCandidates = addressValues(text);
  const treeCountCandidates = treeCountValues(text);
  const evidence = [];

  for (const match of text.matchAll(MONEY_PATTERN)) {
    const raw = match[0];
    const display = normalizeMoney(raw);
    if (!display) continue;
    const start = match.index || 0;
    const end = start + raw.length;
    const context = sentenceAround(text, start);
    const excludedReason = phoneCandidates.has(display)
      ? "phone"
      : addressCandidates.has(display)
        ? "address"
        : treeCountCandidates.has(display)
          ? "tree_count"
          : "";
    const approximate = UNCERTAIN_CONTEXT_PATTERN.test(context);
    const supported = !excludedReason && PRICE_CONTEXT_PATTERN.test(context);

    evidence.push({
      value: display,
      raw,
      start,
      end,
      context,
      supported,
      approximate,
      excluded: Boolean(excludedReason),
      exclusion_reason: excludedReason,
    });
  }

  return evidence;
}

export function compactOptionPrices(alphaJson = {}) {
  return (alphaJson.service_options?.items || [])
    .map((option, index) => ({
      label: option.label || `Option ${String.fromCharCode(65 + index)}`,
      title: option.title || "",
      description: option.description || "",
      price_display: option.price?.display || "",
      price_amount: option.price?.amount ?? option.price?.min_amount ?? null,
      price_is_unclear: Boolean(option.price?.is_unclear),
    }))
    .filter((option) => option.price_display || option.price_amount != null || option.price_is_unclear);
}

export function compactModelOptions(rawJson = {}) {
  const source = rawJson?.alphaJson || rawJson || {};
  const directOptions = [
    ...(Array.isArray(source.options) ? source.options : []),
    ...(Array.isArray(source.service_options?.items) ? source.service_options.items : []),
    ...(Array.isArray(source.quote_options) ? source.quote_options : []),
  ];

  return directOptions.map((option, index) => {
    const price = option.price || {};
    return {
      label: option.label || option.raw_label || `Option ${String.fromCharCode(65 + index)}`,
      title: option.title || "",
      description: option.description || option.raw_text || "",
      price_display: option.price_display || option.display || option.price_raw || price.display || "",
      price_amount: option.price_amount ?? option.amount ?? price.amount ?? null,
      price_is_unclear: Boolean(option.price_is_unclear ?? option.is_unclear ?? price.is_unclear),
      evidence: option.evidence || option.price_evidence || "",
    };
  });
}

export function compactDisplayedOptions(options = []) {
  return (Array.isArray(options) ? options : []).map((option, index) => {
    const price = option.price || {};
    return {
      label: option.label || option.raw_label || `Option ${String.fromCharCode(65 + index)}`,
      title: option.title || "",
      description: option.description || option.raw_text || "",
      price_display: option.price_display || option.display || option.price_raw || price.display || "",
      price_amount: option.price_amount ?? option.amount ?? price.amount ?? null,
      price_is_unclear: Boolean(option.price_is_unclear ?? option.is_unclear ?? price.is_unclear),
      evidence: option.evidence || option.price_evidence || "",
    };
  });
}

function normalizedPriceSet(options) {
  return new Set(
    options
      .map((option) => normalizeMoney(option.price_display || option.price_amount))
      .filter(Boolean),
  );
}

function supportedExpectedPrices(expectedPrices, rawEvidence) {
  const supportedEvidence = rawEvidence.filter((item) => item.supported && !item.excluded);
  return expectedPrices.map((price) => {
    const value = normalizeMoney(price);
    const matches = supportedEvidence.filter((item) => item.value === value);
    return {
      expected_price: price,
      normalized_price: value,
      supported_by_raw_input: matches.length > 0,
      approximate: matches.some((item) => item.approximate),
      evidence_spans: matches,
    };
  });
}

function failureStages({ expectedSupport, rawEvidence, modelOptions, normalizedOptions, td2Options }) {
  const stages = [];
  const expectedSupported = expectedSupport.filter((item) => item.supported_by_raw_input).map((item) => item.normalized_price);
  const expectedUnsupported = expectedSupport.filter((item) => item.normalized_price && !item.supported_by_raw_input);
  const modelPrices = normalizedPriceSet(modelOptions);
  const normalizedPrices = normalizedPriceSet(normalizedOptions);
  const td2Prices = normalizedPriceSet(td2Options);
  const rawSupportedPrices = [...new Set(rawEvidence.filter((item) => item.supported && !item.excluded).map((item) => item.value))];
  const unsupportedTd2Prices = [...td2Prices].filter((price) => !rawSupportedPrices.includes(price));
  const finalizedApproximate = td2Options.some((option) => {
    const value = normalizeMoney(option.price_display || option.price_amount);
    return value && rawEvidence.some((item) => item.value === value && item.approximate) && !option.price_is_unclear;
  });

  if (expectedUnsupported.length) stages.push("raw_expected_unsupported");
  if (unsupportedTd2Prices.length) stages.push("unsupported_price_displayed");
  if (finalizedApproximate) stages.push("uncertain_price_finalized");

  for (const price of expectedSupported) {
    if (td2Prices.has(price)) continue;
    if (modelOptions.length && !modelPrices.has(price)) {
      stages.push("model_missed_raw_price");
    } else if (!normalizedPrices.has(price)) {
      stages.push(modelOptions.length ? "normalization_dropped_price" : "normalization_or_raw_parser_missed_price");
    } else {
      stages.push("td2_display_dropped_price");
    }
  }

  if (rawSupportedPrices.length >= 2 && td2Prices.size === 1) stages.push("raw_supported_price_missing_in_td2");

  const expectedSet = new Set(expectedSupported);
  if (
    expectedSupported.length &&
    expectedSupported.every((price) => td2Prices.has(price)) &&
    td2Prices.size === expectedSet.size &&
    td2Options.map((option) => normalizeMoney(option.price_display || option.price_amount)).filter(Boolean).join("|") !== expectedSupported.join("|")
  ) {
    stages.push("option_assignment_wrong");
  }

  return [...new Set(stages)];
}

export function buildPriceInstrumentation({
  rawInput = "",
  expectedPrices = [],
  alphaJsonBeforeNormalization = null,
  alphaJsonAfterNormalization = null,
  validation = {},
  dropdownActivationState = null,
  td2DisplayedOptions = null,
} = {}) {
  const rawEvidence = extractRawPriceEvidence(rawInput);
  const modelOptions = compactModelOptions(alphaJsonBeforeNormalization || {});
  const normalizedOptions = compactOptionPrices(alphaJsonAfterNormalization || {});
  const td2Options = Array.isArray(td2DisplayedOptions)
    ? compactDisplayedOptions(td2DisplayedOptions)
    : compactOptionPrices(validation.alphaJson || alphaJsonAfterNormalization || {});
  const expectedSupport = supportedExpectedPrices(expectedPrices, rawEvidence);
  const stages = failureStages({
    expectedSupport,
    rawEvidence,
    modelOptions,
    normalizedOptions,
    td2Options,
  });

  return {
    price_candidates_detected: rawEvidence.filter((item) => item.supported && !item.excluded),
    excluded_numbers: rawEvidence.filter((item) => item.excluded),
    price_evidence_spans: rawEvidence.filter((item) => item.supported && !item.excluded),
    expected_price_supported_by_raw_input: expectedSupport,
    model_quote_options: modelOptions,
    normalized_quote_options: normalizedOptions,
    td2_displayed_options: td2Options,
    alphaJson_before_normalization: alphaJsonBeforeNormalization || null,
    alphaJson_after_normalization: alphaJsonAfterNormalization || null,
    dropdown_activation_state: dropdownActivationState,
    readiness_state: validation.can_generate_pdf ? "ready" : "needs_more_info",
    price_failure_stages: stages,
    price_failure_stage: stages[0] || "price_evidence_matches_td2",
  };
}
