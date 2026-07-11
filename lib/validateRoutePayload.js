import { createHash } from "node:crypto";
import { normalizeContactFields } from "./contactNormalizer.js";
import { normalizeToAlphaJsonV14 } from "./normalizeAlphaJson.js";
import { buildOptionPriceCandidateView } from "./optionPriceNormalizer.js";
import { reconcileSidecarPrices } from "./priceReconciliation.js";
import { stampServerVerifiedTdEditProvenance } from "./tdEditProvenance.js";
import { validateAlphaJson } from "./validateJson.js";

export const ROUTE_VALIDATION_EVIDENCE_VERSION = "route-validation-evidence-v2";
export const FINAL_OPTION_RENDER_BINDING_VERSION = "final-option-render-binding-v1";

const PRICE_RECONCILIATION_FIELDS = [
  "price_reconciliation_warnings",
  "price_reconciliation_blocking_errors",
  "price_reconciliation_follow_ups",
];

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function protectedContactSpans(contactNormalizationResult = {}) {
  return [
    ...asArray(contactNormalizationResult?.phone?.candidates)
      .filter((candidate) => candidate.accepted && candidate.span)
      .map((candidate) => ({
        start: candidate.span.start,
        end: candidate.span.end,
        kind: "phone",
        raw: candidate.raw,
      })),
    ...asArray(contactNormalizationResult?.email?.candidates)
      .filter((candidate) => candidate.accepted && candidate.span)
      .map((candidate) => ({
        start: candidate.span.start,
        end: candidate.span.end,
        kind: "email",
        raw: candidate.raw,
      })),
  ];
}

function clearClientRouteEvidence(normalized = {}) {
  normalized.normalization = { ...(normalized.normalization || {}) };
  delete normalized.normalization.sidecar_price_reconciliation;

  normalized.validation = { ...(normalized.validation || {}) };
  for (const field of PRICE_RECONCILIATION_FIELDS) {
    delete normalized.validation[field];
  }
  delete normalized.validation.final_option_render_binding;
  delete normalized.validation.final_option_render_binding_error;
}

function copyTrustedPriceReconciliationEvidence(target = {}, source = {}) {
  const sidecar = source?.normalization?.sidecar_price_reconciliation;
  if (sidecar) {
    target.normalization = {
      ...(target.normalization || {}),
      sidecar_price_reconciliation: structuredClone(sidecar),
    };
  }

  for (const field of PRICE_RECONCILIATION_FIELDS) {
    target.validation = { ...(target.validation || {}) };
    target.validation[field] = Array.isArray(source?.validation?.[field])
      ? structuredClone(source.validation[field])
      : [];
  }

  return target;
}

function priceClueCount(optionPriceCandidateView = {}) {
  return optionPriceCandidateView?.pre_ai_option_price_candidate_clues?.money_like_numbers?.length || 0;
}

export function applyTrustedRouteValidationEvidence(normalized = {}, {
  rawInput = "",
  intake = {},
} = {}) {
  clearClientRouteEvidence(normalized);

  const routeEvidence = {
    version: ROUTE_VALIDATION_EVIDENCE_VERSION,
    source: "server_recomputed_from_raw_input",
    trusted: false,
    raw_input_hash: stableHash(rawInput || ""),
    price_candidate_count: 0,
    sidecar_price_count: 0,
    sidecar_hash: "",
  };

  if (!compact(rawInput)) {
    normalized.normalization = {
      ...(normalized.normalization || {}),
      route_validation_evidence: {
        ...routeEvidence,
        reason: "missing_raw_input",
      },
    };
    return normalized;
  }

  try {
    const contactNormalizationResult = normalizeContactFields({ rawText: rawInput, intake });
    const optionPriceCandidateView = buildOptionPriceCandidateView(
      rawInput,
      protectedContactSpans(contactNormalizationResult),
    );
    const evidenceSource = reconcileSidecarPrices(cloneJson(normalized), optionPriceCandidateView);
    copyTrustedPriceReconciliationEvidence(normalized, evidenceSource);

    const sidecar = normalized.normalization?.sidecar_price_reconciliation || null;
    normalized.normalization.route_validation_evidence = {
      ...routeEvidence,
      trusted: true,
      price_candidate_count: priceClueCount(optionPriceCandidateView),
      sidecar_price_count: asArray(sidecar?.sidecar_prices).length,
      sidecar_hash: stableHash(sidecar),
    };
  } catch (error) {
    normalized.normalization = {
      ...(normalized.normalization || {}),
      route_validation_evidence: {
        ...routeEvidence,
        reason: "server_recompute_failed",
        error: error?.message || String(error),
      },
    };
  }

  return normalized;
}

export function preserveRouteValidationEvidence(normalized = {}, sourceAlphaJson = {}, context = {}) {
  return applyTrustedRouteValidationEvidence(normalized, {
    rawInput: context.rawInput || sourceAlphaJson?.raw_input?.customer_text || "",
    intake: context.intake || {},
  });
}

export function buildFinalOptionRenderBinding(alphaJson = {}) {
  const options = asArray(alphaJson.service_options?.items).map((option) => ({
    label: compact(option.label),
    title: compact(option.title),
    description: compact(option.description),
    amount: Number(option?.price?.amount ?? option?.price?.min_amount) || null,
    display: compact(option?.price?.display),
  }));
  return {
    version: FINAL_OPTION_RENDER_BINDING_VERSION,
    estimate_semantic_hash: alphaJson.validation?.estimate_semantic_hash || "",
    final_option_structural_hash: alphaJson.validation?.final_option_structural_hash || "",
    structural_error_codes: asArray(alphaJson.validation?.structural_error_codes),
    option_count: options.length,
    options_hash: stableHash(options),
  };
}

function structuralError(code, message) {
  return {
    code,
    message,
    field: "service_options.items",
    clearable_by: [
      "revalidate_current_estimate",
      "review_current_final_options",
    ],
  };
}

export function staleFinalOptionRenderBindingErrors(currentBinding = {}, sourceAlphaJson = {}) {
  const approvedBinding = sourceAlphaJson?.review?.approved_final_option_render_binding ||
    sourceAlphaJson?.validation?.approved_final_option_render_binding ||
    null;
  const approvedStructuralHash = sourceAlphaJson?.review?.approved_final_option_structural_hash ||
    sourceAlphaJson?.validation?.approved_final_option_structural_hash ||
    "";

  if (approvedBinding) {
    const approvedProjection = {
      estimate_semantic_hash: approvedBinding.estimate_semantic_hash || "",
      final_option_structural_hash: approvedBinding.final_option_structural_hash || "",
      options_hash: approvedBinding.options_hash || "",
    };
    const currentProjection = {
      estimate_semantic_hash: currentBinding.estimate_semantic_hash || "",
      final_option_structural_hash: currentBinding.final_option_structural_hash || "",
      options_hash: currentBinding.options_hash || "",
    };
    if (stableHash(approvedProjection) !== stableHash(currentProjection)) {
      return [structuralError(
        "STALE_STRUCTURAL_APPROVAL",
        "The final customer option structure changed after approval; review and approve the current options again.",
      )];
    }
  }

  if (approvedStructuralHash && approvedStructuralHash !== currentBinding.final_option_structural_hash) {
    return [structuralError(
      "STALE_STRUCTURAL_APPROVAL",
      "The final customer option structural hash changed after approval; review and approve the current options again.",
    )];
  }

  return [];
}

function applyRouteBlockingStructuralErrors(validation, errors = []) {
  if (!errors.length || !validation?.alphaJson) return validation;
  const alphaJson = validation.alphaJson;
  alphaJson.validation = { ...(alphaJson.validation || {}) };
  const structuralErrors = [
    ...asArray(alphaJson.validation.structural_errors),
    ...errors,
  ];
  const structuralErrorCodes = [...new Set([
    ...asArray(alphaJson.validation.structural_error_codes),
    ...errors.map((error) => error.code),
  ])].sort();
  const structuralBlockingErrors = [...new Set([
    ...asArray(alphaJson.validation.structural_blocking_errors),
    ...errors.map((error) => `${error.code}: ${error.message}`),
  ])];
  const blockingErrors = [...new Set([
    ...asArray(alphaJson.validation.blocking_errors),
    ...structuralBlockingErrors,
  ])];

  alphaJson.validation.structural_errors = structuralErrors;
  alphaJson.validation.structural_error_codes = structuralErrorCodes;
  alphaJson.validation.structural_blocking_errors = structuralBlockingErrors;
  alphaJson.validation.blocking_errors = blockingErrors;
  alphaJson.validation.missing_required_fields = blockingErrors;
  alphaJson.validation.can_generate_pdf = false;
  alphaJson.validation.final_option_render_binding_error = errors[0];

  validation.can_generate_pdf = false;
  validation.blocking_errors = blockingErrors;
  validation.structural_errors = structuralErrors;
  validation.structural_error_codes = structuralErrorCodes;
  validation.structural_blocking_errors = structuralBlockingErrors;
  return validation;
}

export function validateAlphaJsonRoutePayload(body = {}) {
  const alphaJson = body.alphaJson || body.json;
  if (!alphaJson) return null;

  const intake = body.intake || body.structured_input || body.structuredInput || {};
  const rawInput = body.customer_text || body.customerText || alphaJson?.raw_input?.customer_text || "";
  const normalized = normalizeToAlphaJsonV14(alphaJson, rawInput, intake);
  applyTrustedRouteValidationEvidence(normalized, { rawInput, intake });
  stampServerVerifiedTdEditProvenance(normalized, { sourceAlphaJson: alphaJson, rawInput, intake });

  const validation = validateAlphaJson(normalized);
  const binding = buildFinalOptionRenderBinding(validation.alphaJson);
  validation.alphaJson.validation.final_option_render_binding = binding;
  applyRouteBlockingStructuralErrors(validation, staleFinalOptionRenderBindingErrors(binding, alphaJson));

  return validation;
}
