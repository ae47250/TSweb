import { normalizeToAlphaJsonV14 } from "../../../lib/normalizeAlphaJson.js";
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

export async function POST(request) {
  const body = await readJson(request);
  const customerText = body.customer_text || body.customerText || "";

  if (!customerText || customerText.trim().length < 10) {
    return json({ error: "Please provide customer/job notes before creating AlphaJSON." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY || process.env.MOCK_OPENAI_RESPONSES === "true") {
    return json({
      alphaJson: normalizeToAlphaJsonV14({}, customerText),
      mocked: true,
      note: "OPENAI_API_KEY is not configured, so a local draft parser was used.",
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const reasoningEffort = getReasoningEffort(model);
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
    const alphaJson = normalizeToAlphaJsonV14(JSON.parse(response.choices[0]?.message?.content || "{}"), customerText);
    return json({ alphaJson, mocked: false });
  } catch (error) {
    return json(
      {
        error: "OpenAI could not structure the notes. The safe local draft parser was used instead.",
        alphaJson: normalizeToAlphaJsonV14({}, customerText),
        detail: error.message,
      },
      { status: 200 },
    );
  }
}
