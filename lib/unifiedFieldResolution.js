import {
  ADDRESS_POLICY_VERSION,
  CONTACT_POLICY_VERSION,
  PRICE_POLICY_VERSION,
  TREE_SCOPE_POLICY_VERSION,
  createEnvelope,
  createCandidate,
  selectCandidate,
} from "./decisionEnvelope.js";
import { isCompleteServiceAddress } from "./addressResolver.js";
import { normalizePhoneCandidate } from "./contactNormalizer.js";

export const FIELD_RESOLUTION_GATE_VERSION = "field_resolution@1";

const REASON_TEXT = Object.freeze({
  single_explicit_candidate: "Only one clear candidate was found.",
  explicit_correction: "A later explicit correction replaced the earlier value.",
  structured_intake_preferred: "The structured intake value was preferred over conflicting notes.",
  duplicate_equivalent_candidates: "Multiple sources gave the same value.",
  stronger_scope_pairing: "The price was selected because its scope pairing was supported.",
  conflicting_supported_candidates: "Multiple supported values conflict and need reviewer confirmation.",
  insufficient_support: "There is not enough supported evidence to choose a value.",
  reviewer_override: "A reviewer explicitly resolved this field.",
});

const SOURCE_PRIORITY = Object.freeze({
  reviewer: 0,
  structured_intake: 1,
  model: 2,
  raw_notes: 3,
  deterministic_rule: 4,
});

const FIELD_DEFINITIONS = Object.freeze([
  {
    key: "phone",
    label: "Customer phone",
    policyVersion: CONTACT_POLICY_VERSION,
  },
  {
    key: "service_address",
    label: "Service address",
    policyVersion: ADDRESS_POLICY_VERSION,
  },
  {
    key: "tree_count",
    label: "Tree count",
    policyVersion: TREE_SCOPE_POLICY_VERSION,
  },
  {
    key: "prices",
    label: "Price options",
    policyVersion: PRICE_POLICY_VERSION,
  },
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function reasonText(reasonCode) {
  return REASON_TEXT[reasonCode] || "The field resolution policy selected this result.";
}

function normalizedValue(fieldKey, value) {
  if (fieldKey === "phone") return asString(value).replace(/\D/g, "");
  if (fieldKey === "prices") return String(Number(value?.amount ?? value) || "");
  return asString(value)
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function candidateHasValue(candidate) {
  if (!candidate) return false;
  if (candidate.value && typeof candidate.value === "object") {
    return Number.isFinite(Number(candidate.value.amount)) && Number(candidate.value.amount) > 0;
  }
  return Boolean(asString(candidate.value).trim());
}

function candidateEvidenceStart(candidate) {
  const evidence = Array.isArray(candidate?.evidence) ? candidate.evidence[0] : null;
  return Number.isFinite(evidence?.start) ? Number(evidence.start) : Number.POSITIVE_INFINITY;
}

function usableCandidates(envelope) {
  return (Array.isArray(envelope?.candidates) ? envelope.candidates : [])
    .filter((candidate) => candidate && candidate.status !== "quarantined" && candidateHasValue(candidate));
}

function preferredCandidate(envelope, candidates) {
  const preferredId = asString(
    envelope?.resolution?.suggestedCandidateId || envelope?.resolution?.selectedCandidateId,
  );
  const preferred = candidates.find((candidate) => candidate.id === preferredId);
  if (preferred) return preferred;

  return [...candidates].sort((left, right) => {
    const sourceDifference = (SOURCE_PRIORITY[left.source] ?? 99) - (SOURCE_PRIORITY[right.source] ?? 99);
    if (sourceDifference) return sourceDifference;
    return candidateEvidenceStart(left) - candidateEvidenceStart(right);
  })[0] || null;
}

function resolutionFor(envelope, resolution, candidates) {
  const normalized = createEnvelope({
    field: envelope?.field,
    candidates,
    resolution: {
      ...(envelope?.resolution || {}),
      ...resolution,
      reasonText: reasonText(resolution.reasonCode || envelope?.resolution?.reasonCode),
    },
  });
  return {
    ...envelope,
    ...normalized,
  };
}

function scalarResolvedBy(fieldKey) {
  if (fieldKey === "service_address") return "address_policy";
  if (fieldKey === "tree_count") return "tree_scope_policy";
  return "contact_policy";
}

function evidenceForValue(rawInput, value) {
  const quote = asString(value).trim();
  if (!quote) return [];
  const start = asString(rawInput).toLowerCase().indexOf(quote.toLowerCase());
  return [{
    quote,
    ...(start >= 0 ? { start, end: start + quote.length } : {}),
  }];
}

function appendModelCandidate(envelope, fieldKey, value, rawInput) {
  if (!envelope || !asString(value).trim()) return envelope;
  const comparable = normalizedValue(fieldKey, value);
  const exists = (envelope.candidates || []).some((candidate) => (
    candidate.source === "model" && normalizedValue(fieldKey, candidate.value) === comparable
  ));
  if (exists) return envelope;

  const candidate = createCandidate({
    id: `${fieldKey}_model_${comparable || "value"}`.replace(/[^a-z0-9_]+/gi, "_").slice(0, 80),
    value,
    source: "model",
    support: "normalized_explicit",
    evidence: evidenceForValue(rawInput, value),
    status: "eligible",
    reasonCodes: ["model_candidate", "source_model"],
  });
  return {
    ...envelope,
    candidates: [...(envelope.candidates || []), candidate],
  };
}

/**
 * Preserve model-produced contact values as candidates before arbitration.
 * The model source marker is emitted only by the OpenAI draft adapter, so the
 * local raw-note parser does not accidentally manufacture a second source.
 */
export function attachModelFieldCandidates(alphaJson = {}, rawInput = "") {
  const fieldEvidence = alphaJson?.normalization?.field_evidence || {};
  const decisions = { ...(alphaJson?.normalization?.decisions || {}) };
  const phoneSource = asString(fieldEvidence.phone_source);
  const addressSource = asString(fieldEvidence.service_address_source);

  if (phoneSource === "openai_draft" || phoneSource === "model") {
    const modelPhone = asString(alphaJson?.customer?.phone_display || alphaJson?.customer?.phone_primary);
    if (modelPhone && decisions.phone) {
      const normalized = normalizePhoneCandidate(modelPhone);
      decisions.phone = appendModelCandidate(decisions.phone, "phone", normalized?.display || modelPhone, rawInput);
    }
  }

  if (addressSource === "openai_draft" || addressSource === "model") {
    const modelAddress = asString(alphaJson?.job?.service_address?.display || fieldEvidence.service_address);
    if (modelAddress && decisions.service_address) {
      decisions.service_address = appendModelCandidate(decisions.service_address, "service_address", modelAddress, rawInput);
    }
  }

  alphaJson.normalization = {
    ...(alphaJson.normalization || {}),
    decisions,
  };
  return alphaJson;
}

function resolveScalarEnvelope(envelope, fieldKey, policyVersion) {
  if (!envelope) return null;
  const candidates = usableCandidates(envelope);
  const originalResolution = envelope.resolution || {};
  const originalSelected = candidates.find((candidate) =>
    candidate.id === originalResolution.selectedCandidateId || candidate.id === originalResolution.suggestedCandidateId,
  );

  if (originalResolution.status === "abstained" && !originalSelected) {
    return resolutionFor(
      envelope,
      {
        status: "abstained",
        reasonCode: originalResolution.reasonCode || "insufficient_support",
        policyVersion,
        resolvedBy: originalResolution.resolvedBy || scalarResolvedBy(fieldKey),
      },
      envelope.candidates,
    );
  }

  if (originalResolution.resolvedBy === "reviewer" && originalSelected) {
    return resolutionFor(
      envelope,
      {
        status: "selected",
        selectedCandidateId: originalSelected.id,
        reasonCode: "reviewer_override",
        policyVersion,
        resolvedBy: "reviewer",
      },
      selectCandidate(envelope.candidates, originalSelected.id),
    );
  }

  if (originalResolution.reasonCode === "explicit_correction" && originalSelected) {
    return resolutionFor(
      envelope,
      {
        status: "selected",
        selectedCandidateId: originalSelected.id,
        reasonCode: "explicit_correction",
        policyVersion,
        resolvedBy: originalResolution.resolvedBy || "deterministic_rule",
      },
      selectCandidate(envelope.candidates, originalSelected.id),
    );
  }

  if (!candidates.length) {
    return resolutionFor(
      envelope,
      {
        status: originalResolution.status === "abstained" ? "abstained" : "unresolved",
        reasonCode: "insufficient_support",
        policyVersion,
        resolvedBy: originalResolution.resolvedBy || "deterministic_rule",
      },
      envelope.candidates,
    );
  }

  const groups = new Map();
  for (const candidate of candidates) {
    const key = normalizedValue(fieldKey, candidate.value);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  }
  const structuredGroups = new Map();
  for (const candidate of candidates.filter((item) => item.source === "structured_intake")) {
    const key = normalizedValue(fieldKey, candidate.value);
    if (!key) continue;
    const group = structuredGroups.get(key) || [];
    group.push(candidate);
    structuredGroups.set(key, group);
  }

  const selected = preferredCandidate(envelope, candidates);
  if (structuredGroups.size === 1) {
    const winner = [...structuredGroups.values()][0][0];
    return resolutionFor(
      envelope,
      {
        status: "selected",
        selectedCandidateId: winner.id,
        reasonCode: "structured_intake_preferred",
        policyVersion,
        resolvedBy: scalarResolvedBy(fieldKey),
      },
      selectCandidate(envelope.candidates, winner.id),
    );
  }

  if (groups.size > 1) {
    return resolutionFor(
      envelope,
      {
        status: "requires_review",
        ...(selected ? {
          selectedCandidateId: selected.id,
          suggestedCandidateId: selected.id,
        } : {}),
        reasonCode: "conflicting_supported_candidates",
        policyVersion,
        resolvedBy: scalarResolvedBy(fieldKey),
      },
      envelope.candidates,
    );
  }

  const winner = selected || [...groups.values()][0]?.[0];
  const equivalentCount = candidates.length;
  return resolutionFor(
    envelope,
    {
      status: "selected",
      ...(winner ? { selectedCandidateId: winner.id } : {}),
      reasonCode: equivalentCount > 1 ? "duplicate_equivalent_candidates" : "single_explicit_candidate",
      policyVersion,
      resolvedBy: scalarResolvedBy(fieldKey),
    },
    winner ? selectCandidate(envelope.candidates, winner.id) : envelope.candidates,
  );
}

function resolvePriceEnvelope(envelope) {
  if (!envelope) return null;
  const candidates = usableCandidates(envelope);
  const originalResolution = envelope.resolution || {};
  const selected = candidates.filter((candidate) => candidate.status === "selected");
  const suggested = preferredCandidate(envelope, candidates);

  if (!candidates.length) {
    return resolutionFor(
      envelope,
      {
        status: "unresolved",
        reasonCode: "insufficient_support",
        policyVersion: PRICE_POLICY_VERSION,
        resolvedBy: "price_policy",
      },
      envelope.candidates,
    );
  }

  const originalSelected = candidates.find((candidate) =>
    candidate.id === originalResolution.selectedCandidateId || candidate.id === originalResolution.suggestedCandidateId,
  );
  if (originalResolution.reasonCode === "explicit_correction" && originalSelected) {
    return resolutionFor(
      envelope,
      {
        status: "selected",
        selectedCandidateId: originalSelected.id,
        reasonCode: "explicit_correction",
        policyVersion: PRICE_POLICY_VERSION,
        resolvedBy: "price_policy",
      },
      selectCandidate(envelope.candidates, originalSelected.id),
    );
  }

  if (originalResolution.status === "requires_review" || originalResolution.reasonCode === "conflicting_supported_candidates") {
    return resolutionFor(
      envelope,
      {
        status: "requires_review",
        ...(suggested ? {
          selectedCandidateId: suggested.id,
          suggestedCandidateId: suggested.id,
        } : {}),
        reasonCode: originalResolution.reasonCode || "conflicting_supported_candidates",
        policyVersion: PRICE_POLICY_VERSION,
        resolvedBy: "price_policy",
      },
      envelope.candidates,
    );
  }

  if (!selected.length) {
    return resolutionFor(
      envelope,
      {
        status: "unresolved",
        reasonCode: "insufficient_support",
        policyVersion: PRICE_POLICY_VERSION,
        resolvedBy: "price_policy",
      },
      envelope.candidates,
    );
  }

  const amounts = new Set(selected.map((candidate) => normalizedValue("prices", candidate.value)));
  const reasonCode = originalResolution.reasonCode === "stronger_scope_pairing"
    ? "stronger_scope_pairing"
    : amounts.size === 1 && selected.length > 1
      ? "duplicate_equivalent_candidates"
      : selected.length === 1
        ? "single_explicit_candidate"
        : "stronger_scope_pairing";

  if (amounts.size > 1 && reasonCode !== "stronger_scope_pairing") {
    return resolutionFor(
      envelope,
      {
        status: "requires_review",
        selectedCandidateId: selected[0].id,
        suggestedCandidateId: selected[0].id,
        reasonCode: "conflicting_supported_candidates",
        policyVersion: PRICE_POLICY_VERSION,
        resolvedBy: "price_policy",
      },
      envelope.candidates,
    );
  }

  return resolutionFor(
    envelope,
    {
      status: "selected",
      selectedCandidateId: selected[0].id,
      ...(selected.length > 1 ? { selectedCandidateIds: selected.map((candidate) => candidate.id) } : {}),
      reasonCode,
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    },
    envelope.candidates,
  );
}

export function resolveFieldDecisionEnvelopes(decisions = {}) {
  return {
    ...decisions,
    phone: resolveScalarEnvelope(decisions.phone, "phone", CONTACT_POLICY_VERSION),
    service_address: resolveScalarEnvelope(decisions.service_address, "service_address", ADDRESS_POLICY_VERSION),
    tree_count: resolveScalarEnvelope(decisions.tree_count, "tree_count", TREE_SCOPE_POLICY_VERSION),
    prices: resolvePriceEnvelope(decisions.prices),
  };
}

function hasEvidence(candidate) {
  return Array.isArray(candidate?.evidence) && candidate.evidence.some((item) => asString(item?.quote).trim());
}

function hasReason(candidate) {
  return Array.isArray(candidate?.reasonCodes) && candidate.reasonCodes.some((code) => asString(code).trim());
}

function resolutionCandidates(envelope) {
  const ids = Array.isArray(envelope?.resolution?.selectedCandidateIds)
    ? envelope.resolution.selectedCandidateIds
    : [envelope?.resolution?.selectedCandidateId];
  return ids
    .filter(Boolean)
    .map((id) => (envelope?.candidates || []).find((candidate) => candidate.id === id))
    .filter(Boolean);
}

/**
 * Return customer-document blockers for the four fields owned by Phase 2.
 * Generic review acknowledgements must not bypass these blockers.
 */
export function fieldResolutionBlockingErrors(alphaJson = {}) {
  const decisions = alphaJson?.normalization?.decisions || {};
  const errors = [];
  const contactMethodSelected = (key) => decisions[key]?.resolution?.status === "selected";

  for (const definition of FIELD_DEFINITIONS) {
    if (definition.key === "phone" && contactMethodSelected("email") && !contactMethodSelected("phone")) continue;
    const envelope = decisions[definition.key];
    if (!envelope) {
      errors.push(`Field resolution missing: ${definition.label}.`);
      continue;
    }

    const resolution = envelope.resolution || {};
    const conflict = resolution.reasonCode === "conflicting_supported_candidates" && resolution.resolvedBy !== "reviewer";
    if (resolution.status !== "selected" || conflict) {
      errors.push(`Field resolution requires review: ${definition.label}.`);
      continue;
    }

    const selected = resolutionCandidates(envelope);
    if (!selected.length || selected.some((candidate) => (
      candidate.status !== "selected" ||
      !candidateHasValue(candidate) ||
      !hasEvidence(candidate) ||
      !hasReason(candidate)
    ))) {
      errors.push(`Field resolution lacks trusted evidence: ${definition.label}.`);
    } else if (definition.key === "service_address" && selected.some((candidate) => !isCompleteServiceAddress(candidate.value))) {
      errors.push("Field resolution requires a complete service address.");
    }
  }

  return [...new Set(errors)];
}

export function resolutionReasonText(reasonCode) {
  return reasonText(reasonCode);
}
