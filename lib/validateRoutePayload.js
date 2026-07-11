import { normalizeToAlphaJsonV14 } from "./normalizeAlphaJson.js";
import { stampServerVerifiedTdEditProvenance } from "./tdEditProvenance.js";
import { validateAlphaJson } from "./validateJson.js";

export function preserveRouteValidationEvidence(normalized = {}, sourceAlphaJson = {}) {
  const sidecar = sourceAlphaJson?.normalization?.sidecar_price_reconciliation;
  if (sidecar) {
    normalized.normalization = {
      ...(normalized.normalization || {}),
      sidecar_price_reconciliation: structuredClone(sidecar),
    };
  }

  const validationEvidenceFields = [
    "price_reconciliation_warnings",
    "price_reconciliation_blocking_errors",
    "price_reconciliation_follow_ups",
  ];
  for (const field of validationEvidenceFields) {
    if (!Array.isArray(sourceAlphaJson?.validation?.[field])) continue;
    normalized.validation = {
      ...(normalized.validation || {}),
      [field]: structuredClone(sourceAlphaJson.validation[field]),
    };
  }

  return normalized;
}

export function validateAlphaJsonRoutePayload(body = {}) {
  const alphaJson = body.alphaJson || body.json;
  if (!alphaJson) return null;

  const intake = body.intake || body.structured_input || body.structuredInput || {};
  const rawInput = body.customer_text || body.customerText || "";
  const normalized = normalizeToAlphaJsonV14(alphaJson, rawInput, intake);
  preserveRouteValidationEvidence(normalized, alphaJson);
  stampServerVerifiedTdEditProvenance(normalized, { sourceAlphaJson: alphaJson, rawInput, intake });

  return validateAlphaJson(normalized);
}
