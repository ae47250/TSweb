import { readJson, json } from "../../../lib/api.js";
import { validateAlphaJson } from "../../../lib/validateJson.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const alphaJson = body.alphaJson || body.json;

  if (!alphaJson) {
    return json({ error: "No AlphaJSON payload was provided." }, { status: 400 });
  }

  return json(validateAlphaJson(alphaJson));
}
