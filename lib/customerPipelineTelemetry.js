import { createHash } from "node:crypto";

export const CUSTOMER_PIPELINE_TELEMETRY_VERSION = "customer-pipeline-telemetry-v2";

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

function safeDocumentHash(documentId, env = process.env) {
  const id = asString(documentId);
  const salt = asString(env.CUSTOMER_PIPELINE_TELEMETRY_SALT);
  if (!id || !salt) return "";
  return createHash("sha256").update(`${salt}:${id}`).digest("hex").slice(0, 16);
}

function reasonCodeCounts(decisions = []) {
  return asArray(decisions).reduce((counts, decision) => {
    const reason = asString(decision?.reasonCode);
    if (reason) counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
}

function findingCodes(validation = {}) {
  return [...new Set(
    asArray(validation?.readiness_safety?.enforced_findings)
      .map((finding) => asString(finding?.invariant_code))
      .filter(Boolean),
  )].sort();
}

function blockedCodes(validation = {}) {
  return [...new Set(
    asArray(validation?.blocking_errors)
      .map((error) => {
        const text = asString(error);
        if (/^Readiness check \[/i.test(text)) return "READINESS_SAFETY";
        if (/price|quote|amount/i.test(text)) return "PRICE_VALIDATION";
        if (/address|location/i.test(text)) return "ADDRESS_VALIDATION";
        if (/phone|email|contact/i.test(text)) return "CONTACT_VALIDATION";
        if (/option|scope|service|structur/i.test(text)) return "OPTION_STRUCTURE";
        return "VALIDATION_BLOCK";
      })
      .filter(Boolean),
  )].sort();
}

function semanticErrorCodes(validation = {}) {
  return [...new Set(
    asArray(validation?.canonical_service_semantic_validation?.structural_errors)
      .map((error) => asString(error?.code))
      .filter(Boolean),
  )].sort();
}

export function buildCustomerPipelineTelemetry({
  event = "customer_pipeline_validation",
  documentId = "",
  policy = {},
  validation = {},
  parity = {},
  outcome = "validated",
  deliverySurface = "",
  latencyMs = null,
  falseReadyEscape = false,
  correctionApplied = false,
  decisions = [],
  env = process.env,
} = {}) {
  const eventPayload = {
    event,
    telemetry_version: CUSTOMER_PIPELINE_TELEMETRY_VERSION,
    document_hash: safeDocumentHash(documentId, env) || undefined,
    rollout_mode: policy?.active_mode || "off",
    active_pipeline: policy?.active_pipeline || "legacy",
    resolution_enabled: Boolean(policy?.resolution?.customer_facing_enabled),
    assembler_enabled: Boolean(policy?.assembler?.customer_facing_enabled),
    release_approved: Boolean(
      policy?.active_pipeline === "assembler"
        ? policy?.assembler?.release_approved
        : policy?.resolution?.release_approved,
    ),
    readiness_blocking_enabled: Boolean(policy?.readiness_blocking_enabled),
    delivery_surface: asString(deliverySurface) || undefined,
    outcome,
    blocking_count: asArray(validation?.blocking_errors).length,
    blocking_codes: blockedCodes(validation),
    safety_finding_count: asArray(validation?.readiness_safety?.enforced_findings).length,
    safety_invariant_codes: findingCodes(validation),
    semantic_error_count: asArray(validation?.canonical_service_semantic_validation?.structural_errors).length,
    semantic_error_codes: semanticErrorCodes(validation),
    reviewer_override_count: asArray(decisions).length,
    correction_eligible_count: asArray(decisions).length,
    correction_applied_count: correctionApplied ? asArray(decisions).length : 0,
    reviewer_reason_counts: reasonCodeCounts(decisions),
    parity_equal: Boolean(parity?.equal),
    parity_classification: asString(parity?.classification) || "not_evaluated",
    parity_difference_codes: asArray(parity?.difference_codes).map(asString).filter(Boolean),
    parity_difference_count: asArray(parity?.difference_codes).length,
    false_ready_escape: Boolean(falseReadyEscape),
    correction_applied: Boolean(correctionApplied),
    latency_ms: Number.isFinite(latencyMs) ? Math.round(latencyMs) : undefined,
    occurred_at: new Date().toISOString(),
  };

  return Object.fromEntries(Object.entries(eventPayload).filter(([, value]) => value !== undefined));
}

export function emitCustomerPipelineTelemetry(payload, env = process.env) {
  if (String(env.CUSTOMER_PIPELINE_TELEMETRY || "true").toLowerCase() === "false") return payload;
  try {
    console.info(JSON.stringify(payload));
  } catch {
    // Telemetry must never make customer delivery fail.
  }
  return payload;
}

export async function publishCustomerPipelineTelemetry(payload, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  emitCustomerPipelineTelemetry(payload, env);
  const endpoint = asString(env.CUSTOMER_PIPELINE_TELEMETRY_URL);
  const token = asString(env.CUSTOMER_PIPELINE_TELEMETRY_TOKEN);
  if (!endpoint) return { delivered: false, reason: "telemetry_endpoint_not_configured" };
  if (!token) return { delivered: false, reason: "telemetry_token_not_configured" };
  if (typeof fetchImpl !== "function") return { delivered: false, reason: "telemetry_fetch_unavailable" };

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { delivered: false, reason: `telemetry_http_${response.status}` };
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      reason: error?.name === "TimeoutError" ? "telemetry_timeout" : "telemetry_request_failed",
    };
  }
}
