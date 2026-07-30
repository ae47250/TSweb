/**
 * Append-only reviewer decision ledger on AlphaJSON.
 * Distinguishes extraction failures from business scope changes and formatting.
 *
 * @typedef {
 *   | "accept_candidate"
 *   | "reject_candidate"
 *   | "correct_extraction"
 *   | "resolve_conflict"
 *   | "business_scope_change"
 *   | "formatting_change"
 *   | "override_missing"
 *   | "enter_new_value"
 * } ReviewerDecisionAction
 *
 * @typedef {object} ReviewerDecision
 * @property {string} id
 * @property {string} estimateId
 * @property {string} field
 * @property {ReviewerDecisionAction} action
 * @property {*} before
 * @property {*} after
 * @property {string[]} [candidateIds]
 * @property {string} [conflictId]
 * @property {string} [reasonCode]
 * @property {string} [reviewerNote]
 * @property {string} [actorId]
 * @property {string} timestamp
 * @property {string} extractionVersion
 * @property {string} resolutionPolicyVersion
 */

export const REVIEWER_DECISION_ACTIONS = Object.freeze([
  "accept_candidate",
  "reject_candidate",
  "correct_extraction",
  "resolve_conflict",
  "business_scope_change",
  "formatting_change",
  "override_missing",
  "enter_new_value",
]);

export const REVIEWER_LEDGER_POLICY_VERSION = "reviewer_ledger@1";

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeComparableText(value) {
  return asString(value)
    .replace(/[.,;:!?'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(value) {
  const normalized = normalizeComparableText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function tokenMultisetContains(haystack, needle) {
  const remaining = new Map();
  for (const token of haystack) {
    remaining.set(token, (remaining.get(token) || 0) + 1);
  }
  for (const token of needle) {
    const count = remaining.get(token) || 0;
    if (count < 1) return false;
    remaining.set(token, count - 1);
  }
  return true;
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length === 0;
    if ("amount" in value) {
      const amount = Number(value.amount);
      const display = asString(value.display).trim();
      return (!Number.isFinite(amount) || amount <= 0) && !display;
    }
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * @param {object} params
 * @returns {ReviewerDecision}
 */
export function createReviewerDecision({
  estimateId = "",
  field = "",
  action,
  before = null,
  after = null,
  candidateIds,
  conflictId,
  reasonCode,
  reviewerNote,
  actorId,
  extractionVersion = "unknown",
  resolutionPolicyVersion = REVIEWER_LEDGER_POLICY_VERSION,
} = {}) {
  const nextAction = asString(action);
  if (!REVIEWER_DECISION_ACTIONS.includes(nextAction)) {
    throw new Error(`Invalid reviewer decision action: ${nextAction || "(empty)"}`);
  }

  /** @type {ReviewerDecision} */
  const decision = {
    id: globalThis.crypto.randomUUID(),
    estimateId: asString(estimateId),
    field: asString(field),
    action: /** @type {ReviewerDecisionAction} */ (nextAction),
    before,
    after,
    timestamp: new Date().toISOString(),
    extractionVersion: asString(extractionVersion) || "unknown",
    resolutionPolicyVersion: asString(resolutionPolicyVersion) || REVIEWER_LEDGER_POLICY_VERSION,
  };

  if (Array.isArray(candidateIds) && candidateIds.length > 0) {
    decision.candidateIds = candidateIds.map((id) => asString(id)).filter(Boolean);
  }
  const conflict = asString(conflictId);
  if (conflict) decision.conflictId = conflict;
  const reason = asString(reasonCode);
  if (reason) decision.reasonCode = reason;
  const note = asString(reviewerNote).trim();
  if (note) decision.reviewerNote = note;
  const actor = asString(actorId);
  if (actor) decision.actorId = actor;

  return decision;
}

/**
 * Append a decision without mutating prior entries.
 *
 * @param {object} alphaJson
 * @param {ReviewerDecision} decision
 * @returns {object}
 */
export function appendReviewerDecision(alphaJson = {}, decision) {
  const existing = Array.isArray(alphaJson?.reviewer_decisions)
    ? alphaJson.reviewer_decisions
    : [];
  return {
    ...alphaJson,
    reviewer_decisions: [...existing, decision],
  };
}

/**
 * Classify free-text edits (job description, option description).
 *
 * @param {{ before?: unknown, after?: unknown }} params
 * @returns {ReviewerDecisionAction}
 */
export function classifyTextEditAction({ before, after } = {}) {
  const beforeRaw = asString(before);
  const afterRaw = asString(after);
  if (beforeRaw === afterRaw) return "formatting_change";

  const beforeNormalized = normalizeComparableText(beforeRaw);
  const afterNormalized = normalizeComparableText(afterRaw);
  if (beforeNormalized && beforeNormalized === afterNormalized) {
    return "formatting_change";
  }

  const beforeTokens = tokenize(beforeRaw);
  const afterTokens = tokenize(afterRaw);
  if (
    beforeTokens.length > 0 &&
    afterTokens.length > beforeTokens.length &&
    tokenMultisetContains(afterTokens, beforeTokens)
  ) {
    return "business_scope_change";
  }

  return "correct_extraction";
}

/**
 * Classify scalar / price field edits.
 *
 * @param {{ before?: unknown, after?: unknown, wasUnclear?: boolean }} params
 * @returns {ReviewerDecisionAction}
 */
export function classifyValueEditAction({ before, after, wasUnclear = false } = {}) {
  if (wasUnclear || isEmptyValue(before)) {
    return "override_missing";
  }

  const beforeAmount = before && typeof before === "object" && "amount" in before
    ? Number(before.amount)
    : null;
  const afterAmount = after && typeof after === "object" && "amount" in after
    ? Number(after.amount)
    : null;

  if (
    Number.isFinite(beforeAmount) &&
    Number.isFinite(afterAmount) &&
    beforeAmount === afterAmount
  ) {
    const beforeDisplay = asString(before?.display);
    const afterDisplay = asString(after?.display);
    if (beforeDisplay !== afterDisplay) return "formatting_change";
  }

  if (
    typeof before === "string" &&
    typeof after === "string" &&
    normalizeComparableText(before) === normalizeComparableText(after) &&
    before !== after
  ) {
    return "formatting_change";
  }

  if (before === after) return "formatting_change";

  return "correct_extraction";
}
