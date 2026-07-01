import { readJson, json } from "../../../lib/api.js";
import { normalizeToAlphaJsonV14 } from "../../../lib/normalizeAlphaJson.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const alphaJson = body.alphaJson || body.json;
  const intake = body.intake || body.structured_input || body.structuredInput || {};

  if (!alphaJson) {
    return json({ error: "No AlphaJSON payload was provided." }, { status: 400 });
  }

  return json(validateAlphaJson(normalizeToAlphaJsonV14(alphaJson, body.customer_text || body.customerText || "", intake)));
}
