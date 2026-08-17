import { createHash } from "node:crypto";

/**
 * Candidate-level reviewer action log for the review-by-exception UI.
 * Actions are collected client-side and stamped onto alphaJson.review at confirm.
 */

export const REVIEWER_DECISION_ACTIONS = Object.freeze([
  "selected_candidate",
  "rejected_candidate",
  "entered_new_value",
  "keep_original",
  "marked_business_change",
]);

export const READINESS_REASON_CODES = Object.freeze([
  "app_wrong",
  "customer_update",
  "reviewer_correction",
  "application_error",
  "formatting",
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
 * @param {string} [params.optionId]
 * @param {*} [params.value]
 * @param {string} [params.note]
 * @returns {object}
 */
export function createReviewerDecisionAction({
  field,
  action,
  candidateId = "",
  optionId = "",
  findingId = "",
  reasonCode = "",
  value = null,
  note = "",
} = {}) {
  const nextAction = asString(action);
  if (!REVIEWER_DECISION_ACTIONS.includes(nextAction)) {
    throw new Error(`Invalid reviewer decision action: ${nextAction || "(empty)"}`);
  }

  const entry = {
    decisionId: globalThis.crypto?.randomUUID?.() || `decision_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    field: asString(field),
    action: nextAction,
    at: new Date().toISOString(),
  };
  const id = asString(candidateId);
  if (id) entry.candidateId = id;
  const option = asString(optionId);
  if (option) entry.optionId = option;
  const finding = asString(findingId);
  if (finding) entry.findingId = finding;
  const reason = asString(reasonCode);
  if (reason && !READINESS_REASON_CODES.includes(reason)) {
    throw new Error(`Invalid reviewer reason code: ${reason}`);
  }
  if (reason) entry.reasonCode = reason;
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
        decisionId: asString(entry.decisionId || entry.id),
        field,
        action,
        at: asString(entry.at) || new Date().toISOString(),
      };
      const findingId = asString(entry.findingId);
      if (findingId) next.findingId = findingId;
      const reasonCode = asString(entry.reasonCode);
      if (reasonCode && !READINESS_REASON_CODES.includes(reasonCode)) return null;
      if (reasonCode) next.reasonCode = reasonCode;
      const candidateId = asString(entry.candidateId);
      if (candidateId) next.candidateId = candidateId;
      const optionId = asString(entry.optionId);
      if (optionId) next.optionId = optionId;
      if (entry.value != null && entry.value !== "") next.value = entry.value;
      const note = asString(entry.note).trim();
      if (note) next.note = note;
      return next;
    })
    .filter(Boolean);
}

export function reviewerDecisionLogHash(value = [], approvedDocumentHash = "") {
  const entries = normalizeReviewerDecisionLog(value).map((entry) => ({
    decisionId: entry.decisionId || "",
    findingId: entry.findingId || "",
    field: entry.field || "",
    action: entry.action || "",
    candidateId: entry.candidateId || "",
    optionId: entry.optionId || "",
    value: entry.value ?? null,
    reasonCode: entry.reasonCode || "",
    note: entry.note || "",
  }));
  return createHash("sha256").update(JSON.stringify({ approvedDocumentHash, entries })).digest("hex");
}
