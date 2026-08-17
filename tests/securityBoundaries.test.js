import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import {
  CONTRACTOR_SESSION_COOKIE,
  contractorAuthRequired,
  createContractorSession,
  requireContractorSession,
  verifyContractorPassword,
  verifyContractorSession,
} from "../lib/contractorAuth.js";
import {
  createCustomerAccessToken,
  customerAccessRequired,
  verifyCustomerAccessToken,
} from "../lib/customerAccess.js";
import {
  isStrictDeliveryStage,
  openAiLocalFallbackAllowed,
  productionConfigurationErrors,
} from "../lib/productionReadiness.js";

const PRODUCTION_AUTH_ENV = {
  TSWEB_DEPLOYMENT_STAGE: "production",
  CONTRACTOR_SESSION_SECRET: "contractor-session-secret-that-is-long-enough",
};

function withEnvironment(overrides, callback) {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = String(value);
    }
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("contractor credentials use scrypt and sessions expire", async () => {
  const salt = randomBytes(16);
  const password = "a-long-production-password";
  const hash = `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 64).toString("base64url")}`;
  assert.equal(await verifyContractorPassword(password, hash), true);
  assert.equal(await verifyContractorPassword("wrong-password", hash), false);

  const now = Date.UTC(2026, 7, 13);
  const { token, session } = createContractorSession("reviewer@example.test", PRODUCTION_AUTH_ENV, now);
  assert.equal(verifyContractorSession(token, PRODUCTION_AUTH_ENV, now)?.sub, session.sub);
  assert.equal(verifyContractorSession(token, PRODUCTION_AUTH_ENV, now + (9 * 60 * 60 * 1000)), null);
});

test("contractor mutations require a same-origin CSRF token", () => {
  const { token, session } = createContractorSession("reviewer@example.test", PRODUCTION_AUTH_ENV);
  const request = new Request("https://app.example.test/api/pdf", {
    method: "POST",
    headers: {
      cookie: `${CONTRACTOR_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      origin: "https://app.example.test",
      "x-csrf-token": session.csrf,
    },
  });
  assert.equal(requireContractorSession(request, { csrf: true, env: PRODUCTION_AUTH_ENV }).ok, true);

  const crossOrigin = new Request("https://app.example.test/api/pdf", {
    method: "POST",
    headers: {
      cookie: `${CONTRACTOR_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      origin: "https://attacker.example",
      "x-csrf-token": session.csrf,
    },
  });
  const denied = requireContractorSession(crossOrigin, { csrf: true, env: PRODUCTION_AUTH_ENV });
  assert.equal(denied.ok, false);
  assert.equal(denied.response.status, 403);
});

test("customer capabilities are scoped to document, access version, and expiry", () => {
  const env = {
    TSWEB_DEPLOYMENT_STAGE: "production",
    CUSTOMER_LINK_SIGNING_SECRET: "customer-link-secret-that-is-long-enough",
    CUSTOMER_LINK_TTL_SECONDS: "60",
  };
  const now = Date.UTC(2026, 7, 13);
  const token = createCustomerAccessToken("EST-123", "version-1", env, now);
  assert.equal(verifyCustomerAccessToken(token, "EST-123", "version-1", env, now), true);
  assert.equal(verifyCustomerAccessToken(token, "EST-124", "version-1", env, now), false);
  assert.equal(verifyCustomerAccessToken(token, "EST-123", "version-2", env, now), false);
  assert.equal(verifyCustomerAccessToken(token, "EST-123", "version-1", env, now + 61_000), false);
});

test("production delivery preflight reports every missing safety dependency", () => {
  const errors = productionConfigurationErrors({ TSWEB_DEPLOYMENT_STAGE: "production" });
  const codes = new Set(errors.map(({ code }) => code));
  for (const expected of [
    "OPENAI_API_KEY_MISSING",
    "MOCK_OPENAI_RESPONSES_ENABLED",
    "CUSTOMER_DELIVERY_NOT_ENABLED",
    "RESOLUTION_RELEASE_NOT_APPROVED",
    "SAFETY_BLOCKING_DISABLED",
    "BLOB_STORAGE_NOT_CONFIGURED",
    "MOCK_NOTIFICATIONS_ENABLED",
    "CONTRACTOR_PASSWORD_HASH_MISSING",
    "CUSTOMER_LINK_SIGNING_SECRET_WEAK",
    "TELEMETRY_URL_MISSING",
  ]) {
    assert.equal(codes.has(expected), true, `${expected} must fail closed`);
  }
});

test("local OpenAI parser fallback is unavailable in strict delivery stages", () => {
  assert.equal(openAiLocalFallbackAllowed({
    TSWEB_DEPLOYMENT_STAGE: "development",
    OPENAI_API_KEY: "",
    MOCK_OPENAI_RESPONSES: "true",
  }), true);
  assert.equal(openAiLocalFallbackAllowed({
    TSWEB_DEPLOYMENT_STAGE: "staging",
    OPENAI_API_KEY: "",
    MOCK_OPENAI_RESPONSES: "true",
  }), false);
  assert.equal(openAiLocalFallbackAllowed({
    TSWEB_DEPLOYMENT_STAGE: "production",
    OPENAI_API_KEY: "staging-key",
    MOCK_OPENAI_RESPONSES: "false",
  }), false);
});

test("production NODE_ENV fails closed when the deployment stage is missing", () => {
  withEnvironment({ NODE_ENV: "production", TSWEB_DEPLOYMENT_STAGE: undefined }, () => {
    assert.equal(isStrictDeliveryStage(), true);
    assert.equal(openAiLocalFallbackAllowed(), false);
    assert.equal(contractorAuthRequired(), true);
    assert.equal(customerAccessRequired(), true);
    const codes = new Set(productionConfigurationErrors().map(({ code }) => code));
    assert.equal(codes.has("DEPLOYMENT_STAGE_MISSING"), true);
  });
});

test("production NODE_ENV fails closed when the deployment stage is unknown", () => {
  withEnvironment({ NODE_ENV: "production", TSWEB_DEPLOYMENT_STAGE: "prodction" }, () => {
    assert.equal(isStrictDeliveryStage(), true);
    assert.equal(openAiLocalFallbackAllowed(), false);
    assert.equal(contractorAuthRequired(), true);
    assert.equal(customerAccessRequired(), true);
    const errors = productionConfigurationErrors();
    assert.equal(errors.some(({ code }) => code === "DEPLOYMENT_STAGE_INVALID"), true);
    assert.match(errors.find(({ code }) => code === "DEPLOYMENT_STAGE_INVALID").message, /prodction/);
  });
});

test("explicit development and production stages retain their intended strictness", () => {
  const development = {
    NODE_ENV: "development",
    TSWEB_DEPLOYMENT_STAGE: "development",
    OPENAI_API_KEY: "",
    MOCK_OPENAI_RESPONSES: "true",
  };
  assert.equal(isStrictDeliveryStage(development), false);
  assert.equal(openAiLocalFallbackAllowed(development), true);
  assert.equal(contractorAuthRequired(development), false);
  assert.equal(customerAccessRequired(development), false);
  assert.deepEqual(productionConfigurationErrors(development), []);

  const conflictingProductionNodeMode = {
    NODE_ENV: "production",
    TSWEB_DEPLOYMENT_STAGE: "development",
    OPENAI_API_KEY: "configured",
    MOCK_OPENAI_RESPONSES: "false",
  };
  assert.equal(isStrictDeliveryStage(conflictingProductionNodeMode), true);
  assert.equal(openAiLocalFallbackAllowed(conflictingProductionNodeMode), false);
  assert.equal(contractorAuthRequired(conflictingProductionNodeMode), true);
  assert.equal(customerAccessRequired(conflictingProductionNodeMode), true);
  assert.equal(productionConfigurationErrors(conflictingProductionNodeMode).some(({ code }) => code === "DEPLOYMENT_STAGE_NODE_ENV_CONFLICT"), true);

  const production = {
    NODE_ENV: "production",
    TSWEB_DEPLOYMENT_STAGE: "production",
    OPENAI_API_KEY: "configured",
    MOCK_OPENAI_RESPONSES: "false",
  };
  assert.equal(isStrictDeliveryStage(production), true);
  assert.equal(openAiLocalFallbackAllowed(production), false);
  assert.equal(contractorAuthRequired(production), true);
  assert.equal(customerAccessRequired(production), true);
  assert.equal(productionConfigurationErrors(production).some(({ code }) => code.startsWith("DEPLOYMENT_STAGE_")), false);
});
