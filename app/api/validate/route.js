import { readJson, json } from "../../../lib/api.js";
import { validateAlphaJsonRoutePayload } from "../../../lib/validateRoutePayload.js";
import { requireContractorSession } from "../../../lib/contractorAuth.js";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = requireContractorSession(request, { csrf: true });
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const validation = validateAlphaJsonRoutePayload(body, { reviewContext: { actorId: auth.session.sub } });
  if (!validation) {
    return json({ error: "No AlphaJSON payload was provided." }, { status: 400 });
  }

  return json(validation);
}
