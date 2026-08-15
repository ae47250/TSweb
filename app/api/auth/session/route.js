import { json } from "../../../../lib/api.js";
import { requireContractorSession } from "../../../../lib/contractorAuth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireContractorSession(request);
  if (!auth.ok) return auth.response;
  return json({ authenticated: true, actorId: auth.session.sub, csrfToken: auth.session.csrf });
}
