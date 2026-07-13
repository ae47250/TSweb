import { randomUUID } from "node:crypto";
import { normalizeToAlphaJsonV14 } from "../../../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";
import { readJson, json } from "../../../lib/api.js";
import { OPENAI_SYSTEM_PROMPT } from "../../../lib/openaiPrompt.js";
import { OPENAI_DRAFT_RESPONSE_FORMAT, parseOpenAiDraft } from "../../../lib/openaiDraftSchema.js";
import { openAiDraftToNormalizerInput } from "../../../lib/openaiDraftAdapter.js";
import { buildDebugPipelinePayload } from "../../../lib/debugPipeline.js";
import { normalizeContactFields } from "../../../lib/contactNormalizer.js";
import { applyContactNormalizationOverlay } from "../../../lib/contactNormalizationOverlay.js";
import { buildOptionPriceCandidateView } from "../../../lib/optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "../../../lib/priceReconciliation.js";
import {
  buildEvidenceBackedTextCleanupResult,
  buildPreNormalizerParserInput,
  textCleanupNormalizer,
} from "../../../lib/textCleanupNormalizer.js";

export const runtime = "nodejs";

const ALLOWED_REASONING_EFFORTS = new Set(["low", "medium", "high"]);

function debugPipelineEnabled() {
  return process.env.DEBUG_PIPELINE === "true";
}

function td1PreNormalizersEnabled() {
  return process.env.ENABLE_TD1_PRE_NORMALIZERS === "true";
}

function td1PriceNormalizerEnabled(body = {}) {
  if (typeof body.enable_price_normalizer === "boolean") return body.enable_price_normalizer;
  if (typeof body.enablePriceNormalizer === "boolean") return body.enablePriceNormalizer;
  return process.env.ENABLE_TD1_PRICE_NORMALIZER !== "false";
}

function protectedContactSpans(contactNormalizationResult = {}) {
  return [
    ...((contactNormalizationResult?.phone?.candidates || [])
      .filter((candidate) => candidate.accepted && candidate.span)
      .map((candidate) => ({
        start: candidate.span.start,
        end: candidate.span.end,
        kind: "phone",
        raw: candidate.raw,
      }))),
    ...((contactNormalizationResult?.email?.candidates || [])
      .filter((candidate) => candidate.accepted && candidate.span)
      .map((candidate) => ({
        start: candidate.span.start,
        end: candidate.span.end,
        kind: "email",
        raw: candidate.raw,
      }))),
    ...((contactNormalizationResult?.address?.candidates || [])
      .filter((candidate) => candidate.accepted && candidate.span)
      .map((candidate) => ({
        start: candidate.span.start,
        end: candidate.span.end,
        kind: "address",
        raw: candidate.raw,
      }))),
  ];
}

function debugResponsePayload({
  rawTd1Text,
  rawOpenAiDraftJson,
  draftSchemaWarnings = [],
  alphaJson,
  validation,
  mocked,
  note,
  error,
  textCleanupResult,
  contactNormalizationResult,
  optionPriceCandidateView,
}) {
  return buildDebugPipelinePayload({
    enabled: debugPipelineEnabled(),
    rawTd1Text,
    rawOpenAiDraftJson,
    draftSchemaWarnings,
    alphaJson,
    validation,
    mocked,
    note,
    error,
    textCleanupResult,
    contactNormalizationResult,
    optionPriceCandidateView,
  });
}

function getReasoningEffort(model) {
  const effort = (process.env.OPENAI_REASONING_EFFORT || "").trim().toLowerCase();
  const modelSupportsReasoningEffort = /^(gpt-5|o\d)/i.test(model);

  if (!modelSupportsReasoningEffort || !ALLOWED_REASONING_EFFORTS.has(effort)) {
    return null;
  }

  return effort;
}

function caseIdFromBody(body) {
  return String(body.case_id || body.caseId || randomUUID()).trim();
}

function tokenUsageFromResponse(response) {
  const usage = response?.usage || {};
  return {
    input_tokens: usage.prompt_tokens ?? null,
    output_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
  };
}

function logOpenAiCase({ level = "info", caseId, model, reasoningEffort, usage, outcome, errorMessage = "" }) {
  const payload = {
    event: "openai_case_result",
    case_id: caseId,
    model,
    reasoning_effort: reasoningEffort || null,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    total_tokens: usage?.total_tokens ?? null,
    parse_block_outcome: outcome,
    error_message: errorMessage,
  };

  if (level === "error") {
    console.error(payload);
  } else {
    console.info(payload);
  }
}

export async function POST(request) {
  const body = await readJson(request);
  const customerText = body.customer_text || body.customerText || "";
  const intake = body.intake || body.structured_input || body.structuredInput || {};
  const caseId = caseIdFromBody(body);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-nano";
  const reasoningEffort = getReasoningEffort(model);

  if (!customerText || customerText.trim().length < 10) {
    return json({ error: "Please provide customer/job notes before creating AlphaJSON." }, { status: 400 });
  }

  const preNormalizersEnabled = td1PreNormalizersEnabled();
  const priceNormalizerEnabled = td1PriceNormalizerEnabled(body);
  const literalTextCleanupResult = preNormalizersEnabled ? textCleanupNormalizer(customerText) : null;
  const contactNormalizationResult = preNormalizersEnabled
    ? normalizeContactFields({ rawText: customerText, intake })
    : null;
  const optionPriceCandidateView = preNormalizersEnabled && priceNormalizerEnabled
    ? buildOptionPriceCandidateView(customerText, protectedContactSpans(contactNormalizationResult), {
        cleanedText: literalTextCleanupResult?.cleanedText,
      })
    : null;
  const textCleanupResult = preNormalizersEnabled
    ? buildEvidenceBackedTextCleanupResult({
        textCleanupResult: literalTextCleanupResult,
        contactNormalizationResult,
        optionPriceCandidateView,
      })
    : null;
  const parserCustomerText = preNormalizersEnabled
    ? buildPreNormalizerParserInput({
        textCleanupResult,
        contactNormalizationResult,
        optionPriceCandidateView,
      })
    : customerText;

  if (!process.env.OPENAI_API_KEY || process.env.MOCK_OPENAI_RESPONSES === "true") {
    const rawOpenAiDraftJson = {};
    const alphaJson = reconcileSidecarPrices(
      applyContactNormalizationOverlay(
        normalizeToAlphaJsonV14({}, customerText, intake),
        contactNormalizationResult,
      ),
      optionPriceCandidateView,
    );
    const validation = validateAlphaJson(alphaJson);
    logOpenAiCase({
      caseId,
      model: "local-draft-parser",
      reasoningEffort: null,
      usage: null,
      outcome: validation.can_generate_pdf ? "parse" : "block",
    });
    return json({
      alphaJson,
      mocked: true,
      note: "OPENAI_API_KEY is not configured, so a local draft parser was used.",
      ...debugResponsePayload({
        rawTd1Text: customerText || "",
        rawOpenAiDraftJson,
        alphaJson,
        validation,
        mocked: true,
        note: "OPENAI_API_KEY is not configured, so a local draft parser was used.",
        textCleanupResult,
        contactNormalizationResult,
        optionPriceCandidateView,
      }),
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      response_format: OPENAI_DRAFT_RESPONSE_FORMAT,
      messages: [
        {
          role: "system",
          content: OPENAI_SYSTEM_PROMPT,
        },
        { role: "user", content: parserCustomerText },
      ],
    });
    const rawOpenAiDraftJson = JSON.parse(response.choices[0]?.message?.content || "{}");
    const parsedDraft = parseOpenAiDraft(rawOpenAiDraftJson);
    const normalizerInput = openAiDraftToNormalizerInput(parsedDraft.draft, { rawInput: customerText, intake });
    const alphaJson = reconcileSidecarPrices(
      applyContactNormalizationOverlay(
        normalizeToAlphaJsonV14(normalizerInput, customerText, intake),
        contactNormalizationResult,
      ),
      optionPriceCandidateView,
    );
    const validation = validateAlphaJson(alphaJson);
    logOpenAiCase({
      caseId,
      model,
      reasoningEffort,
      usage: tokenUsageFromResponse(response),
      outcome: validation.can_generate_pdf ? "parse" : "block",
    });
    return json({
      alphaJson,
      mocked: false,
      ...debugResponsePayload({
        rawTd1Text: customerText || "",
        rawOpenAiDraftJson,
        draftSchemaWarnings: parsedDraft.warnings,
        alphaJson,
        validation,
        mocked: false,
        textCleanupResult,
        contactNormalizationResult,
        optionPriceCandidateView,
      }),
    });
  } catch (error) {
    const rawOpenAiDraftJson = {};
    const alphaJson = reconcileSidecarPrices(
      applyContactNormalizationOverlay(
        normalizeToAlphaJsonV14({}, customerText, intake),
        contactNormalizationResult,
      ),
      optionPriceCandidateView,
    );
    const validation = validateAlphaJson(alphaJson);
    logOpenAiCase({
      level: "error",
      caseId,
      model,
      reasoningEffort,
      usage: null,
      outcome: validation.can_generate_pdf ? "parse" : "block",
      errorMessage: error.message,
    });
    return json(
      {
        error: "OpenAI could not structure the notes. The safe local draft parser was used instead.",
        alphaJson,
        detail: error.message,
        ...debugResponsePayload({
          rawTd1Text: customerText || "",
          rawOpenAiDraftJson,
          alphaJson,
          validation,
          mocked: true,
          error: error.message,
          textCleanupResult,
          contactNormalizationResult,
          optionPriceCandidateView,
        }),
      },
      { status: 200 },
    );
  }
}
