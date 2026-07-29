import {
  ADDRESS_POLICY_VERSION,
  CONTACT_POLICY_VERSION,
  attachDecisionEnvelopes,
  createCandidate,
  createEnvelope,
  selectCandidate,
} from "./decisionEnvelope.js";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function mapContactSource(source) {
  if (source === "intake") return "structured_intake";
  if (source === "raw_labeled" || source === "raw_unlabeled") return "raw_notes";
  if (source === "model" || source === "openai_draft") return "model";
  if (source === "reviewer") return "reviewer";
  return "deterministic_rule";
}

function mapSupport(candidate = {}) {
  if (!candidate.valid) return "ambiguous";
  if (candidate.confidence === "low") return "ambiguous";
  if (candidate.raw && asString(candidate.value) && asString(candidate.raw) !== asString(candidate.value) && asString(candidate.raw) !== asString(candidate.display)) {
    return "normalized_explicit";
  }
  if (candidate.confidence === "medium") return "normalized_explicit";
  return "explicit";
}

function candidateId(fieldKey, candidate, index) {
  const digits = asString(candidate.value || candidate.display || candidate.raw).replace(/\W+/g, "").slice(0, 24);
  const source = asString(candidate.source) || "unknown";
  return `${fieldKey}_${source}_${digits || index}`;
}

function evidenceFromCandidate(candidate = {}) {
  const quote = asString(candidate.raw || candidate.display || candidate.value).trim();
  if (!quote) return [];
  const evidence = { quote };
  if (candidate.span && Number.isFinite(candidate.span.start) && Number.isFinite(candidate.span.end)) {
    evidence.start = candidate.span.start;
    evidence.end = candidate.span.end;
  }
  return [evidence];
}

function mapFieldCandidates(fieldKey, fieldResult = {}, valueKey = "value") {
  const candidates = Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [];
  return candidates.map((candidate, index) => {
    const value = valueKey === "display"
      ? (asString(candidate.display) || asString(candidate.value))
      : asString(candidate[valueKey] || candidate.value);
    const reasonCodes = [];
    if (candidate.rejected_reason) reasonCodes.push(asString(candidate.rejected_reason));
    if (candidate.confidence) reasonCodes.push(`confidence_${candidate.confidence}`);
    if (candidate.completeness) reasonCodes.push(`completeness_${candidate.completeness}`);
    if (candidate.source) reasonCodes.push(`source_${candidate.source}`);

    let status = "eligible";
    if (candidate.accepted) status = "selected";
    else if (!candidate.valid || candidate.rejected_reason) status = "rejected";

    return createCandidate({
      id: candidateId(fieldKey, candidate, index),
      value,
      source: mapContactSource(candidate.source),
      support: mapSupport(candidate),
      evidence: evidenceFromCandidate(candidate),
      status,
      reasonCodes,
    });
  });
}

function resolutionForField(fieldResult = {}, candidates = [], { resolvedBy, policyVersion }) {
  const accepted = (Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [])
    .find((candidate) => candidate.accepted);
  const selected = candidates.find((candidate) => candidate.status === "selected");
  const validDistinct = new Set(
    (Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [])
      .filter((candidate) => candidate.valid)
      .map((candidate) => asString(candidate.value || candidate.display).toLowerCase())
      .filter(Boolean),
  );
  const warnings = Array.isArray(fieldResult.warnings) ? fieldResult.warnings : [];

  if (!selected || !asString(fieldResult.value || selected.value)) {
    return {
      status: "unresolved",
      reasonCode: "insufficient_support",
      policyVersion,
      resolvedBy,
    };
  }

  if (warnings.some((warning) => /conflict|multiple|disagree/i.test(asString(warning))) || validDistinct.size > 1) {
    if (accepted?.source === "intake") {
      return {
        status: "selected",
        selectedCandidateId: selected.id,
        reasonCode: "structured_intake_preferred",
        policyVersion,
        resolvedBy,
      };
    }
    return {
      status: "selected",
      selectedCandidateId: selected.id,
      reasonCode: "conflicting_supported_candidates",
      policyVersion,
      resolvedBy,
    };
  }

  if (accepted?.source === "intake") {
    return {
      status: "selected",
      selectedCandidateId: selected.id,
      reasonCode: "structured_intake_preferred",
      policyVersion,
      resolvedBy,
    };
  }

  if (validDistinct.size === 1) {
    const duplicates = (Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [])
      .filter((candidate) => candidate.valid).length;
    return {
      status: "selected",
      selectedCandidateId: selected.id,
      reasonCode: duplicates > 1 ? "duplicate_equivalent_candidates" : "single_explicit_candidate",
      policyVersion,
      resolvedBy,
    };
  }

  return {
    status: "selected",
    selectedCandidateId: selected.id,
    reasonCode: "single_explicit_candidate",
    policyVersion,
    resolvedBy,
  };
}

export function buildPhoneDecisionEnvelope(contactNormalizationResult = {}) {
  const field = contactNormalizationResult.phone || {};
  let candidates = mapFieldCandidates("phone", field, "display");
  const accepted = (field.candidates || []).find((candidate) => candidate.accepted);
  if (accepted) {
    const id = candidates.find((candidate) =>
      candidate.source === mapContactSource(accepted.source) &&
      (candidate.value === accepted.display || candidate.value === accepted.value),
    )?.id;
    if (id) candidates = selectCandidate(candidates, id);
  }
  return createEnvelope({
    field: "customer.phone",
    candidates,
    resolution: resolutionForField(field, candidates, {
      resolvedBy: "contact_policy",
      policyVersion: CONTACT_POLICY_VERSION,
    }),
  });
}

export function buildEmailDecisionEnvelope(contactNormalizationResult = {}) {
  const field = contactNormalizationResult.email || {};
  let candidates = mapFieldCandidates("email", field, "value");
  const accepted = (field.candidates || []).find((candidate) => candidate.accepted);
  if (accepted) {
    const id = candidates.find((candidate) =>
      candidate.source === mapContactSource(accepted.source) &&
      candidate.value === accepted.value,
    )?.id;
    if (id) candidates = selectCandidate(candidates, id);
  }
  return createEnvelope({
    field: "customer.email",
    candidates,
    resolution: resolutionForField(field, candidates, {
      resolvedBy: "contact_policy",
      policyVersion: CONTACT_POLICY_VERSION,
    }),
  });
}

export function buildAddressDecisionEnvelope(contactNormalizationResult = {}) {
  const field = contactNormalizationResult.address || {};
  let candidates = mapFieldCandidates("address", field, "value");
  const accepted = (field.candidates || []).find((candidate) => candidate.accepted);
  if (accepted) {
    const id = candidates.find((candidate) =>
      candidate.source === mapContactSource(accepted.source) &&
      candidate.value === accepted.value,
    )?.id;
    if (id) candidates = selectCandidate(candidates, id);
  }
  return createEnvelope({
    field: "job.service_address",
    candidates,
    resolution: resolutionForField(field, candidates, {
      resolvedBy: "address_policy",
      policyVersion: ADDRESS_POLICY_VERSION,
    }),
  });
}

/**
 * Build contact decision envelopes from an existing contact normalizer result.
 * Does not change selection behavior.
 */
export function buildContactDecisionEnvelopes(contactNormalizationResult = null) {
  if (!contactNormalizationResult) return {};
  return {
    phone: buildPhoneDecisionEnvelope(contactNormalizationResult),
    email: buildEmailDecisionEnvelope(contactNormalizationResult),
    service_address: buildAddressDecisionEnvelope(contactNormalizationResult),
  };
}

export function attachContactDecisionEnvelopes(alphaJson = {}, contactNormalizationResult = null) {
  if (!contactNormalizationResult) return alphaJson;
  return attachDecisionEnvelopes(alphaJson, buildContactDecisionEnvelopes(contactNormalizationResult));
}
