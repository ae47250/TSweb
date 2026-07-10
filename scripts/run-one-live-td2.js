import fs from "node:fs";
import OpenAI from "openai";
import { OPENAI_SYSTEM_PROMPT } from "../lib/openaiPrompt.js";
import { OPENAI_DRAFT_RESPONSE_FORMAT, parseOpenAiDraft } from "../lib/openaiDraftSchema.js";
import { openAiDraftToNormalizerInput } from "../lib/openaiDraftAdapter.js";
import { buildCustomerJobSummary, normalizeToAlphaJsonV14 } from "../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../lib/validateJson.js";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const rawInput = process.env.RAW_INPUT || process.argv.slice(2).join(" ");
if (!rawInput) {
  throw new Error("Provide RAW_INPUT or pass the customer note as arguments.");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not available.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.chat.completions.create({
  model: process.env.OPENAI_MODEL || "gpt-4.1-nano",
  response_format: OPENAI_DRAFT_RESPONSE_FORMAT,
  messages: [
    { role: "system", content: OPENAI_SYSTEM_PROMPT },
    { role: "user", content: rawInput },
  ],
});

const rawOpenAiDraftJson = JSON.parse(response.choices[0]?.message?.content || "{}");
const parsed = parseOpenAiDraft(rawOpenAiDraftJson);
const normalizerInput = openAiDraftToNormalizerInput(parsed.draft, { rawInput });
const alphaJson = normalizeToAlphaJsonV14(normalizerInput, rawInput);
const validation = validateAlphaJson(alphaJson);
const finalAlphaJson = validation.alphaJson || alphaJson;
const optionA = finalAlphaJson.service_options?.items?.[0] || {};

console.log(JSON.stringify({
  input: rawInput,
  model: response.model,
  usage: response.usage,
  raw_openai_draft_json: rawOpenAiDraftJson,
  td2: {
    can_generate_pdf: validation.can_generate_pdf,
    option_a_price: optionA.price?.display || "",
    option_a_title: optionA.title || "",
    option_a_explanation: optionA.description || "",
    job_notes: buildCustomerJobSummary(finalAlphaJson),
    tree_details: finalAlphaJson.job?.tree_details || {},
    blocking_errors: validation.blocking_errors || [],
    follow_ups: validation.follow_ups || [],
    warnings: validation.warnings || [],
  },
}, null, 2));
