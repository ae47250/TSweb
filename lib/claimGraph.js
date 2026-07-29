/**
 * Additive claim graph for correction / relationship modeling.
 * Does not select AlphaJSON winners — only records claims and typed edges.
 *
 * @typedef {"duplicates"|"supersedes"|"narrows"|"expands"|"qualifies"|"alternative_to"|"contradicts"|"excludes"} ClaimRelationshipType
 * @typedef {"confirmed"|"proposed"|"needs_review"} ClaimConfidence
 * @typedef {"raw_notes"|"structured_intake"|"model"|"deterministic_rule"|"reviewer"} ClaimSource
 *
 * @typedef {object} Claim
 * @property {string} id
 * @property {string} field
 * @property {*} value
 * @property {string} evidence
 * @property {number} [start]
 * @property {number} [end]
 * @property {ClaimSource} [source]
 *
 * @typedef {object} ClaimEdge
 * @property {string} from
 * @property {string} to
 * @property {ClaimRelationshipType} type
 * @property {string} reason
 * @property {ClaimConfidence} confidence
 * @property {string[]} [signals]
 *
 * @typedef {object} ClaimGraph
 * @property {Claim[]} claims
 * @property {ClaimEdge[]} relationships
 */

export const CLAIM_RELATIONSHIP_TYPES = Object.freeze([
  "duplicates",
  "supersedes",
  "narrows",
  "expands",
  "qualifies",
  "alternative_to",
  "contradicts",
  "excludes",
]);

export const CLAIM_CONFIDENCES = Object.freeze([
  "confirmed",
  "proposed",
  "needs_review",
]);

export const CLAIM_SOURCES = Object.freeze([
  "raw_notes",
  "structured_intake",
  "model",
  "deterministic_rule",
  "reviewer",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * @param {object} params
 * @returns {Claim}
 */
export function createClaim({
  id,
  field,
  value,
  evidence,
  start,
  end,
  source = "raw_notes",
} = {}) {
  const claim = {
    id: asString(id),
    field: asString(field),
    value,
    evidence: asString(evidence).trim(),
    source: CLAIM_SOURCES.includes(source) ? source : "raw_notes",
  };
  if (Number.isFinite(start)) claim.start = Number(start);
  if (Number.isFinite(end)) claim.end = Number(end);
  return claim;
}

/**
 * @param {object} params
 * @returns {ClaimEdge}
 */
export function createRelationship({
  from,
  to,
  type,
  reason,
  confidence = "confirmed",
  signals = [],
} = {}) {
  const edge = {
    from: asString(from),
    to: asString(to),
    type,
    reason: asString(reason).trim() || "unspecified",
    confidence: CLAIM_CONFIDENCES.includes(confidence) ? confidence : "needs_review",
  };
  if (Array.isArray(signals) && signals.length) {
    edge.signals = signals.map((signal) => asString(signal)).filter(Boolean);
  }
  return edge;
}

/**
 * @param {object} params
 * @returns {ClaimGraph}
 */
export function createClaimGraph({ claims = [], relationships = [] } = {}) {
  return {
    claims: Array.isArray(claims) ? claims : [],
    relationships: Array.isArray(relationships) ? relationships : [],
  };
}

/**
 * @param {ClaimGraph} graph
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateClaimGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== "object") {
    return { ok: false, errors: ["claim graph must be an object"] };
  }
  if (!Array.isArray(graph.claims)) errors.push("claims must be an array");
  if (!Array.isArray(graph.relationships)) errors.push("relationships must be an array");

  const claimIds = new Set();
  for (const [index, claim] of (graph.claims || []).entries()) {
    if (!asString(claim?.id)) errors.push(`claims[${index}].id is required`);
    else if (claimIds.has(claim.id)) errors.push(`claims[${index}].id is duplicate: ${claim.id}`);
    else claimIds.add(claim.id);
    if (!asString(claim?.field)) errors.push(`claims[${index}].field is required`);
    if (!asString(claim?.evidence)) errors.push(`claims[${index}].evidence is required`);
    if (claim?.source && !CLAIM_SOURCES.includes(claim.source)) {
      errors.push(`claims[${index}].source is invalid`);
    }
  }

  for (const [index, edge] of (graph.relationships || []).entries()) {
    if (!asString(edge?.from)) errors.push(`relationships[${index}].from is required`);
    else if (claimIds.size && !claimIds.has(edge.from)) {
      errors.push(`relationships[${index}].from must match a claim id`);
    }
    if (!asString(edge?.to)) errors.push(`relationships[${index}].to is required`);
    else if (claimIds.size && !claimIds.has(edge.to)) {
      errors.push(`relationships[${index}].to must match a claim id`);
    }
    if (!CLAIM_RELATIONSHIP_TYPES.includes(edge?.type)) {
      errors.push(`relationships[${index}].type is invalid`);
    }
    if (!asString(edge?.reason)) errors.push(`relationships[${index}].reason is required`);
    if (!CLAIM_CONFIDENCES.includes(edge?.confidence)) {
      errors.push(`relationships[${index}].confidence is invalid`);
    }
    if (edge?.signals != null && !Array.isArray(edge.signals)) {
      errors.push(`relationships[${index}].signals must be an array`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Ensure normalization.claim_graph exists and replace/merge with graph.
 *
 * @param {object} alphaJson
 * @param {ClaimGraph|null|undefined} graph
 * @returns {object}
 */
export function attachClaimGraph(alphaJson = {}, graph = null) {
  const next = alphaJson || {};
  next.normalization = { ...(next.normalization || {}) };
  if (graph) next.normalization.claim_graph = graph;
  return next;
}

/**
 * Remove client-supplied claim graphs (trusted path must recompute).
 *
 * @param {object} alphaJson
 */
export function clearClientClaimGraph(alphaJson = {}) {
  if (!alphaJson?.normalization) return alphaJson;
  alphaJson.normalization = { ...alphaJson.normalization };
  delete alphaJson.normalization.claim_graph;
  return alphaJson;
}
