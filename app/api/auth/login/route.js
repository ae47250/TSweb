import { readJson, json, requestIp } from "../../../../lib/api.js";
import {
  contractorAuthRequired,
  createContractorSession,
  setContractorSessionCookie,
  verifyContractorPassword,
} from "../../../../lib/contractorAuth.js";
import { checkRateLimit } from "../../../../lib/rateLimiter.js";

export const runtime = "nodejs";

export async function POST(request) {
  const limit = checkRateLimit(`contractor-login:${requestIp(request)}`);
  if (!limit.allowed) {
    return json({ error: "Too many sign-in attempts. Please try again later." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }
  if (contractorAuthRequired()) {
    const requestOrigin = String(request.headers.get("origin") || "").trim();
    if (requestOrigin !== new URL(request.url).origin) {
      return json({ error: "The sign-in request origin is invalid." }, { status: 403 });
    }
  }
  const body = await readJson(request);
  const username = String(body.username || "").trim();
  const expectedUsername = String(process.env.CONTRACTOR_USERNAME || "").trim();
  const passwordHash = String(process.env.CONTRACTOR_PASSWORD_SCRYPT_HASH || "").trim();
  const validPassword = await verifyContractorPassword(body.password, passwordHash);
  if (!expectedUsername || username !== expectedUsername || !validPassword) {
    return json({ error: "Invalid contractor credentials." }, { status: 401 });
  }
  const { token, session } = createContractorSession(username);
  const response = json({ authenticated: true, actorId: session.sub, csrfToken: session.csrf });
  return setContractorSessionCookie(response, token);
}
