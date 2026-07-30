/**
 * Candidate-level reviewer action log for the review-by-exception UI.
 * Actions are collected client-side and stamped onto alphaJson.review at confirm.
 */

export const REVIEWER_DECISION_ACTIONS = Object.freeze([
  "selected_candidate",
  "rejected_candidate",
  "entered_new_value",
  "marked_business_change",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * @param {object} params
 * @param {string} params.field
 * @param {string} params.action
 * @param {string} [params.candidateId]
 * @param {*} [params.value]
 * @param {string} [params.note]
 * @returns {object}
 */
export function createReviewerDecisionAction({
  field,
  action,
  candidateId = "",
  value = null,
  note = "",
} = {}) {
  const nextAction = asString(action);
  if (!REVIEWER_DECISION_ACTIONS.includes(nextAction)) {
    throw new Error(`Invalid reviewer decision action: ${nextAction || "(empty)"}`);
  }

  const entry = {
    field: asString(field),
    action: nextAction,
    at: new Date().toISOString(),
  };
  const id = asString(candidateId);
  if (id) entry.candidateId = id;
  if (value != null && value !== "") entry.value = value;
  const noteText = asString(note).trim();
  if (noteText) entry.note = noteText;
  return entry;
}

/**
 * Sanitize a client-supplied decision log for persistence.
 * Drops unknown actions and incomplete entries.
 *
 * @param {unknown} value
 * @returns {object[]}
 */
export function normalizeReviewerDecisionLog(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const action = asString(entry.action);
      const field = asString(entry.field);
      if (!field || !REVIEWER_DECISION_ACTIONS.includes(action)) return null;
      const next = {
        field,
        action,
        at: asString(entry.at) || new Date().toISOString(),
      };
      const candidateId = asString(entry.candidateId);
      if (candidateId) next.candidateId = candidateId;
      if (entry.value != null && entry.value !== "") next.value = entry.value;
      const note = asString(entry.note).trim();
      if (note) next.note = note;
      return next;
    })
    .filter(Boolean);
}
