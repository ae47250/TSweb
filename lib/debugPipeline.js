function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : "";
}

function optionSnapshot(alphaJson = {}) {
  return asArray(alphaJson?.service_options?.items || alphaJson?.options).map((option) => ({
    label: option?.label || option?.raw_label || "",
    title: option?.title || "",
    description: option?.description || option?.scope || option?.raw_text || "",
    price: option?.price || null,
    source: option?.source || "",
    sidecar_price_id: option?.sidecar_price_id || "",
  }));
}

function buildPriceReconciliationTrace(preReconciliationAlphaJson, alphaJson) {
  if (!preReconciliationAlphaJson) return null;

  const evidence = alphaJson?.normalization?.sidecar_price_reconciliation || {};
  const bundleCalculations = asArray(evidence.add_on_interpretations)
    .filter((item) => Number(item?.base_amount) && Number(item?.add_on_amount) && Number(item?.combined_amount))
    .map((item) => ({
      formula: `${money(item.base_amount)} + ${money(item.add_on_amount)} = ${money(item.combined_amount)}`,
      interpretation: item.interpretation || "",
      decision: item.decision || "",
      accepted: item.accepted ?? null,
      confidence: item.addon_interpretation_confidence || item.pairing_confidence || "",
      review_reason: item.review_reason || "",
    }));

  return {
    before_options: optionSnapshot(preReconciliationAlphaJson),
    bundle_calculations: bundleCalculations,
    after_options: optionSnapshot(alphaJson),
    validation_effects: {
      warnings: asArray(alphaJson?.validation?.price_reconciliation_warnings),
      blocking_errors: asArray(alphaJson?.validation?.price_reconciliation_blocking_errors),
      follow_ups: asArray(alphaJson?.validation?.price_reconciliation_follow_ups),
    },
    evidence,
  };
}

export function buildDebugPipelinePayload({
  enabled = false,
  rawTd1Text = "",
  rawOpenAiDraftJson = {},
  draftSchemaWarnings = [],
  preReconciliationAlphaJson = null,
  alphaJson = {},
  validation = {},
  mocked = false,
  note = "",
  error = "",
  textCleanupResult = null,
  contactNormalizationResult = null,
  optionPriceCandidateView = null,
  runtimeConfig = null,
} = {}) {
  if (!enabled) return {};

  const normalizedAlphaJson = preReconciliationAlphaJson || alphaJson;
  const corrections = normalizedAlphaJson?.normalization?.corrections_made || [];
  const uncertainties = normalizedAlphaJson?.normalization?.uncertainties
    || normalizedAlphaJson?.normalization?.uncertainty_flags
    || [];
  const lowConfidenceSpans = normalizedAlphaJson?.normalization?.low_confidence_spans || [];
  const numberTrace = normalizedAlphaJson?.normalization?.number_trace || [];
  const blockingErrors = validation.blocking_errors || [];
  const followUps = validation.follow_ups || [];
  const warnings = validation.warnings || [];
  const optionItems = normalizedAlphaJson?.service_options?.items || normalizedAlphaJson?.options || [];
  const optionCount = Array.isArray(optionItems) ? optionItems.length : 0;
  const priceReconciliation = buildPriceReconciliationTrace(preReconciliationAlphaJson, alphaJson);
  const reconciliationStage = priceReconciliation
    ? [{
        label: "Price reconciliation / option bundling",
        meaning: "A read-only trace shows the options and price evidence before and after reconciliation.",
        status: `${priceReconciliation.before_options.length} -> ${priceReconciliation.after_options.length} options, ${priceReconciliation.bundle_calculations.length} bundle calculations`,
      }]
    : [];
  const textCleanupChanges = Array.isArray(textCleanupResult?.changes) ? textCleanupResult.changes : [];
  const textCleanupWarnings = Array.isArray(textCleanupResult?.warnings) ? textCleanupResult.warnings : [];
  const textCleanupStage = textCleanupResult
    ? [{
        label: "TD1 text cleanup",
        meaning: "A conservative pre-AI readability pass cleaned only high-confidence text issues while preserving the raw input.",
        status: `${textCleanupChanges.length} safe changes, ${textCleanupWarnings.length} warnings`,
      }]
    : [];
  const contactStage = contactNormalizationResult
    ? [{
        label: "TD1 contact normalization",
        meaning: "A pre-AI contact pass ranked phone and email candidates without changing the raw note.",
        status: `${contactNormalizationResult.email?.candidates?.length || 0} email candidates, ${contactNormalizationResult.phone?.candidates?.length || 0} phone candidates`,
      }]
    : [];
  const optionPriceClues = optionPriceCandidateView?.pre_ai_option_price_candidate_clues || {};
  const optionPriceStage = optionPriceCandidateView
    ? [{
        label: "TD1 option/price clues",
        meaning: "A pre-AI option-price pass identified price candidates, option boundaries, excluded numbers, and ambiguity warnings.",
        status: `${optionPriceClues.money_like_numbers?.length || 0} money-like numbers, ${optionPriceClues.option_boundary_clues?.length || 0} option boundaries, ${optionPriceClues.price_scope_ambiguity_warnings?.length || 0} warnings`,
      }]
    : [];

  return {
    debugPipeline: {
      rawTd1Input: {
        customer_text: rawTd1Text,
      },
      ...(textCleanupResult
        ? {
            td1TextCleanup: {
              rawInput: textCleanupResult.rawInput,
              cleanedText: textCleanupResult.cleanedText,
              coherentNote: textCleanupResult.coherentNote,
              coherentNoteSource: textCleanupResult.coherentNoteSource || "",
              evidence: textCleanupResult.evidence || {},
              rewriteTrace: Array.isArray(textCleanupResult.rewriteTrace) ? textCleanupResult.rewriteTrace : [],
              changes: textCleanupChanges,
              warnings: textCleanupWarnings,
            },
          }
        : {}),
      ...(contactNormalizationResult
        ? { td1ContactNormalization: contactNormalizationResult }
        : {}),
      ...(optionPriceCandidateView
        ? { td1OptionPriceCandidateView: optionPriceCandidateView }
        : {}),
      rawOpenAiDraftJson,
      ...(runtimeConfig ? { runtimeConfig } : {}),
      ...(preReconciliationAlphaJson
        ? { prePriceReconciliationAlphaJson: preReconciliationAlphaJson }
        : {}),
      ...(priceReconciliation ? { priceReconciliation } : {}),
      cleanedCanonicalAlphaJson: alphaJson,
      validationResult: {
        can_generate_pdf: validation.can_generate_pdf,
        blocking_errors: blockingErrors,
        follow_ups: followUps,
        structured_follow_ups: validation.structured_follow_ups || [],
        warnings,
      },
      stages: [
        {
          label: "Raw TD1 input",
          meaning: "What the user typed before AI or cleanup touched it.",
          status: rawTd1Text ? "received" : "empty",
        },
        ...textCleanupStage,
        ...contactStage,
        ...optionPriceStage,
        {
          label: mocked ? "Local draft parser" : "OpenAI draft",
          meaning: mocked
            ? "The local simulator guessed fields without calling AI."
            : "The model converted messy text into draft JSON.",
          status: Object.keys(rawOpenAiDraftJson || {}).length ? "received" : "empty",
        },
        {
          label: "TD2 normalization",
          meaning: "Our code cleaned typos, rejected unsafe guesses, and shaped the data TD2 uses.",
          status: `${corrections.length} corrections, ${uncertainties.length} uncertainty flags, ${lowConfidenceSpans.length} low-confidence spans, ${numberTrace.length} number traces, ${optionCount} options`,
        },
        ...reconciliationStage,
        {
          label: "OpenAI route validation",
          meaning: "The OpenAI route validated its post-reconciliation AlphaJSON before the final /api/validate request.",
          status: validation.can_generate_pdf
            ? `ready with ${warnings.length} warnings`
            : `${blockingErrors.length} blockers, ${followUps.length} follow-ups`,
        },
      ],
      draftSchemaWarnings,
      source: mocked ? "local-draft-parser" : "openai",
      note: note || "",
      error: error || "",
    },
  };
}
