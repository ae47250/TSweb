/**
 * Shared decision-envelope seam for field-specific resolvers.
 * Domain policies stay separate; this standardizes metadata only.
 *
 * @typedef {"selected"|"unresolved"|"abstained"|"requires_review"} ResolutionStatus
 * @typedef {"single_explicit_candidate"|"explicit_correction"|"structured_intake_preferred"|"duplicate_equivalent_candidates"|"stronger_scope_pairing"|"conflicting_supported_candidates"|"insufficient_support"} ResolutionReasonCode
 * @typedef {"contact_policy"|"address_policy"|"price_policy"|"tree_scope_policy"|"reviewer"} ResolvedBy
 * @typedef {"structured_intake"|"raw_notes"|"model"|"deterministic_rule"|"reviewer"} DecisionSource
 * @typedef {"explicit"|"normalized_explicit"|"inferred"|"ambiguous"} DecisionSupport
 * @typedef {"eligible"|"selected"|"rejected"|"quarantined"} CandidateStatus
 *
 * @typedef {object} DecisionEvidence
 * @property {string} quote
 * @property {number} [start]
 * @property {number} [end]
 *
 * @typedef {object} DecisionCandidate
 * @property {string} id
 * @property {*} value
 * @property {DecisionSource} source
 * @property {DecisionSupport} support
 * @property {DecisionEvidence[]} evidence
 * @property {CandidateStatus} status
 * @property {string[]} reasonCodes
 *
 * @typedef {object} DecisionResolution
 * @property {ResolutionStatus} status
 * @property {string} [selectedCandidateId]
 * @property {ResolutionReasonCode} reasonCode
 * @property {string} policyVersion
 * @property {ResolvedBy} resolvedBy
 *
 * @typedef {object} DecisionEnvelope
 * @property {string} field
 * @property {DecisionCandidate[]} candidates
 * @property {DecisionResolution} resolution
 */

export const CONTACT_POLICY_VERSION = "contact_policy@1";
export const ADDRESS_POLICY_VERSION = "address_policy@1";
export const PRICE_POLICY_VERSION = "price_policy@1";
export const TREE_SCOPE_POLICY_VERSION = "tree_scope_policy@1";

export const RESOLUTION_STATUSES = Object.freeze([
  "selected",
  "unresolved",
  "abstained",
  "requires_review",
]);

export const RESOLUTION_REASON_CODES = Object.freeze([
  "single_explicit_candidate",
  "explicit_correction",
  "structured_intake_preferred",
  "duplicate_equivalent_candidates",
  "stronger_scope_pairing",
  "conflicting_supported_candidates",
  "insufficient_support",
]);

export const RESOLVED_BY = Object.freeze([
  "contact_policy",
  "address_policy",
  "price_policy",
  "tree_scope_policy",
  "reviewer",
]);

export const DECISION_SOURCES = Object.freeze([
  "structured_intake",
  "raw_notes",
  "model",
  "deterministic_rule",
  "reviewer",
]);

export const DECISION_SUPPORTS = Object.freeze([
  "explicit",
  "normalized_explicit",
  "inferred",
  "ambiguous",
]);

export const CANDIDATE_STATUSES = Object.freeze([
  "eligible",
  "selected",
  "rejected",
  "quarantined",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * @param {object} params
 * @returns {DecisionCandidate}
 */
export function createCandidate({
  id,
  value,
  source,
  support = "explicit",
  evidence = [],
  status = "eligible",
  reasonCodes = [],
} = {}) {
  const evidenceList = Array.isArray(evidence)
    ? evidence
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const quote = asString(item.quote).trim();
        if (!quote) return null;
        const next = { quote };
        if (Number.isFinite(item.start)) next.start = Number(item.start);
        if (Number.isFinite(item.end)) next.end = Number(item.end);
        return next;
      })
      .filter(Boolean)
    : [];

  return {
    id: asString(id),
    value,
    source,
    support,
    evidence: evidenceList,
    status,
    reasonCodes: Array.isArray(reasonCodes)
      ? reasonCodes.map((code) => asString(code)).filter(Boolean)
      : [],
  };
}

/**
 * @param {object} params
 * @returns {DecisionEnvelope}
 */
export function createEnvelope({
  field,
  candidates = [],
  resolution = {},
} = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  return {
    field: asString(field),
    candidates: list,
    resolution: {
      status: resolution.status || "unresolved",
      ...(resolution.selectedCandidateId
        ? { selectedCandidateId: asString(resolution.selectedCandidateId) }
        : {}),
      reasonCode: resolution.reasonCode || "insufficient_support",
      policyVersion: asString(resolution.policyVersion),
      resolvedBy: resolution.resolvedBy || "contact_policy",
    },
  };
}

/**
 * Mark one candidate selected and demote other selected peers to eligible/rejected.
 * Does not invent winners — only applies an already-chosen id.
 *
 * @param {DecisionCandidate[]} candidates
 * @param {string} selectedCandidateId
 * @returns {DecisionCandidate[]}
 */
export function selectCandidate(candidates = [], selectedCandidateId = "") {
  const id = asString(selectedCandidateId);
  return (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    if (!candidate || typeof candidate !== "object") return candidate;
    if (candidate.id === id) {
      return { ...candidate, status: "selected" };
    }
    if (candidate.status === "selected") {
      return { ...candidate, status: "eligible" };
    }
    return candidate;
  });
}

/**
 * @param {DecisionEnvelope} envelope
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDecisionEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, errors: ["envelope must be an object"] };
  }
  if (!asString(envelope.field)) errors.push("field is required");
  if (!Array.isArray(envelope.candidates)) errors.push("candidates must be an array");
  if (!envelope.resolution || typeof envelope.resolution !== "object") {
    errors.push("resolution is required");
  } else {
    if (!RESOLUTION_STATUSES.includes(envelope.resolution.status)) {
      errors.push(`invalid resolution.status: ${envelope.resolution.status}`);
    }
    if (!RESOLUTION_REASON_CODES.includes(envelope.resolution.reasonCode)) {
      errors.push(`invalid resolution.reasonCode: ${envelope.resolution.reasonCode}`);
    }
    if (!asString(envelope.resolution.policyVersion)) {
      errors.push("resolution.policyVersion is required");
    }
    if (!RESOLVED_BY.includes(envelope.resolution.resolvedBy)) {
      errors.push(`invalid resolution.resolvedBy: ${envelope.resolution.resolvedBy}`);
    }
    if (
      envelope.resolution.status === "selected" &&
      envelope.resolution.selectedCandidateId &&
      !envelope.candidates.some((candidate) => candidate.id === envelope.resolution.selectedCandidateId)
    ) {
      errors.push("selectedCandidateId must match a candidate id");
    }
  }

  for (const [index, candidate] of (envelope.candidates || []).entries()) {
    if (!asString(candidate?.id)) errors.push(`candidates[${index}].id is required`);
    if (!DECISION_SOURCES.includes(candidate?.source)) {
      errors.push(`candidates[${index}].source is invalid`);
    }
    if (!DECISION_SUPPORTS.includes(candidate?.support)) {
      errors.push(`candidates[${index}].support is invalid`);
    }
    if (!CANDIDATE_STATUSES.includes(candidate?.status)) {
      errors.push(`candidates[${index}].status is invalid`);
    }
    if (!Array.isArray(candidate?.evidence)) {
      errors.push(`candidates[${index}].evidence must be an array`);
    }
    if (!Array.isArray(candidate?.reasonCodes)) {
      errors.push(`candidates[${index}].reasonCodes must be an array`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Ensure normalization.decisions exists and merge field envelopes.
 *
 * @param {object} alphaJson
 * @param {Record<string, DecisionEnvelope|null|undefined>} decisions
 * @returns {object}
 */
export function attachDecisionEnvelopes(alphaJson = {}, decisions = {}) {
  const next = alphaJson || {};
  next.normalization = { ...(next.normalization || {}) };
  const existing = next.normalization.decisions && typeof next.normalization.decisions === "object"
    ? { ...next.normalization.decisions }
    : {};
  for (const [key, envelope] of Object.entries(decisions || {})) {
    if (envelope) existing[key] = envelope;
  }
  next.normalization.decisions = existing;
  return next;
}

/**
 * Remove client-supplied decision envelopes (trusted path must recompute).
 *
 * @param {object} alphaJson
 */
export function clearClientDecisionEnvelopes(alphaJson = {}) {
  if (!alphaJson?.normalization) return alphaJson;
  alphaJson.normalization = { ...alphaJson.normalization };
  delete alphaJson.normalization.decisions;
  return alphaJson;
}
