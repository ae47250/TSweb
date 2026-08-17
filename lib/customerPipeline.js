import { createHash } from "node:crypto";
import { finalOptionStructureEnforcementEnabled } from "./finalOptionStructureValidator.js";
import { buildCanonicalShadowEstimate, canonicalServiceAssemblerEnabled } from "./canonicalServiceAssembler.js";
import { buildCustomerEstimateView } from "./customerEstimateView.js";
import { readinessSafetyBlockingEnabled } from "./readinessReview.js";
import { validateAlphaJsonRoutePayload } from "./validateRoutePayload.js";
import { isStrictDeliveryStage } from "./productionReadiness.js";
import {
  buildCustomerPipelineTelemetry,
  emitCustomerPipelineTelemetry,
  publishCustomerPipelineTelemetry,
} from "./customerPipelineTelemetry.js";

export const CUSTOMER_PIPELINE_POLICY_VERSION = "customer-pipeline-policy-v2";
export const CUSTOMER_PIPELINE_MODES = Object.freeze(["off", "internal", "limited", "full"]);
export const CUSTOMER_RESOLUTION_ROLLOUT_FLAG = "CUSTOMER_RESOLUTION_ROLLOUT";
export const CUSTOMER_ASSEMBLER_ROLLOUT_FLAG = "CUSTOMER_ASSEMBLER_ROLLOUT";
export const CUSTOMER_RESOLUTION_RELEASE_APPROVED_FLAG = "CUSTOMER_RESOLUTION_RELEASE_APPROVED";
export const CUSTOMER_ASSEMBLER_RELEASE_APPROVED_FLAG = "CUSTOMER_ASSEMBLER_RELEASE_APPROVED";
export const CUSTOMER_DELIVERY_ENABLED_FLAG = "CUSTOMER_DELIVERY_ENABLED";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function stableBucket(value) {
  const hex = createHash("sha256").update(asString(value)).digest("hex").slice(0, 8);
  return (Number.parseInt(hex, 16) / 0xffffffff) * 100;
}

function normalizeMode(value) {
  const mode = asString(value).toLowerCase();
  return CUSTOMER_PIPELINE_MODES.includes(mode) ? mode : "off";
}

function parsePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function parseAllowlist(value) {
  return new Set(asString(value).split(",").map((item) => item.trim()).filter(Boolean));
}

function cohortDecision({ mode, allowlist, percent, documentId }) {
  const id = asString(documentId);
  const allowlisted = Boolean(id && allowlist.has(id));
  const bucket = id ? stableBucket(id) : null;
  const selected = mode === "full" || allowlisted || (mode === "limited" && bucket != null && bucket < percent);
  return {
    mode,
    allowlisted,
    bucket,
    percent,
    selected,
  };
}

function pipelineFlag(prefix, env, documentId) {
  const mode = normalizeMode(env[`${prefix}_ROLLOUT`]);
  return cohortDecision({
    mode,
    allowlist: parseAllowlist(env[`${prefix}_ALLOWLIST`]),
    percent: parsePercent(env[`${prefix}_PERCENT`]),
    documentId,
  });
}

function enabledFlag(value) {
  return String(value || "").toLowerCase() === "true";
}

function deploymentStage(env) {
  const stage = asString(env.TSWEB_DEPLOYMENT_STAGE).toLowerCase();
  if (["development", "staging", "production"].includes(stage)) return stage;
  return isStrictDeliveryStage(env) ? "unknown" : "development";
}

function pipelineActivationReason({ cohort, releaseApproved, requiresReadinessBlocking, readinessBlockingEnabled, prerequisites = true }) {
  if (!cohort.selected) return "cohort_not_selected";
  if (!releaseApproved) return "release_gate_not_approved";
  if (!prerequisites) return "assembler_prerequisite_missing";
  if (requiresReadinessBlocking && !readinessBlockingEnabled) return "readiness_blocking_required";
  return "enabled";
}

export function customerPipelinePolicy({ documentId = "", env = process.env } = {}) {
  const stage = deploymentStage(env);
  const resolutionReleaseApproved = enabledFlag(env[CUSTOMER_RESOLUTION_RELEASE_APPROVED_FLAG]);
  const assemblerReleaseApproved = enabledFlag(env[CUSTOMER_ASSEMBLER_RELEASE_APPROVED_FLAG]);
  const strictStageMisconfigured = isStrictDeliveryStage(env) && !["staging", "production"].includes(stage);
  const deliveryEnabled = !strictStageMisconfigured && (stage !== "production" || enabledFlag(env[CUSTOMER_DELIVERY_ENABLED_FLAG]));
  const readinessBlocking = readinessSafetyBlockingEnabled(env);
  const resolutionCohort = pipelineFlag("CUSTOMER_RESOLUTION", env, documentId);
  const assemblerCohort = pipelineFlag("CUSTOMER_ASSEMBLER", env, documentId);
  const assemblerPrerequisites = canonicalServiceAssemblerEnabled(env) && finalOptionStructureEnforcementEnabled(env);

  const resolutionReason = pipelineActivationReason({
    cohort: resolutionCohort,
    releaseApproved: resolutionReleaseApproved,
    requiresReadinessBlocking: resolutionCohort.mode !== "off",
    readinessBlockingEnabled: readinessBlocking,
  });
  const assemblerReason = pipelineActivationReason({
    cohort: assemblerCohort,
    releaseApproved: assemblerReleaseApproved,
    requiresReadinessBlocking: assemblerCohort.mode !== "off",
    readinessBlockingEnabled: readinessBlocking,
    prerequisites: assemblerPrerequisites,
  });
  const resolutionEnabled = resolutionReason === "enabled";
  const assemblerEnabled = assemblerReason === "enabled";
  const activePipeline = assemblerEnabled ? "assembler" : resolutionEnabled ? "resolution" : "legacy";
  const activeMode = assemblerEnabled
    ? assemblerCohort.mode
    : resolutionEnabled
      ? resolutionCohort.mode
      : "off";
  const deliveryBlocked = strictStageMisconfigured || (
    stage === "production" && (
      !deliveryEnabled ||
      activePipeline === "legacy" ||
      (resolutionCohort.selected && !resolutionEnabled) ||
      (assemblerCohort.selected && !assemblerEnabled)
    )
  );

  return {
    version: CUSTOMER_PIPELINE_POLICY_VERSION,
    document_id: asString(documentId),
    deployment_stage: stage,
    delivery_enabled: deliveryEnabled,
    delivery_blocked: deliveryBlocked,
    readiness_blocking_enabled: readinessBlocking,
    active_pipeline: activePipeline,
    active_mode: activeMode,
    resolution: {
      ...resolutionCohort,
      release_approved: resolutionReleaseApproved,
      customer_facing_enabled: resolutionEnabled,
      activation_reason: resolutionReason,
    },
    assembler: {
      ...assemblerCohort,
      release_approved: assemblerReleaseApproved,
      customer_facing_enabled: assemblerEnabled,
      activation_reason: assemblerReason,
      prerequisites_met: assemblerPrerequisites,
    },
  };
}

function optionProjection(option = {}) {
  return {
    label: asString(option.label),
    title: asString(option.title),
    description: asString(option.description),
    amount: option?.price?.amount ?? option?.price?.min_amount ?? null,
    display: asString(option?.price?.display),
    relationship_type: asString(option?.canonical_option?.relationship_type || option?.canonical_service_item?.relationship_type),
  };
}

function semanticProjection(validation = {}) {
  const alphaJson = validation?.alphaJson || {};
  return {
    customer: {
      name: asString(alphaJson.customer?.name),
      phone: asString(alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary),
      email: asString(alphaJson.customer?.email),
      address: asString(alphaJson.job?.service_address?.display),
    },
    job: {
      description: asString(alphaJson.job?.description),
      tree_count: asString(alphaJson.job?.tree_details?.tree_count),
      tree_type: asString(alphaJson.job?.tree_details?.tree_type),
    },
    options: asArray(alphaJson.service_options?.items).map(optionProjection),
    can_generate_pdf: Boolean(validation.can_generate_pdf),
    blocking_codes: asArray(validation.blocking_errors).map((error) => asString(error).split(":", 1)[0]).sort(),
  };
}

function projectionDifferenceCodes(left = {}, right = {}) {
  const checks = [
    ["customer_name", left.customer?.name, right.customer?.name],
    ["customer_phone", left.customer?.phone, right.customer?.phone],
    ["customer_email", left.customer?.email, right.customer?.email],
    ["service_address", left.customer?.address, right.customer?.address],
    ["job_description", left.job?.description, right.job?.description],
    ["tree_count", left.job?.tree_count, right.job?.tree_count],
    ["tree_type", left.job?.tree_type, right.job?.tree_type],
    ["options", left.options, right.options],
    ["readiness", left.can_generate_pdf, right.can_generate_pdf],
    ["blocking_codes", left.blocking_codes, right.blocking_codes],
  ];
  return checks
    .filter(([, leftValue, rightValue]) => stableHash(leftValue) !== stableHash(rightValue))
    .map(([code]) => code);
}

function selectedResolutionIsSupported(envelope) {
  if (envelope?.resolution?.status !== "selected") return false;
  const selectedIds = new Set([
    envelope.resolution.selectedCandidateId,
    ...(asArray(envelope.resolution.selectedCandidateIds)),
  ].filter(Boolean));
  const selected = asArray(envelope.candidates).filter((candidate) => selectedIds.has(candidate.id));
  return selected.length > 0 && selected.every((candidate) => (
    candidate.status !== "quarantined" &&
    candidate.support !== "unsupported" &&
    asArray(candidate.evidence).length > 0
  ));
}

function resolutionDifferenceIsAttributed(validation = {}, differenceCodes = []) {
  const decisions = validation.alphaJson?.normalization?.decisions || {};
  const decisionForCode = {
    customer_phone: decisions.phone,
    customer_email: decisions.email,
    service_address: decisions.service_address,
    tree_count: decisions.tree_count,
    job_description: decisions.tree_count,
    options: decisions.prices,
  };
  const attributable = differenceCodes.filter((code) => code !== "blocking_codes" && code !== "readiness");
  return attributable.length > 0 && attributable.every((code) => selectedResolutionIsSupported(decisionForCode[code]));
}

function classifiedComparison(left, right, rightValidation) {
  const differenceCodes = projectionDifferenceCodes(left, right);
  let classification = "exact_match";
  if (differenceCodes.length) {
    if (!right.can_generate_pdf && left.can_generate_pdf && asArray(right.blocking_codes).length) {
      classification = "expected_safety_block";
    } else if (right.can_generate_pdf && resolutionDifferenceIsAttributed(rightValidation, differenceCodes)) {
      classification = "expected_correction";
    } else {
      classification = "unexpected_difference";
    }
  }
  return {
    classification,
    equal: differenceCodes.length === 0,
    difference_codes: differenceCodes,
  };
}

function parityFor(legacy, resolution, assembler) {
  const legacyProjection = semanticProjection(legacy);
  const resolutionProjection = semanticProjection(resolution);
  const assemblerProjection = assembler ? semanticProjection(assembler) : null;
  const resolutionComparison = classifiedComparison(legacyProjection, resolutionProjection, resolution);
  const assemblerComparison = assembler
    ? classifiedComparison(resolutionProjection, assemblerProjection, assembler)
    : null;
  return {
    equal: resolutionComparison.equal && (!assemblerComparison || assemblerComparison.equal),
    classification: resolutionComparison.classification,
    difference_codes: resolutionComparison.difference_codes,
    resolution: resolutionComparison,
    assembler: assemblerComparison,
    legacy_hash: stableHash(legacyProjection),
    resolution_hash: stableHash(resolutionProjection),
    assembler_hash: assembler ? stableHash(assemblerProjection) : "",
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function addPipelineBlockers(validation, blockers = []) {
  if (!validation?.alphaJson || !blockers.length) return validation;
  const alphaJson = validation.alphaJson;
  const blockingErrors = unique([...(validation.blocking_errors || []), ...blockers.map((blocker) => blocker.message)]);
  alphaJson.validation = {
    ...(alphaJson.validation || {}),
    blocking_errors: blockingErrors,
    missing_required_fields: blockingErrors,
    can_generate_pdf: false,
    customer_pipeline_blockers: blockers,
  };
  return {
    ...validation,
    can_generate_pdf: false,
    blocking_errors: blockingErrors,
    customer_pipeline_blockers: blockers,
  };
}

function activeValidation(policy, legacy, resolution, assembler) {
  if (policy.assembler.customer_facing_enabled && assembler) return assembler;
  if (policy.resolution.customer_facing_enabled) return resolution;
  return legacy;
}

function pipelineMetadata(policy, active, parity) {
  const alphaJson = active?.alphaJson || {};
  return {
    version: CUSTOMER_PIPELINE_POLICY_VERSION,
    active_pipeline: policy.active_pipeline,
    active_mode: policy.active_mode,
    resolution_enabled: policy.resolution.customer_facing_enabled,
    assembler_enabled: policy.assembler.customer_facing_enabled,
    assembler_shadowed: Boolean(policy.assembler.prerequisites_met),
    release_approved: policy.active_pipeline === "assembler"
      ? policy.assembler.release_approved
      : policy.resolution.release_approved,
    delivery_blocked: policy.delivery_blocked,
    parity,
    semantic_hash: alphaJson.validation?.estimate_semantic_hash || "",
    structural_hash: alphaJson.validation?.final_option_structural_hash || "",
  };
}

export function resolveCustomerPipeline(body = {}, {
  documentId = "",
  env = process.env,
  telemetry = true,
  reviewContext = {},
} = {}) {
  const startedAt = Date.now();
  const rawInput = body.customer_text || body.customerText || body.alphaJson?.raw_input?.customer_text || "";
  const requestedId = asString(documentId || body.documentId || body.alphaJson?.document?.number) || `raw-${stableHash(rawInput).slice(0, 16)}`;
  const policy = customerPipelinePolicy({ documentId: requestedId, env });
  const legacy = validateAlphaJsonRoutePayload(body, {
    enforceFieldResolution: false,
    applyAssembler: false,
    pipelineName: "legacy",
    env,
    reviewContext,
  });
  const resolution = validateAlphaJsonRoutePayload(body, {
    enforceFieldResolution: true,
    applyAssembler: false,
    enforceStructural: false,
    pipelineName: "resolution-shadow",
    env,
    reviewContext,
  });
  if (!legacy || !resolution) return null;

  let assembler = null;
  let assemblerSemanticValidation = null;
  if (policy.assembler.prerequisites_met) {
    const source = resolution;
    assembler = validateAlphaJsonRoutePayload({
      ...body,
      alphaJson: source.alphaJson,
    }, {
      enforceFieldResolution: true,
      applyAssembler: true,
      enforceStructural: true,
      pipelineName: "assembler",
      env,
      reviewContext,
    });
    if (!assembler?.alphaJson) return null;
    assemblerSemanticValidation = buildCanonicalShadowEstimate(source.alphaJson).semanticValidation;
    assembler.alphaJson.validation.canonical_service_semantic_validation = assemblerSemanticValidation;
    assembler.canonical_service_semantic_validation = assemblerSemanticValidation;
  }

  const parity = parityFor(legacy, resolution, assembler);
  let active = activeValidation(policy, legacy, resolution, assembler);
  const blockers = [];
  if (policy.delivery_blocked) {
    blockers.push({
      code: "CUSTOMER_DELIVERY_DISABLED",
      message: "Customer delivery is disabled until the production resolution pipeline is fully approved and enabled.",
    });
  }
  if (policy.assembler.customer_facing_enabled) {
    const model = active?.alphaJson?.validation?.canonical_option_model;
    if (model?.status === "blocked") {
      blockers.push({
        code: "ASSEMBLER_MODEL_BLOCKED",
        message: "Canonical service construction is unresolved and requires Tree Dude review before customer delivery.",
      });
    }
    if (asArray(active?.alphaJson?.validation?.structural_blocking_errors).length) {
      blockers.push({
        code: "STRUCTURAL_GATE_FAILED",
        message: "Final customer option structure must be resolved before customer delivery.",
      });
    }
    if (asArray(assemblerSemanticValidation?.structural_errors).length) {
      blockers.push({
        code: "CANONICAL_SEMANTIC_GATE_FAILED",
        message: "Canonical service semantics must be resolved before customer delivery.",
      });
    }
  }
  active = addPipelineBlockers(active, blockers);
  const metadata = pipelineMetadata(policy, active, parity);
  active.alphaJson.validation.customer_pipeline = metadata;
  const customerView = buildCustomerEstimateView(active.alphaJson);
  active.alphaJson.validation.customer_delivery_binding = customerView.binding;
  metadata.customer_delivery_binding = customerView.binding;

  if (telemetry) {
    const decisions = active.alphaJson.review?.readiness_decisions || active.alphaJson.review?.reviewer_decision_log || [];
    emitCustomerPipelineTelemetry(buildCustomerPipelineTelemetry({
      documentId: requestedId,
      policy,
      validation: active,
      parity,
      decisions,
      correctionApplied: decisions.length > 0,
      latencyMs: Date.now() - startedAt,
    }), env);
  }

  return {
    ...active,
    validation: active,
    alphaJson: active.alphaJson,
    policy,
    legacy,
    resolution,
    assembler,
    parity,
    pipeline: metadata,
    customerView,
  };
}

export function emitCustomerPipelineDelivery({
  documentId = "",
  policy = {},
  validation = {},
  parity = {},
  surface = "",
  outcome = "delivered",
  decisions = [],
  falseReadyEscape = false,
  env = process.env,
} = {}) {
  const payload = buildCustomerPipelineTelemetry({
    event: "customer_pipeline_delivery",
    documentId,
    policy,
    validation,
    parity,
    deliverySurface: surface,
    outcome,
    decisions,
    falseReadyEscape,
    correctionApplied: decisions.length > 0,
    env,
  });
  return publishCustomerPipelineTelemetry(payload, { env });
}
