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

  return {
    debugPipeline: {
      rawTd1Input: {
        customer_text: rawTd1Text,
      },
      rawOpenAiDraftJson,
      cleanedCanonicalAlphaJson: alphaJson,
      validationResult: {
        can_generate_pdf: validation.can_generate_pdf,
        blocking_errors: validation.blocking_errors || [],
        follow_ups: validation.follow_ups || [],
        structured_follow_ups: validation.structured_follow_ups || [],
        warnings: validation.warnings || [],
      },
      draftSchemaWarnings,
      source: mocked ? "local-draft-parser" : "openai",
      note: note || "",
      error: error || "",
    },
  };
}
