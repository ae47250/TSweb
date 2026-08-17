function asString(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function enabled(value) {
  return asString(value).toLowerCase() === "true";
}

function configured(value) {
  return Boolean(asString(value));
}

const DEPLOYMENT_STAGES = Object.freeze(["development", "staging", "production"]);
const STRICT_DELIVERY_STAGES = Object.freeze(["staging", "production"]);

function deploymentStage(env) {
  return asString(env.TSWEB_DEPLOYMENT_STAGE).toLowerCase();
}

function nodeEnvironment(env) {
  return asString(env.NODE_ENV).toLowerCase();
}

function deploymentStageConfigurationError(env) {
  if (nodeEnvironment(env) !== "production") return null;
  const stage = deploymentStage(env);
  if (!stage) {
    return [
      false,
      "DEPLOYMENT_STAGE_MISSING",
      "TSWEB_DEPLOYMENT_STAGE is required when NODE_ENV=production; set it to development, staging, or production.",
    ];
  }
  if (!DEPLOYMENT_STAGES.includes(stage)) {
    return [
      false,
      "DEPLOYMENT_STAGE_INVALID",
      `TSWEB_DEPLOYMENT_STAGE must be development, staging, or production when NODE_ENV=production; received ${JSON.stringify(stage)}.`,
    ];
  }
  if (stage === "development") {
    return [
      false,
      "DEPLOYMENT_STAGE_NODE_ENV_CONFLICT",
      "TSWEB_DEPLOYMENT_STAGE=development cannot be used with NODE_ENV=production.",
    ];
  }
  return null;
}

function blobConfigured(env) {
  return configured(env.BLOB_READ_WRITE_TOKEN) ||
    (configured(env.BLOB_STORE_ID) && configured(env.VERCEL_OIDC_TOKEN));
}

export function isProductionStage(env = process.env) {
  return deploymentStage(env) === "production";
}

export function isStrictDeliveryStage(env = process.env) {
  return STRICT_DELIVERY_STAGES.includes(deploymentStage(env)) || nodeEnvironment(env) === "production";
}

export function openAiLocalFallbackAllowed(env = process.env) {
  return !isStrictDeliveryStage(env) && (
    !configured(env.OPENAI_API_KEY) ||
    asString(env.MOCK_OPENAI_RESPONSES).toLowerCase() === "true"
  );
}

export function productionConfigurationErrors(env = process.env) {
  if (!isStrictDeliveryStage(env)) return [];
  const stageConfigurationError = deploymentStageConfigurationError(env);
  const integrationChecks = [
    [configured(env.OPENAI_API_KEY), "OPENAI_API_KEY_MISSING", "OPENAI_API_KEY is required."],
    [asString(env.MOCK_OPENAI_RESPONSES).toLowerCase() === "false", "MOCK_OPENAI_RESPONSES_ENABLED", "MOCK_OPENAI_RESPONSES must be false."],
    [blobConfigured(env), "BLOB_STORAGE_NOT_CONFIGURED", "Private Vercel Blob storage must be configured."],
    [enabled(env.VERCEL_BLOB_ENABLED), "BLOB_STORAGE_FLAG_DISABLED", "VERCEL_BLOB_ENABLED must be true."],
    [asString(env.MOCK_NOTIFICATIONS).toLowerCase() === "false", "MOCK_NOTIFICATIONS_ENABLED", "MOCK_NOTIFICATIONS must be false."],
    [configured(env.PINGRAM_API_KEY), "PINGRAM_API_KEY_MISSING", "PINGRAM_API_KEY is required."],
    [configured(env.PINGRAM_FROM_EMAIL), "PINGRAM_FROM_EMAIL_MISSING", "PINGRAM_FROM_EMAIL is required."],
    [configured(env.PINGRAM_FROM_NUMBER), "PINGRAM_FROM_NUMBER_MISSING", "PINGRAM_FROM_NUMBER is required."],
    [configured(env.TREE_DUDE_EMAIL), "TREE_DUDE_EMAIL_MISSING", "TREE_DUDE_EMAIL is required."],
    [configured(env.TREE_DUDE_PHONE), "TREE_DUDE_PHONE_MISSING", "TREE_DUDE_PHONE is required."],
    [configured(env.CONTRACTOR_USERNAME), "CONTRACTOR_USERNAME_MISSING", "CONTRACTOR_USERNAME is required."],
    [configured(env.CONTRACTOR_PASSWORD_SCRYPT_HASH), "CONTRACTOR_PASSWORD_HASH_MISSING", "CONTRACTOR_PASSWORD_SCRYPT_HASH is required."],
    [asString(env.CONTRACTOR_SESSION_SECRET).length >= 32, "CONTRACTOR_SESSION_SECRET_WEAK", "CONTRACTOR_SESSION_SECRET must contain at least 32 characters."],
    [asString(env.CUSTOMER_LINK_SIGNING_SECRET).length >= 32, "CUSTOMER_LINK_SIGNING_SECRET_WEAK", "CUSTOMER_LINK_SIGNING_SECRET must contain at least 32 characters."],
    [configured(env.CUSTOMER_PIPELINE_TELEMETRY_URL), "TELEMETRY_URL_MISSING", "CUSTOMER_PIPELINE_TELEMETRY_URL is required."],
    [configured(env.CUSTOMER_PIPELINE_TELEMETRY_TOKEN), "TELEMETRY_TOKEN_MISSING", "CUSTOMER_PIPELINE_TELEMETRY_TOKEN is required."],
    [asString(env.CUSTOMER_PIPELINE_TELEMETRY_SALT).length >= 16, "TELEMETRY_SALT_WEAK", "CUSTOMER_PIPELINE_TELEMETRY_SALT must contain at least 16 characters."],
  ];
  const checks = [
    ...(stageConfigurationError ? [stageConfigurationError] : []),
    ...integrationChecks,
    [enabled(env.CUSTOMER_DELIVERY_ENABLED), "CUSTOMER_DELIVERY_NOT_ENABLED", "CUSTOMER_DELIVERY_ENABLED must be true."],
    [enabled(env.CUSTOMER_RESOLUTION_RELEASE_APPROVED), "RESOLUTION_RELEASE_NOT_APPROVED", "CUSTOMER_RESOLUTION_RELEASE_APPROVED must be true."],
    [enabled(env.ENABLE_READINESS_SAFETY_BLOCKING), "SAFETY_BLOCKING_DISABLED", "ENABLE_READINESS_SAFETY_BLOCKING must be true."],
    ...(isProductionStage(env)
      ? [[asString(env.CUSTOMER_RESOLUTION_ROLLOUT).toLowerCase() === "full", "RESOLUTION_ROLLOUT_NOT_FULL", "CUSTOMER_RESOLUTION_ROLLOUT must be full."]]
      : [[
        ["internal", "limited", "full"].includes(asString(env.CUSTOMER_RESOLUTION_ROLLOUT).toLowerCase()),
        "RESOLUTION_ROLLOUT_NOT_SELECTED",
        "Staging customer resolution rollout must be internal, limited, or full.",
      ]]),
  ];
  return checks
    .filter(([passes]) => !passes)
    .map(([, code, message]) => ({ code, message }));
}

export function assertProductionConfiguration(env = process.env) {
  const errors = productionConfigurationErrors(env);
  if (!errors.length) return;
  const error = new Error(`Production delivery configuration is incomplete: ${errors.map(({ code }) => code).join(", ")}.`);
  error.code = "PRODUCTION_CONFIGURATION_INCOMPLETE";
  error.configurationErrors = errors;
  throw error;
}
