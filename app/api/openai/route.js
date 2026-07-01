import { randomUUID } from "node:crypto";
import { normalizeToAlphaJsonV14 } from "../../../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";
import { readJson, json } from "../../../lib/api.js";
import { OPENAI_SYSTEM_PROMPT } from "../../../lib/openaiPrompt.js";

export const runtime = "nodejs";

const ALLOWED_REASONING_EFFORTS = new Set(["low", "medium", "high"]);

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
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const reasoningEffort = getReasoningEffort(model);

  if (!customerText || customerText.trim().length < 10) {
    return json({ error: "Please provide customer/job notes before creating AlphaJSON." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY || process.env.MOCK_OPENAI_RESPONSES === "true") {
    const alphaJson = normalizeToAlphaJsonV14({}, customerText, intake);
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
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: OPENAI_SYSTEM_PROMPT,
        },
        { role: "user", content: customerText },
      ],
    });
    const alphaJson = normalizeToAlphaJsonV14(JSON.parse(response.choices[0]?.message?.content || "{}"), customerText, intake);
    const validation = validateAlphaJson(alphaJson);
    logOpenAiCase({
      caseId,
      model,
      reasoningEffort,
      usage: tokenUsageFromResponse(response),
      outcome: validation.can_generate_pdf ? "parse" : "block",
    });
    return json({ alphaJson, mocked: false });
  } catch (error) {
    const alphaJson = normalizeToAlphaJsonV14({}, customerText, intake);
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
      },
      { status: 200 },
    );
  }
}
