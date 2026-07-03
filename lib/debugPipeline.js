export function buildDebugPipelinePayload({
  enabled = false,
  rawTd1Text = "",
  rawOpenAiDraftJson = {},
  draftSchemaWarnings = [],
  alphaJson = {},
  validation = {},
  mocked = false,
  note = "",
  error = "",
} = {}) {
  if (!enabled) return {};

  const corrections = alphaJson?.normalization?.corrections_made || [];
  const uncertainties = alphaJson?.normalization?.uncertainties
    || alphaJson?.normalization?.uncertainty_flags
    || [];
  const lowConfidenceSpans = alphaJson?.normalization?.low_confidence_spans || [];
  const numberTrace = alphaJson?.normalization?.number_trace || [];
  const blockingErrors = validation.blocking_errors || [];
  const followUps = validation.follow_ups || [];
  const warnings = validation.warnings || [];
  const optionItems = alphaJson?.service_options?.items || alphaJson?.options || [];
  const optionCount = Array.isArray(optionItems) ? optionItems.length : 0;

  return {
    debugPipeline: {
      rawTd1Input: {
        customer_text: rawTd1Text,
      },
      rawOpenAiDraftJson,
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
        {
          label: "TD2 validation",
          meaning: "Our code decided whether the estimate is ready or needs a follow-up.",
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
