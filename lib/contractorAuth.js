import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { isStrictDeliveryStage } from "./productionReadiness.js";

const scrypt = promisify(scryptCallback);

export const CONTRACTOR_SESSION_COOKIE = "tree_dude_session";
export const CONTRACTOR_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function configuredSecret(env) {
  return asString(env.CONTRACTOR_SESSION_SECRET);
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(request) {
  const values = new Map();
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    values.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return values;
}

function errorResponse(error, status) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function contractorAuthRequired(env = process.env) {
  return isStrictDeliveryStage(env);
}

export function createContractorSession(actorId, env = process.env, now = Date.now()) {
  const secret = configuredSecret(env);
  if (!secret) throw new Error("CONTRACTOR_SESSION_SECRET is required to create a contractor session.");
  const payload = {
    sub: asString(actorId),
    csrf: randomBytes(24).toString("base64url"),
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + CONTRACTOR_SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sign(encoded, secret)}`, session: payload };
}

export function verifyContractorSession(token, env = process.env, now = Date.now()) {
  const secret = configuredSecret(env);
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!secret || !encoded || !signature || extra || !safeEqual(signature, sign(encoded, secret))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!asString(payload.sub) || !asString(payload.csrf) || Number(payload.exp) <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyContractorPassword(password, encodedHash) {
  const [algorithm, salt, expected, extra] = String(encodedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected || extra) return false;
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (expectedBuffer.length !== 64) return false;
  const actual = await scrypt(String(password || ""), Buffer.from(salt, "base64url"), 64);
  return timingSafeEqual(actual, expectedBuffer);
}

export function setContractorSessionCookie(response, token) {
  response.cookies.set(CONTRACTOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: CONTRACTOR_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearContractorSessionCookie(response) {
  response.cookies.set(CONTRACTOR_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function requireContractorSession(request, { csrf = false, env = process.env } = {}) {
  if (!contractorAuthRequired(env)) {
    return { ok: true, session: { sub: "development_contractor", csrf: "development" } };
  }
  const session = verifyContractorSession(parseCookies(request).get(CONTRACTOR_SESSION_COOKIE), env);
  if (!session) {
    return { ok: false, response: errorResponse("Contractor authentication is required.", 401) };
  }
  if (csrf) {
    const requestOrigin = asString(request.headers.get("origin"));
    const expectedOrigin = new URL(request.url).origin;
    const csrfToken = asString(request.headers.get("x-csrf-token"));
    if (requestOrigin !== expectedOrigin || !safeEqual(csrfToken, session.csrf)) {
      return { ok: false, response: errorResponse("The contractor request failed CSRF validation.", 403) };
    }
  }
  return { ok: true, session };
}
