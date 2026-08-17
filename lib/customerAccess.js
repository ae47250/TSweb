import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isStrictDeliveryStage } from "./productionReadiness.js";

const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function asString(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function secretFor(env) {
  return asString(env.CUSTOMER_LINK_SIGNING_SECRET);
}

function sign(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function customerAccessRequired(env = process.env) {
  return isStrictDeliveryStage(env) || Boolean(secretFor(env));
}

export function newCustomerAccessVersion() {
  return randomBytes(18).toString("base64url");
}

export function createCustomerAccessToken(documentId, accessVersion, env = process.env, now = Date.now()) {
  const secret = secretFor(env);
  if (!secret) {
    if (customerAccessRequired(env)) throw new Error("CUSTOMER_LINK_SIGNING_SECRET is required for customer links.");
    return "";
  }
  const configuredTtl = Number(env.CUSTOMER_LINK_TTL_SECONDS || DEFAULT_TOKEN_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(configuredTtl) && configuredTtl > 0
    ? Math.floor(configuredTtl)
    : DEFAULT_TOKEN_TTL_SECONDS;
  const payload = {
    documentId: asString(documentId),
    accessVersion: asString(accessVersion),
    exp: Math.floor(now / 1000) + ttlSeconds,
  };
  if (!payload.documentId || !payload.accessVersion) throw new Error("Customer access token requires a document and access version.");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyCustomerAccessToken(token, documentId, accessVersion, env = process.env, now = Date.now()) {
  if (!customerAccessRequired(env)) return true;
  const secret = secretFor(env);
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!secret || !encoded || !signature || extra || !safeEqual(signature, sign(encoded, secret))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return asString(payload.documentId) === asString(documentId) &&
      asString(payload.accessVersion) === asString(accessVersion) &&
      Number(payload.exp) > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function customerAccessTokenFromRequest(request) {
  const authorization = asString(request.headers.get("authorization"));
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return new URL(request.url).searchParams.get("token") || "";
}
