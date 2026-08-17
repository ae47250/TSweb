#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContractorSession, verifyContractorSession } from "../lib/contractorAuth.js";
import { createCustomerAccessToken, verifyCustomerAccessToken } from "../lib/customerAccess.js";
import { customerPipelinePolicy } from "../lib/customerPipeline.js";
import { buildCustomerPipelineTelemetry } from "../lib/customerPipelineTelemetry.js";
import { productionConfigurationErrors } from "../lib/productionReadiness.js";

const RELEASE_POLICY_PATH = "config/customer-pipeline-release-policy.json";
const OBSERVABILITY_POLICY_PATH = "config/customer-pipeline-observability-policy.json";
const ENV_EXAMPLE_PATH = ".env.example";

const REQUIRED_ENV_KEYS = [
  "OPENAI_API_KEY",
  "MOCK_OPENAI_RESPONSES",
  "TSWEB_DEPLOYMENT_STAGE",
  "CUSTOMER_DELIVERY_ENABLED",
  "CUSTOMER_RESOLUTION_ROLLOUT",
  "CUSTOMER_RESOLUTION_RELEASE_APPROVED",
  "CUSTOMER_RESOLUTION_ALLOWLIST",
  "CUSTOMER_RESOLUTION_PERCENT",
  "CUSTOMER_ASSEMBLER_ROLLOUT",
  "CUSTOMER_ASSEMBLER_RELEASE_APPROVED",
  "CUSTOMER_ASSEMBLER_ALLOWLIST",
  "CUSTOMER_ASSEMBLER_PERCENT",
  "ENABLE_READINESS_SAFETY_BLOCKING",
  "ENABLE_CANONICAL_SERVICE_ASSEMBLER",
  "ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT",
  "CONTRACTOR_USERNAME",
  "CONTRACTOR_PASSWORD_SCRYPT_HASH",
  "CONTRACTOR_SESSION_SECRET",
  "CUSTOMER_LINK_SIGNING_SECRET",
  "CUSTOMER_LINK_TTL_SECONDS",
  "CUSTOMER_PIPELINE_TELEMETRY_URL",
  "CUSTOMER_PIPELINE_TELEMETRY_TOKEN",
  "CUSTOMER_PIPELINE_TELEMETRY_SALT",
  "PINGRAM_API_KEY",
  "PINGRAM_API_URL",
  "PINGRAM_FROM_NUMBER",
  "PINGRAM_FROM_EMAIL",
  "TREE_DUDE_PHONE",
  "TREE_DUDE_EMAIL",
  "MOCK_NOTIFICATIONS",
  "VERCEL_BLOB_ENABLED",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "VERCEL_OIDC_TOKEN",
];

const SURFACE_CONTRACTS = [
  {
    name: "customer estimate page",
    path: "app/e/[estimateId]/page.js",
    required: ["loadTrustedEstimateBoundary", "verifyCustomerAccessToken"],
  },
  {
    name: "stored document download",
    path: "app/api/estimates/[documentId]/pdf/[variant]/route.js",
    required: [
      "productionConfigurationErrors",
      "loadTrustedEstimateBoundary",
      "customerAccessTokenFromRequest",
      "verifyCustomerAccessToken",
      "stored_document_download",
    ],
  },
  {
    name: "customer signature",
    path: "app/api/upload/route.js",
    required: [
      "productionConfigurationErrors",
      "loadTrustedEstimateBoundary",
      "createDownloadFile",
      "saveSignedResult",
      "saveSignedPdf",
      "No acceptance status was recorded.",
    ],
  },
  {
    name: "manual acceptance",
    path: "app/api/manual-acceptance/route.js",
    required: [
      "productionConfigurationErrors",
      "loadTrustedEstimateBoundary",
      "createDownloadFile",
      "saveManualAcceptance",
      "saveAcceptedPdf",
      "No acceptance status was recorded.",
    ],
  },
  {
    name: "notifications",
    path: "app/api/notify/route.js",
    required: [
      "productionConfigurationErrors",
      "loadTrustedEstimateBoundary",
      "notifyCustomerEstimate",
      "notifyContractor",
      "customer_notification",
      "contractor_notification",
    ],
  },
  {
    name: "estimate persistence",
    path: "lib/estimateStore.js",
    required: [
      "if (strict && !hasBlobConfig()) throw",
      "read-after-write verification failed",
      "saved.localFileStorage = strict ? false",
    ],
  },
  {
    name: "PDF rendering",
    path: "lib/documentFiles.js",
    required: ["allowHtmlFallback = !isStrictDeliveryStage()", "PDF_RENDERING_REQUIRED"],
  },
  {
    name: "customer-link signing",
    path: "lib/customerAccess.js",
    required: ["createCustomerAccessToken", "verifyCustomerAccessToken", "payload.exp"],
  },
  {
    name: "contractor authentication",
    path: "lib/contractorAuth.js",
    required: ["httpOnly: true", "secure: true", 'sameSite: "strict"'],
  },
  {
    name: "structured telemetry",
    path: "lib/customerPipelineTelemetry.js",
    required: [
      "CUSTOMER_PIPELINE_TELEMETRY_URL",
      "Authorization",
      "CUSTOMER_PIPELINE_TELEMETRY_SALT",
      "customer-pipeline-telemetry-v2",
    ],
  },
];

function parseArgs(argv) {
  const stageIndex = argv.indexOf("--stage");
  const outputIndex = argv.indexOf("--output");
  const requestedStage = stageIndex >= 0 ? asString(argv[stageIndex + 1]).toLowerCase() : "";
  const inheritedStage = asString(process.env.TSWEB_DEPLOYMENT_STAGE).toLowerCase();
  const stage = requestedStage || (inheritedStage === "production" || inheritedStage === "staging" ? inheritedStage : "local");
  if (!["local", "staging", "production"].includes(stage)) {
    throw new Error("--stage must be local, staging, or production");
  }
  return {
    stage,
    live: argv.includes("--live"),
    check: argv.includes("--check"),
    output: outputIndex >= 0 ? asString(argv[outputIndex + 1]) : "",
    telemetryHealthUrl: valueAfter(argv, "--telemetry-health-url"),
    alertHealthUrl: valueAfter(argv, "--alert-health-url"),
  };
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? asString(argv[index + 1]) : "";
}

function asString(value) {
  return value == null ? "" : String(value).trim();
}

function isTrue(value) {
  return asString(value).toLowerCase() === "true";
}

function isFalse(value) {
  return asString(value).toLowerCase() === "false";
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function readText(path) {
  return readFileSync(resolve(path), "utf8");
}

function readEnvExample() {
  const values = {};
  const duplicates = [];
  for (const line of readText(ENV_EXAMPLE_PATH).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (Object.hasOwn(values, match[1])) duplicates.push(match[1]);
    values[match[1]] = match[2];
  }
  return { values, duplicates };
}

function addFailure(failures, message) {
  if (!failures.includes(message)) failures.push(message);
}

function checkEnvTemplate(failures, notes) {
  if (!existsSync(resolve(ENV_EXAMPLE_PATH))) {
    addFailure(failures, `${ENV_EXAMPLE_PATH} is missing`);
    return {};
  }
  const { values, duplicates } = readEnvExample();
  for (const key of duplicates) addFailure(failures, `${ENV_EXAMPLE_PATH} defines ${key} more than once`);
  for (const key of REQUIRED_ENV_KEYS) {
    if (!Object.hasOwn(values, key)) addFailure(failures, `${ENV_EXAMPLE_PATH} is missing ${key}`);
  }
  for (const [key, expected] of [
    ["CUSTOMER_ASSEMBLER_ROLLOUT", "off"],
    ["CUSTOMER_ASSEMBLER_RELEASE_APPROVED", "false"],
    ["ENABLE_CANONICAL_SERVICE_ASSEMBLER", "false"],
    ["ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT", "false"],
  ]) {
    if (asString(values[key]).toLowerCase() !== expected) {
      addFailure(failures, `${ENV_EXAMPLE_PATH} must keep ${key}=${expected}`);
    }
  }
  notes.push(`environment template: ${Object.keys(values).length} variables declared`);
  return values;
}

function checkPolicyFiles(failures, notes) {
  let releasePolicy;
  let observabilityPolicy;
  try {
    releasePolicy = readJson(RELEASE_POLICY_PATH);
    observabilityPolicy = readJson(OBSERVABILITY_POLICY_PATH);
  } catch (error) {
    addFailure(failures, `readiness policy could not be loaded: ${error.message}`);
    return { releasePolicy: {}, observabilityPolicy: {} };
  }

  const stress = releasePolicy.production_stress || {};
  if (Number(stress.maximum_false_blocks_600) > 6) {
    addFailure(failures, "production resolution false-block threshold exceeds 6/600");
  }
  if (Number(stress.maximum_unsafe_ready) !== 0) {
    addFailure(failures, "production resolution unsafe-ready threshold must be zero");
  }
  if (Number(releasePolicy.locked_baseline?.count) !== 60) {
    addFailure(failures, "locked production baseline must contain 60 case IDs");
  }
  if (releasePolicy.customer_rollout_default !== "off") {
    addFailure(failures, "customer pipeline rollout default must be off");
  }
  if (asString(releasePolicy.assembler_heldout_labels?.path) === "") {
    addFailure(failures, "assembler held-out label path is not configured");
  }
  if (Number(observabilityPolicy.minimum_event_count) < 1) {
    addFailure(failures, "observability policy must require at least one telemetry event");
  }
  if (asString(observabilityPolicy.required_event_version) === "") {
    addFailure(failures, "observability policy is missing its telemetry event version");
  }
  if (!Array.isArray(observabilityPolicy.required_event_fields) || !observabilityPolicy.required_event_fields.length) {
    addFailure(failures, "observability policy is missing required event fields");
  }
  notes.push(`release policy: ${releasePolicy.policy_version || "unversioned"}`);
  notes.push(`observability policy: ${observabilityPolicy.policy_version || "unversioned"}`);
  return { releasePolicy, observabilityPolicy };
}

function heldOutAssemblerState(policy) {
  const path = asString(policy.assembler_heldout_labels?.path);
  if (!path || !existsSync(resolve(path))) {
    return { available: false, reason: "held-out label file is missing" };
  }
  try {
    const manifest = readJson(path);
    const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
    const reviewersComplete = cases.every((row) => {
      const reviewerIds = new Set((Array.isArray(row?.reviews) ? row.reviews : [])
        .map((review) => asString(review?.reviewer_id))
        .filter(Boolean));
      return reviewerIds.size >= Number(policy.assembler_heldout_labels?.required_reviewers || 2) &&
        (!policy.assembler_heldout_labels?.require_adjudication || Boolean(row?.adjudication?.reviewer_id));
    });
    const checksumComplete = !policy.assembler_heldout_labels?.require_frozen_checksum ||
      /^[a-f0-9]{64}$/i.test(asString(manifest.frozen_sha256));
    const available = manifest.status === "frozen" &&
      cases.length >= Number(policy.assembler_heldout_labels?.minimum_cases || 0) &&
      reviewersComplete && checksumComplete;
    return { available, reason: available ? "frozen reviewed labels are present" : "held-out labels are incomplete" };
  } catch (error) {
    return { available: false, reason: `held-out label file is unreadable: ${error.message}` };
  }
}

function checkAssemblerDeferral(env, policy, failures, notes) {
  const rollout = asString(env.CUSTOMER_ASSEMBLER_ROLLOUT).toLowerCase() || "off";
  const approved = isTrue(env.CUSTOMER_ASSEMBLER_RELEASE_APPROVED);
  const builderEnabled = isTrue(env.ENABLE_CANONICAL_SERVICE_ASSEMBLER);
  const structureEnabled = isTrue(env.ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT);
  const heldOut = heldOutAssemblerState(policy);
  const invalidMode = !["off", "internal", "limited", "full"].includes(rollout);
  if (invalidMode) addFailure(failures, `CUSTOMER_ASSEMBLER_ROLLOUT has unsupported value ${rollout}`);
  if (!heldOut.available && (rollout !== "off" || approved || builderEnabled || structureEnabled)) {
    addFailure(failures, `assembler must remain disabled while ${heldOut.reason}`);
  }
  if (heldOut.available && rollout !== "off" && !approved) {
    addFailure(failures, "assembler rollout is selected without release approval");
  }
  notes.push(`assembler: ${heldOut.available ? "held-out evidence available" : `DEFERRED (${heldOut.reason})`}`);
}

function checkRuntimeConfiguration(stage, env, failures, notes) {
  if (stage === "production") {
    const errors = productionConfigurationErrors({ ...env, TSWEB_DEPLOYMENT_STAGE: "production" });
    for (const error of errors) addFailure(failures, `production configuration ${error.code}: ${error.message}`);
    if (asString(env.VERCEL_BLOB_ENABLED).toLowerCase() !== "true") {
      addFailure(failures, "VERCEL_BLOB_ENABLED must be true for the production preflight");
    }
    if (!/^scrypt\$[^$]+\$[A-Za-z0-9_-]{86}$/.test(asString(env.CONTRACTOR_PASSWORD_SCRYPT_HASH))) {
      addFailure(failures, "CONTRACTOR_PASSWORD_SCRYPT_HASH is not a complete scrypt hash");
    }
    for (const [name, value] of [
      ["PINGRAM_API_URL", env.PINGRAM_API_URL],
      ["CUSTOMER_PIPELINE_TELEMETRY_URL", env.CUSTOMER_PIPELINE_TELEMETRY_URL],
    ]) {
      try {
        const url = new URL(asString(value));
        if (url.protocol !== "https:") addFailure(failures, `${name} must use HTTPS in production`);
      } catch {
        addFailure(failures, `${name} must be a valid HTTPS URL in production`);
      }
    }
    const ttl = Number(env.CUSTOMER_LINK_TTL_SECONDS);
    if (!Number.isInteger(ttl) || ttl <= 0) addFailure(failures, "CUSTOMER_LINK_TTL_SECONDS must be a positive integer");
    notes.push("runtime configuration: production checks applied; live provider probes are separate");
    return;
  }

  if (stage === "staging") {
    const errors = productionConfigurationErrors({ ...env, TSWEB_DEPLOYMENT_STAGE: "staging" });
    for (const error of errors) addFailure(failures, `staging configuration ${error.code}: ${error.message}`);
    const mode = asString(env.CUSTOMER_RESOLUTION_ROLLOUT).toLowerCase();
    if (!isTrue(env.ENABLE_READINESS_SAFETY_BLOCKING)) {
      addFailure(failures, "staging canary requires ENABLE_READINESS_SAFETY_BLOCKING=true");
    }
    if (!isTrue(env.CUSTOMER_RESOLUTION_RELEASE_APPROVED)) {
      addFailure(failures, "staging canary requires CUSTOMER_RESOLUTION_RELEASE_APPROVED=true");
    }
    if (!["internal", "limited", "full"].includes(mode)) {
      addFailure(failures, "staging canary must select internal, limited, or full resolution rollout");
    }
    if (mode === "internal" && !asString(env.CUSTOMER_RESOLUTION_ALLOWLIST)) {
      addFailure(failures, "internal staging canary requires CUSTOMER_RESOLUTION_ALLOWLIST");
    }
    if (mode === "limited" && !asString(env.CUSTOMER_RESOLUTION_ALLOWLIST) && Number(env.CUSTOMER_RESOLUTION_PERCENT) <= 0) {
      addFailure(failures, "limited staging canary requires an allowlist or positive CUSTOMER_RESOLUTION_PERCENT");
    }
    if (!isFalse(env.MOCK_NOTIFICATIONS)) {
      addFailure(failures, "staging canary requires MOCK_NOTIFICATIONS=false with real notification credentials");
    }
    notes.push("runtime configuration: staging safety, approval, canary, and real-integration checks applied");
  }

  if (asString(env.CUSTOMER_RESOLUTION_ROLLOUT).toLowerCase() === "off" &&
      (asString(env.CUSTOMER_RESOLUTION_ALLOWLIST) || Number(env.CUSTOMER_RESOLUTION_PERCENT) > 0)) {
    addFailure(failures, "resolution rollout off must not retain an allowlist or positive cohort percentage");
  }
  if (asString(env.CUSTOMER_ASSEMBLER_ROLLOUT).toLowerCase() === "off" &&
      (asString(env.CUSTOMER_ASSEMBLER_ALLOWLIST) || Number(env.CUSTOMER_ASSEMBLER_PERCENT) > 0)) {
    addFailure(failures, "assembler rollout off must not retain an allowlist or positive cohort percentage");
  }
}

function checkSurfaceContracts(failures, notes) {
  for (const contract of SURFACE_CONTRACTS) {
    if (!existsSync(resolve(contract.path))) {
      addFailure(failures, `${contract.name} contract file is missing: ${contract.path}`);
      continue;
    }
    const source = readText(contract.path);
    for (const required of contract.required) {
      if (!source.includes(required)) addFailure(failures, `${contract.name} is missing required contract: ${required}`);
    }
  }
  notes.push(`delivery contracts: inspected ${SURFACE_CONTRACTS.length} trusted-boundary surfaces`);
}

function checkLocalRoundTrips(policy, failures, notes) {
  const secret = "preflight-customer-link-secret-32-bytes-long";
  const accessEnv = {
    TSWEB_DEPLOYMENT_STAGE: "production",
    CUSTOMER_LINK_SIGNING_SECRET: secret,
    CUSTOMER_LINK_TTL_SECONDS: "3600",
  };
  const token = createCustomerAccessToken("preflight-document", "version-a", accessEnv, 1_700_000_000_000);
  if (!verifyCustomerAccessToken(token, "preflight-document", "version-a", accessEnv, 1_700_000_100_000)) {
    addFailure(failures, "customer-link signing round trip did not verify");
  }
  if (verifyCustomerAccessToken(token, "other-document", "version-a", accessEnv, 1_700_100_000_000)) {
    addFailure(failures, "customer-link token was accepted for a different document");
  }
  if (verifyCustomerAccessToken(token, "preflight-document", "version-a", accessEnv, 1_700_004_000_000)) {
    addFailure(failures, "expired customer-link token was accepted");
  }

  const contractorEnv = {
    TSWEB_DEPLOYMENT_STAGE: "production",
    CONTRACTOR_SESSION_SECRET: "preflight-contractor-session-secret-32-bytes-long",
  };
  const session = createContractorSession("preflight-contractor", contractorEnv, 1_700_000_000_000);
  if (!verifyContractorSession(session.token, contractorEnv, 1_700_000_100_000)) {
    addFailure(failures, "contractor session round trip did not verify");
  }
  if (verifyContractorSession(session.token, contractorEnv, 1_700_030_000_000)) {
    addFailure(failures, "expired contractor session was accepted");
  }

  const observability = policy.observabilityPolicy || {};
  const telemetry = buildCustomerPipelineTelemetry({
    documentId: "preflight-document",
    policy: { active_mode: "limited", active_pipeline: "resolution", resolution: { customer_facing_enabled: true, release_approved: true }, readiness_blocking_enabled: true },
    validation: {
      blocking_errors: [],
      readiness_safety: { enforced_findings: [] },
      canonical_service_semantic_validation: { structural_errors: [] },
    },
    parity: { equal: true, classification: "exact_match", difference_codes: [] },
    deliverySurface: "preflight",
    env: { CUSTOMER_PIPELINE_TELEMETRY_SALT: "preflight-telemetry-salt-16" },
  });
  const telemetryKeys = new Set(Object.keys(telemetry));
  for (const field of observability.required_event_fields || []) {
    if (!telemetryKeys.has(field)) addFailure(failures, `telemetry preflight payload is missing ${field}`);
  }
  for (const forbidden of observability.forbidden_event_fields || []) {
    if (telemetryKeys.has(forbidden)) addFailure(failures, `telemetry preflight payload contains forbidden field ${forbidden}`);
  }
  notes.push("local round trips: customer links, contractor sessions, telemetry schema, and redaction checked");
}

function checkCanaryMatrix(failures, notes) {
  const canaryEnv = {
    TSWEB_DEPLOYMENT_STAGE: "staging",
    CUSTOMER_RESOLUTION_ROLLOUT: "internal",
    CUSTOMER_RESOLUTION_ALLOWLIST: "preflight-canary",
    CUSTOMER_RESOLUTION_RELEASE_APPROVED: "true",
    ENABLE_READINESS_SAFETY_BLOCKING: "true",
    CUSTOMER_ASSEMBLER_ROLLOUT: "off",
    CUSTOMER_ASSEMBLER_RELEASE_APPROVED: "false",
    ENABLE_CANONICAL_SERVICE_ASSEMBLER: "false",
    ENABLE_FINAL_OPTION_STRUCTURE_ENFORCEMENT: "false",
  };
  const selected = customerPipelinePolicy({ documentId: "preflight-canary", env: canaryEnv });
  const excluded = customerPipelinePolicy({ documentId: "preflight-excluded", env: canaryEnv });
  const rolledBack = customerPipelinePolicy({
    documentId: "preflight-canary",
    env: {
      ...canaryEnv,
      CUSTOMER_RESOLUTION_ROLLOUT: "off",
      CUSTOMER_RESOLUTION_ALLOWLIST: "",
      CUSTOMER_RESOLUTION_PERCENT: "0",
    },
  });
  if (selected.active_pipeline !== "resolution" || !selected.resolution.customer_facing_enabled) {
    addFailure(failures, "staging canary allowlist did not select the resolution pipeline");
  }
  if (excluded.active_pipeline !== "legacy") addFailure(failures, "staging canary excluded an unallowlisted document");
  if (rolledBack.active_pipeline !== "legacy") addFailure(failures, "staging canary rollback did not select legacy");
  notes.push("canary matrix: allowlisted selection, excluded document, and resolution rollback checked");
}

async function probeHealth(url, token = "") {
  try {
    const parsed = new URL(url);
    const response = await fetch(parsed, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.ok ? "PASS" : "FAIL", http_status: response.status, origin: parsed.origin };
  } catch (error) {
    return { status: "FAIL", reason: error?.name === "TimeoutError" ? "timeout" : "request_failed" };
  }
}

async function checkLiveEvidence(args, env, failures, notes) {
  if (!args.live) {
    if (args.stage === "production") {
      addFailure(failures, "production preflight requires --live with explicit telemetry and alert health URLs");
    }
    notes.push("live monitoring: not attempted; no deployed service or alert receiver is claimed");
    return { status: "NOT_ATTEMPTED" };
  }
  if (!args.telemetryHealthUrl || !args.alertHealthUrl) {
    addFailure(failures, "--live requires both --telemetry-health-url and --alert-health-url");
    return { status: "FAIL", telemetry: "not_configured", alerts: "not_configured" };
  }
  const telemetry = await probeHealth(args.telemetryHealthUrl, asString(env.CUSTOMER_PIPELINE_TELEMETRY_TOKEN));
  const alerts = await probeHealth(args.alertHealthUrl);
  if (telemetry.status !== "PASS") addFailure(failures, "telemetry health probe failed");
  if (alerts.status !== "PASS") addFailure(failures, "alert receiver health probe failed");
  notes.push("live monitoring: explicit read-only health probes were attempted");
  return { status: failures.length ? "FAIL" : "PASS", telemetry, alerts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env, TSWEB_DEPLOYMENT_STAGE: args.stage === "local" ? "development" : args.stage };
  const failures = [];
  const notes = [];
  const template = checkEnvTemplate(failures, notes);
  const policies = checkPolicyFiles(failures, notes);
  checkAssemblerDeferral(env, policies.releasePolicy, failures, notes);
  checkRuntimeConfiguration(args.stage, env, failures, notes);
  checkSurfaceContracts(failures, notes);
  checkLocalRoundTrips({ observabilityPolicy: policies.observabilityPolicy }, failures, notes);
  checkCanaryMatrix(failures, notes);
  const live = await checkLiveEvidence(args, env, failures, notes);
  const report = {
    report_version: "production-readiness-preflight-report-v1",
    generated_at: new Date().toISOString(),
    stage: args.stage,
    status: failures.length ? "FAIL" : "PASS",
    environment_template_variables: Object.keys(template).length,
    assembler: "held-out validation remains disabled unless independently reviewed evidence is complete",
    live,
    notes,
    failures,
  };
  if (args.output && !args.check) writeFileSync(resolve(args.output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Production readiness preflight (${args.stage}): ${report.status}`);
  for (const note of notes) console.log(`  ${note}`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  if (args.output) console.log(`  Report: ${args.output}${args.check ? " (not written in --check mode)" : ""}`);
  if (failures.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`Production readiness preflight failed closed: ${error?.stack || error}`);
  process.exitCode = 1;
}
