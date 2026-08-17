import { json } from "../../../../lib/api.js";
import {
  clearContractorSessionCookie,
  requireContractorSession,
} from "../../../../lib/contractorAuth.js";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = requireContractorSession(request, { csrf: true });
  if (!auth.ok) return auth.response;
  return clearContractorSessionCookie(json({ authenticated: false }));
}
