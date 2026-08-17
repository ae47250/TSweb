"use client";

import { useEffect, useMemo, useState } from "react";

const REASONS = [
  ["app_wrong", "The app is wrong"],
  ["customer_update", "The customer changed it"],
  ["reviewer_correction", "Reviewer correction"],
  ["application_error", "Application error"],
  ["formatting", "Formatting only"],
];

const ACTIONS = [
  ["keep_original", "Keep original"],
  ["entered_new_value", "Enter new value"],
  ["marked_business_change", "Mark business change"],
];

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return value.display || value.description || value.amount || JSON.stringify(value);
  return "";
}

function fieldLabel(field) {
  return {
    "customer.phone": "Customer phone",
    "customer.email": "Customer email",
    "job.service_address": "Service address",
    "job.tree_details.tree_count": "Tree count",
    "service_options.prices": "Estimate price",
  }[field] || field;
}

function fieldDecisionKey(field) {
  return {
    "customer.phone": "phone",
    "customer.email": "email",
    "job.service_address": "service_address",
    "job.tree_details.tree_count": "tree_count",
    "service_options.prices": "prices",
  }[field] || "";
}

function currentValue(alphaJson, field) {
  if (field === "customer.phone") return alphaJson?.customer?.phone_display || alphaJson?.customer?.phone_primary || "";
  if (field === "customer.email") return alphaJson?.customer?.email || "";
  if (field === "job.service_address") return alphaJson?.job?.service_address?.display || "";
  if (field === "job.tree_details.tree_count") return alphaJson?.job?.tree_details?.tree_count || "";
  if (field === "service_options.prices") {
    return (alphaJson?.service_options?.items || []).map((option) => option?.price?.display).filter(Boolean).join(", ");
  }
  return "";
}

function candidateValue(candidate) {
  return asText(candidate?.value);
}

function candidateEvidence(candidate) {
  return (candidate?.evidence || []).map((item) => item?.quote).filter(Boolean).join("; ");
}

function findingEvidence(finding) {
  const evidence = finding?.evidence || {};
  return evidence.correction_evidence || evidence.source_value || evidence.quote || evidence.source_excerpt || finding?.reason || "No source evidence was recorded.";
}

export default function ReadinessFindingCards({ alphaJson, validation, busy = false, onDecision }) {
  const allFindings = validation?.readiness_safety?.enforced_findings || validation?.alphaJson?.validation?.readiness_safety?.enforced_findings || [];
  const remainingFindingIds = validation?.readiness_override_status?.remaining_finding_ids ||
    validation?.alphaJson?.validation?.readiness_override_status?.remaining_finding_ids;
  const findings = Array.isArray(remainingFindingIds)
    ? allFindings.filter((finding) => remainingFindingIds.includes(finding.finding_id))
    : allFindings;
  const orderedFindings = [...findings].sort((left, right) => {
    const order = {
      "customer.phone": 10,
      "customer.email": 20,
      "job.tree_details.tree_count": 30,
      "service_options.prices": 40,
      "job.service_address": 90,
    };
    return (order[left.field] || 50) - (order[right.field] || 50);
  });
  if (!orderedFindings.length) return null;

  return (
    <section className="summary-card readiness-finding-card-list" aria-label="Readiness safety findings">
      <h3>Review required</h3>
      <p className="decision-exception-flag">Resolve each flagged field with a reason before generating customer documents.</p>
      {orderedFindings.map((finding) => (
        <ReadinessFindingCard
          key={finding.finding_id}
          alphaJson={alphaJson}
          finding={finding}
          busy={busy}
          onDecision={onDecision}
        />
      ))}
    </section>
  );
}

function ReadinessFindingCard({ alphaJson, finding, busy, onDecision }) {
  const field = finding.field;
  const key = fieldDecisionKey(field);
  const envelope = alphaJson?.normalization?.decisions?.[key] || {};
  const candidates = useMemo(() => {
    const ids = new Set(finding.candidate_ids || []);
    return (envelope.candidates || []).filter((candidate) => !ids.size || ids.has(candidate.id));
  }, [envelope.candidates, finding.candidate_ids]);
  const original = field === "service_options.prices" && finding.option_id
    ? (alphaJson?.service_options?.items || []).find((option, index) =>
      option?.id === finding.option_id || option?.label === finding.option_id ||
      `Option ${String.fromCharCode(65 + index)}` === finding.option_id ||
      String.fromCharCode(65 + index) === String(finding.option_id).toUpperCase(),
    )?.price?.display || ""
    : currentValue(alphaJson, field);
  const [reasonCode, setReasonCode] = useState("");
  const [action, setAction] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    setReasonCode("");
    setAction("");
    setCandidateId("");
    setValue("");
  }, [finding.finding_id]);

  function chooseCandidate(candidate) {
    setCandidateId(candidate.id || "");
    setValue(candidateValue(candidate));
    setAction("selected_candidate");
  }

  function applyDecision() {
    if (!reasonCode || !action) return;
    if (action === "selected_candidate" && !candidateId) return;
    if (["entered_new_value", "marked_business_change"].includes(action) && !value.trim()) return;
    onDecision?.({
      findingId: finding.finding_id,
      field,
      action,
      candidateId: candidateId || undefined,
      optionId: finding.option_id || undefined,
      value: value || original || undefined,
      reasonCode,
      note: `Reviewed ${fieldLabel(field)} finding ${finding.finding_id}.`,
    });
  }

  const canApply = Boolean(reasonCode && action &&
    (action !== "selected_candidate" || candidateId) &&
    (!["entered_new_value", "marked_business_change"].includes(action) || value.trim()));

  return (
    <article className="readiness-finding-card" data-finding-id={finding.finding_id}>
      <div className="readiness-finding-header">
        <strong>{fieldLabel(field)}</strong>
        <code>{finding.finding_id}</code>
      </div>
      <p>{finding.reason}</p>
      <div className="decision-exception-quote">
        <strong>Source evidence</strong>
        <p>&ldquo;{findingEvidence(finding)}&rdquo;</p>
      </div>
      {original && <p className="decision-exception-meta">Current final value: {original}</p>}
      {candidates.length > 0 && (
        <div className="readiness-candidate-list">
          {candidates.map((candidate) => (
            <button
              className={`readiness-candidate${candidateId === candidate.id ? " selected" : ""}`}
              disabled={busy}
              key={candidate.id}
              type="button"
              onClick={() => chooseCandidate(candidate)}
            >
              <strong>{candidateValue(candidate)}</strong>
              {candidateEvidence(candidate) && <small>{candidateEvidence(candidate)}</small>}
            </button>
          ))}
        </div>
      )}
      <div className="readiness-decision-controls">
        <label>
          Reason
          <select disabled={busy} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
            <option value="">Select a reason</option>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Decision
          <select disabled={busy} value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Select a decision</option>
            {ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            {candidates.length > 0 && <option value="selected_candidate">Select a candidate above</option>}
          </select>
        </label>
      </div>
      {["entered_new_value", "marked_business_change"].includes(action) && (
        <label>
          Accepted value
          <input disabled={busy} value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      )}
      <button className="btn-primary" disabled={busy || !canApply} type="button" onClick={applyDecision}>
        Apply reviewed decision
      </button>
    </article>
  );
}
