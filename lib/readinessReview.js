import { createHash, randomUUID } from "node:crypto";

export const READINESS_REVIEW_ACTIONS = Object.freeze([
  "selected_candidate",
  "keep_original",
  "entered_new_value",
  "marked_business_change",
]);

export const READINESS_REASON_CODES = Object.freeze([
  "app_wrong",
  "customer_update",
  "reviewer_correction",
  "application_error",
  "formatting",
]);

export const READINESS_REVIEW_FIELDS = Object.freeze([
  "customer.phone",
  "customer.email",
  "job.service_address",
  "job.tree_details.tree_count",
  "service_options.prices",
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function canonicalReadinessField(field = "") {
  const value = asString(field).trim();
  if ([
    "phone",
    "customer_phone",
    "customer.phone",
    "customer.phone_display",
    "customer.phone_primary",
  ].includes(value)) {
    return "customer.phone";
  }
  if (["email", "customer_email", "customer.email"].includes(value)) return "customer.email";
  if (["address", "service_address", "job.service_address", "job.service_address.display"].includes(value)) {
    return "job.service_address";
  }
  if (["tree_count", "job.tree_count", "job.tree_details.tree_count"].includes(value)) {
    return "job.tree_details.tree_count";
  }
  if (value === "job.price" || value === "prices" || value === "service_options.prices" || /^service_options\.items\[\d+\]\.price$/.test(value)) {
    return "service_options.prices";
  }
  return "";
}

export function readinessSafetyBlockingEnabled(environment = process.env) {
  return String(environment?.ENABLE_READINESS_SAFETY_BLOCKING || "").trim().toLowerCase() === "true";
}

function stableDecisionId(entry) {
  const source = JSON.stringify({
    findingId: asString(entry?.findingId),
    field: canonicalReadinessField(entry?.field),
    action: asString(entry?.action),
    candidateId: asString(entry?.candidateId),
    optionId: asString(entry?.optionId),
    value: entry?.value ?? null,
    reasonCode: asString(entry?.reasonCode),
    note: asString(entry?.note),
    at: asString(entry?.at),
  });
  return `decision_${createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

export function normalizeReadinessDecision(entry = {}, { assignId = false } = {}) {
  if (!entry || typeof entry !== "object") return null;
  const field = canonicalReadinessField(entry.field);
  const action = asString(entry.action);
  const reasonCode = asString(entry.reasonCode);
  if (!field || !READINESS_REVIEW_ACTIONS.includes(action)) return null;

  const normalized = {
    decisionId: asString(entry.decisionId || entry.id) || (assignId ? randomUUID() : ""),
    findingId: asString(entry.findingId),
    field,
    action,
    reasonCode,
    at: asString(entry.at || entry.timestamp) || new Date().toISOString(),
  };
  const candidateId = asString(entry.candidateId);
  const optionId = asString(entry.optionId);
  const note = asString(entry.note || entry.reviewerNote).trim();
  if (candidateId) normalized.candidateId = candidateId;
  if (optionId) normalized.optionId = optionId;
  if (entry.value !== undefined && entry.value !== null && entry.value !== "") normalized.value = entry.value;
  if (note) normalized.note = note;
  return normalized;
}

export function normalizeReadinessDecisions(value = [], { assignId = false } = {}) {
  const entries = Array.isArray(value) ? value : [];
  return entries.map((entry) => normalizeReadinessDecision(entry, { assignId })).filter(Boolean);
}

export function createReadinessDecision(entry = {}) {
  const normalized = normalizeReadinessDecision(entry, { assignId: true });
  if (!normalized) throw new Error("Invalid readiness review decision.");
  if (!normalized.findingId || !normalized.reasonCode) {
    throw new Error("Readiness review decisions require findingId and reasonCode.");
  }
  if (!READINESS_REASON_CODES.includes(normalized.reasonCode)) {
    throw new Error(`Invalid readiness reason code: ${normalized.reasonCode || "(empty)"}`);
  }
  if (normalized.action === "selected_candidate" && !normalized.candidateId) {
    throw new Error("Selecting a candidate requires candidateId.");
  }
  return normalized;
}

function candidateForField(alphaJson, field, candidateId) {
  if (!candidateId) return null;
  const key = field === "customer.phone"
    ? "phone"
    : field === "customer.email"
      ? "email"
      : field === "job.service_address"
        ? "service_address"
        : field === "job.tree_details.tree_count"
          ? "tree_count"
          : "prices";
  return (alphaJson?.normalization?.decisions?.[key]?.candidates || []).find((candidate) => candidate?.id === candidateId) || null;
}

function currentValueForField(alphaJson, field) {
  if (field === "customer.phone") {
    return alphaJson?.customer?.phone_primary || alphaJson?.customer?.phone_display || "";
  }
  if (field === "customer.email") return alphaJson?.customer?.email || "";
  if (field === "job.service_address") return alphaJson?.job?.service_address?.display || "";
  if (field === "job.tree_details.tree_count") return alphaJson?.job?.tree_details?.tree_count || "";
  if (field === "service_options.prices") {
    return (alphaJson?.service_options?.items || [])
      .map((option) => option?.price?.amount ?? option?.price?.min_amount)
      .filter((amount) => amount != null);
  }
  return "";
}

function comparableDecisionValue(field, value) {
  if (value == null) return "";
  if (field === "customer.phone") return asString(value).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (field === "service_options.prices") {
    const amount = typeof value === "object" ? value.amount ?? value.min_amount : value;
    const number = Number(asString(amount).replace(/[$,\s]/g, ""));
    return Number.isFinite(number) ? String(number) : "";
  }
  if (field === "job.tree_details.tree_count") {
    const text = asString(value).toLowerCase();
    const wordCounts = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
    const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[1];
    return wordCounts[word] || text.match(/\b(\d+)\b/)?.[1] || text.replace(/\s+/g, " ").trim();
  }
  return asString(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function valueMatchesField(field, requestedValue, actualValue) {
  if (requestedValue == null || requestedValue === "") return true;
  if (Array.isArray(actualValue)) {
    return actualValue.some((value) => comparableDecisionValue(field, value) === comparableDecisionValue(field, requestedValue));
  }
  return comparableDecisionValue(field, requestedValue) === comparableDecisionValue(field, actualValue);
}

function optionExists(alphaJson, optionId) {
  if (!optionId) return true;
  return (alphaJson?.service_options?.items || []).some((option, index) =>
    option?.id === optionId || option?.label === optionId || String(index) === optionId ||
    String.fromCharCode(65 + index) === optionId.toUpperCase() ||
    `Option ${String.fromCharCode(65 + index)}` === optionId,
  );
}

function decisionValueIsValid(field, decision) {
  if (["entered_new_value", "marked_business_change"].includes(decision.action) && (decision.value == null || decision.value === "")) return false;
  if (decision.value == null || decision.value === "") return true;
  if (field === "customer.phone") return comparableDecisionValue(field, decision.value).length >= 10;
  if (field === "customer.email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(decision.value));
  if (field === "job.service_address") return /^\d+\s+\S+/.test(asString(decision.value).trim());
  if (field === "job.tree_details.tree_count") return Number(comparableDecisionValue(field, decision.value)) >= 1;
  if (field === "service_options.prices") return Number(comparableDecisionValue(field, decision.value)) > 0;
  return false;
}

export function decisionMatchesFinding(decision, finding, alphaJson = {}) {
  if (!decision || !finding) return false;
  if (!decision.findingId || decision.findingId !== finding.finding_id) return false;
  if (canonicalReadinessField(decision.field) !== canonicalReadinessField(finding.field)) return false;
  if (!READINESS_REASON_CODES.includes(decision.reasonCode)) return false;
  if (!READINESS_REVIEW_ACTIONS.includes(decision.action)) return false;

  const candidateIds = Array.isArray(finding.candidate_ids) ? finding.candidate_ids.filter(Boolean) : [];
  if (decision.candidateId) {
    const candidate = candidateForField(alphaJson, decision.field, decision.candidateId);
    if (!candidate || candidate.status === "quarantined") return false;
    if (candidateIds.length && !candidateIds.includes(decision.candidateId)) return false;
    if (!valueMatchesField(decision.field, decision.value, candidate.value)) return false;
  } else if (decision.action === "selected_candidate") {
    return false;
  }

  if (decision.optionId && !optionExists(alphaJson, decision.optionId)) return false;
  if (finding.option_id && decision.optionId !== finding.option_id) return false;
  if (finding.option_id && !decision.optionId) return false;
  if (!decisionValueIsValid(decision.field, decision)) return false;
  if (decision.action === "keep_original" && decision.value != null && decision.value !== "" &&
      !valueMatchesField(decision.field, decision.value, currentValueForField(alphaJson, decision.field))) return false;
  return true;
}

export function validateReadinessDecisions(findings = [], decisions = [], alphaJson = {}) {
  const activeFindings = Array.isArray(findings) ? findings.filter((finding) => finding?.enforceable !== false) : [];
  const normalized = normalizeReadinessDecisions(decisions);
  const errors = [];
  const accepted = [];
  for (const decision of normalized) {
    const finding = activeFindings.find((candidate) => candidate.finding_id === decision.findingId);
    if (!finding) {
      errors.push({ decisionId: decision.decisionId, code: "UNKNOWN_FINDING", message: "Decision does not match an active readiness finding." });
      continue;
    }
    if (!decisionMatchesFinding(decision, finding, alphaJson)) {
      errors.push({ decisionId: decision.decisionId, code: "INVALID_FINDING_DECISION", message: `Decision does not match readiness finding ${finding.finding_id}.` });
      continue;
    }
    accepted.push(decision);
  }
  return { accepted, errors };
}

function structuredFindings(validation = {}) {
  const safety = validation?.readiness_safety || {};
  if (Array.isArray(safety.enforced_findings)) return safety.enforced_findings;
  return Array.isArray(safety.findings) ? safety.findings.filter((finding) => finding?.enforceable !== false) : [];
}

function decisionSources(overrides = {}, alphaJson = {}) {
  return normalizeReadinessDecisions([
    ...(Array.isArray(overrides?.readinessDecisions) ? overrides.readinessDecisions : []),
    ...(Array.isArray(overrides?.decisions) ? overrides.decisions : []),
    ...(Array.isArray(alphaJson?.review?.readiness_decisions) ? alphaJson.review.readiness_decisions : []),
    ...(Array.isArray(alphaJson?.normalization?.business_decisions?.readiness_decisions)
      ? alphaJson.normalization.business_decisions.readiness_decisions
      : []),
  ]);
}

export function readinessOverrideStatus(validation = {}, overrides = {}, alphaJson = {}) {
  const findings = structuredFindings(validation);
  const decisions = decisionSources(overrides, alphaJson);
  const cleared = new Map();
  for (const finding of findings) {
    const decision = decisions.find((entry) => decisionMatchesFinding(entry, finding, alphaJson));
    if (decision) cleared.set(finding.finding_id, decision);
  }

  const readinessErrors = new Set(validation?.readiness_safety_blocking_errors || []);
  const remainingBlockingErrors = (Array.isArray(validation?.blocking_errors) ? validation.blocking_errors : []).filter((error) => {
    if (!readinessErrors.has(error)) return true;
    const finding = findings.find((candidate) => error.includes(candidate.finding_id));
    return !finding || !cleared.has(finding.finding_id);
  });
  const acceptedOverrideWarnings = [...cleared.entries()].map(([findingId, decision]) => ({
    key: "readinessSafety",
    findingId,
    field: decision.field,
    title: "Readiness finding reviewed",
    message: `${decision.field} was resolved by reviewer using ${decision.reasonCode}.`,
    decisionId: decision.decisionId,
  }));
  return {
    findings,
    decisions,
    clearedFindingIds: [...cleared.keys()],
    remainingReadinessFindings: findings.filter((finding) => !cleared.has(finding.finding_id)),
    remainingBlockingErrors,
    acceptedOverrideWarnings,
    canProceed: remainingBlockingErrors.length === 0,
  };
}
