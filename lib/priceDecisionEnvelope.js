import {
  PRICE_POLICY_VERSION,
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

function mapPriceSource(source) {
  if (source === "intake" || source === "structured_intake") return "structured_intake";
  if (source === "raw_customer_note" || source === "raw_notes" || !source) return "raw_notes";
  if (source === "model" || source === "openai_draft") return "model";
  if (source === "reviewer") return "reviewer";
  return "deterministic_rule";
}

function mapCandidateStatus(candidateStatus) {
  if (candidateStatus === "accepted") return "selected";
  if (candidateStatus === "quarantined") return "quarantined";
  if (candidateStatus === "rejected") return "rejected";
  return "eligible";
}

function mapSupport(entry = {}) {
  if (entry.amount_confidence === "high" && entry.pairing_confidence === "high") return "explicit";
  if (entry.amount_confidence === "high") return "normalized_explicit";
  if (entry.pairing_confidence === "low" || entry.candidate_status === "quarantined") return "ambiguous";
  return "inferred";
}

function evidenceFromPrice(entry = {}) {
  const quote = asString(entry.description || entry.display || entry.amount).trim();
  if (!quote) return [];
  return [{ quote }];
}

/**
 * Wrap sidecar_price_reconciliation into a shared DecisionEnvelope.
 * Selection/quarantine outcomes are copied; policies are not changed.
 */
export function buildPriceDecisionEnvelope(alphaJson = {}) {
  const sidecar = alphaJson?.normalization?.sidecar_price_reconciliation || {};
  const prices = Array.isArray(sidecar.sidecar_prices) ? sidecar.sidecar_prices : [];
  const needsReview = Array.isArray(sidecar.needs_review) ? sidecar.needs_review : [];
  const quarantined = Array.isArray(sidecar.quarantined_final_prices) ? sidecar.quarantined_final_prices : [];

  let candidates = prices.map((entry, index) => {
    const reasonCodes = [];
    if (entry.reason_code) reasonCodes.push(asString(entry.reason_code));
    if (entry.reason) reasonCodes.push(asString(entry.reason));
    if (entry.amount_confidence) reasonCodes.push(`amount_confidence_${entry.amount_confidence}`);
    if (entry.pairing_confidence) reasonCodes.push(`pairing_confidence_${entry.pairing_confidence}`);

    return createCandidate({
      id: asString(entry.price_id) || `price_${index + 1}`,
      value: {
        amount: entry.amount,
        display: entry.display,
        description: entry.description || "",
      },
      source: mapPriceSource(entry.source),
      support: mapSupport(entry),
      evidence: evidenceFromPrice(entry),
      status: mapCandidateStatus(entry.candidate_status),
      reasonCodes,
    });
  });

  const selected = candidates.filter((candidate) => candidate.status === "selected");
  const hasQuarantine = candidates.some((candidate) => candidate.status === "quarantined") ||
    quarantined.length > 0 ||
    needsReview.length > 0;

  let resolution;
  if (!candidates.length) {
    resolution = {
      status: "unresolved",
      reasonCode: "insufficient_support",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    };
  } else if (hasQuarantine) {
    const primarySelected = selected[0];
    resolution = {
      status: "requires_review",
      ...(primarySelected ? { selectedCandidateId: primarySelected.id } : {}),
      reasonCode: selected.length
        ? "stronger_scope_pairing"
        : "conflicting_supported_candidates",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    };
    if (primarySelected) {
      candidates = selectCandidate(candidates, primarySelected.id);
    }
  } else if (selected.length === 1) {
    resolution = {
      status: "selected",
      selectedCandidateId: selected[0].id,
      reasonCode: selected[0].reasonCodes.some((code) => /scope|pairing|bundled|component/i.test(code))
        ? "stronger_scope_pairing"
        : "single_explicit_candidate",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    };
  } else if (selected.length > 1) {
    const equivalent = selected.every((candidate) =>
      asString(candidate.value?.amount) === asString(selected[0].value?.amount),
    );
    resolution = {
      status: "selected",
      selectedCandidateId: selected[0].id,
      reasonCode: equivalent ? "duplicate_equivalent_candidates" : "stronger_scope_pairing",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    };
  } else {
    resolution = {
      status: "unresolved",
      reasonCode: "insufficient_support",
      policyVersion: PRICE_POLICY_VERSION,
      resolvedBy: "price_policy",
    };
  }

  return createEnvelope({
    field: "service_options.prices",
    candidates,
    resolution,
  });
}

export function attachPriceDecisionEnvelope(alphaJson = {}) {
  if (!alphaJson?.normalization?.sidecar_price_reconciliation) return alphaJson;
  return attachDecisionEnvelopes(alphaJson, {
    prices: buildPriceDecisionEnvelope(alphaJson),
  });
}
