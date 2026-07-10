import { readJson, json } from "../../../lib/api.js";
import { validateAlphaJsonRoutePayload } from "../../../lib/validateRoutePayload.js";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await readJson(request);
  const validation = validateAlphaJsonRoutePayload(body);
  if (!validation) {
    return json({ error: "No AlphaJSON payload was provided." }, { status: 400 });
  }

  return json(validation);
}
