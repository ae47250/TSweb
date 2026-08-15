/**
 * Review-by-exception gate: surface only material decision-envelope cases.
 * Reads alphaJson.normalization.decisions; does not invent candidates.
 */

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function decisionsBag(alphaJson = {}) {
  const bag = alphaJson?.normalization?.decisions;
  return bag && typeof bag === "object" ? bag : {};
}

function evidenceStart(candidate = {}) {
  const first = Array.isArray(candidate.evidence) ? candidate.evidence[0] : null;
  return Number.isFinite(first?.start) ? Number(first.start) : Number.POSITIVE_INFINITY;
}

function evidenceQuote(candidate = {}) {
  const first = Array.isArray(candidate.evidence) ? candidate.evidence[0] : null;
  return asString(first?.quote || candidate.value).trim();
}

function displayCandidateValue(candidate = {}) {
  if (candidate.value && typeof candidate.value === "object") {
    return asString(candidate.value.display || candidate.value.description || candidate.value.amount);
  }
  return asString(candidate.value);
}

/**
 * Harmless duplicate or conflicting phone candidates worth a badge.
 * @param {object} envelope
 * @returns {object|null}
 */
export function buildPhoneException(envelope = null, alphaJson = {}) {
  if (!envelope || typeof envelope !== "object") return null;
  const reasonCode = asString(envelope.resolution?.reasonCode);
  if (
    reasonCode !== "duplicate_equivalent_candidates"
    && reasonCode !== "conflicting_supported_candidates"
  ) {
    return null;
  }

  const candidates = (Array.isArray(envelope.candidates) ? envelope.candidates : [])
    .filter((candidate) => candidate && candidate.status !== "quarantined");
  if (candidates.length < 2) return null;

  return {
    field: asString(envelope.field) || "customer.phone",
    currentValue: asString(alphaJson?.customer?.phone_display || alphaJson?.customer?.phone_primary),
    reasonCode,
    equivalent: reasonCode === "duplicate_equivalent_candidates",
    candidateCount: candidates.length,
    candidates: candidates.map((candidate) => ({
      id: asString(candidate.id),
      value: displayCandidateValue(candidate),
      source: asString(candidate.source),
      quote: evidenceQuote(candidate),
      status: asString(candidate.status),
      reasonCodes: Array.isArray(candidate.reasonCodes) ? candidate.reasonCodes : [],
    })),
  };
}

/**
 * Address candidates get their own review surface because an address decision
 * is not a contact-channel decision and must not share the phone override.
 */
export function buildAddressException(envelope = null, alphaJson = {}) {
  if (!envelope || typeof envelope !== "object") return null;
  const candidates = (Array.isArray(envelope.candidates) ? envelope.candidates : [])
    .filter((candidate) => candidate && candidate.status !== "quarantined");
  const reasonCode = asString(envelope.resolution?.reasonCode);
  const status = asString(envelope.resolution?.status);
  if (candidates.length < 2 && reasonCode !== "conflicting_supported_candidates" && status !== "requires_review") return null;
  const selectedId = asString(envelope.resolution?.suggestedCandidateId || envelope.resolution?.selectedCandidateId);
  const selected = candidates.find((candidate) => candidate.id === selectedId) || candidates[0];
  const originalValue = asString(alphaJson?.job?.service_address?.display);
  const original = candidates.find((candidate) => asString(candidate.value).toLowerCase() === originalValue.toLowerCase());
  return {
    field: asString(envelope.field) || "job.service_address",
    reasonCode: reasonCode || "conflicting_supported_candidates",
    reasonText: asString(envelope.resolution?.reasonText),
    originalValue,
    originalId: asString(original?.id),
    suggested: selected ? {
      id: asString(selected.id),
      value: displayCandidateValue(selected),
      quote: evidenceQuote(selected),
    } : null,
    candidates: candidates.map((candidate) => ({
      id: asString(candidate.id),
      value: displayCandidateValue(candidate),
      source: asString(candidate.source),
      quote: evidenceQuote(candidate),
      status: asString(candidate.status),
      reasonCodes: Array.isArray(candidate.reasonCodes) ? candidate.reasonCodes : [],
    })),
  };
}

/**
 * Tree-count correction / conflict worth an exception card.
 * @param {object} envelope
 * @returns {object|null}
 */
export function buildTreeScopeException(envelope = null) {
  if (!envelope || typeof envelope !== "object") return null;
  const reasonCode = asString(envelope.resolution?.reasonCode);
  const status = asString(envelope.resolution?.status);
  const resolvedBy = asString(envelope.resolution?.resolvedBy);

  // Once a reviewer has selected a value, the ordinary override control is enough.
  if (resolvedBy === "reviewer") return null;

  const candidates = Array.isArray(envelope.candidates) ? envelope.candidates.slice() : [];
  const rawNotes = candidates
    .filter((candidate) => candidate?.source === "raw_notes")
    .sort((a, b) => evidenceStart(a) - evidenceStart(b));
  const hasCorrectionCue = candidates.some((candidate) =>
    (Array.isArray(candidate?.reasonCodes) ? candidate.reasonCodes : [])
      .some((code) => /correction/i.test(asString(code))),
  );

  const material =
    reasonCode === "conflicting_supported_candidates"
    || (reasonCode === "explicit_correction" && status === "requires_review")
    || (reasonCode === "explicit_correction" && status === "selected")
    || (status === "requires_review" && candidates.length >= 2)
    || (hasCorrectionCue && rawNotes.length >= 2);

  if (!material) return null;

  if (rawNotes.length < 2 && candidates.filter((c) => c.status !== "rejected").length < 2) {
    return null;
  }

  const ordered = (rawNotes.length >= 2 ? rawNotes : candidates.filter((c) => c.status !== "rejected"))
    .sort((a, b) => evidenceStart(a) - evidenceStart(b));
  const earlier = ordered[0];
  const later = ordered[ordered.length - 1];
  const selectedId = asString(envelope.resolution?.selectedCandidateId);
  const suggested = candidates.find((candidate) => candidate.id === selectedId)
    || later
    || earlier;
  if (!suggested) return null;

  const nonSuggested = ordered.find((candidate) => candidate.id !== suggested.id) || earlier;
  const suggestedValue = displayCandidateValue(suggested);
  const otherValue = displayCandidateValue(nonSuggested);

  return {
    field: asString(envelope.field) || "job.tree_details.tree_count",
    reasonCode: reasonCode || "conflicting_supported_candidates",
    earlier: {
      id: asString(earlier.id),
      value: displayCandidateValue(earlier),
      quote: evidenceQuote(earlier),
    },
    later: {
      id: asString(later.id),
      value: displayCandidateValue(later),
      quote: evidenceQuote(later),
    },
    suggested: {
      id: asString(suggested.id),
      value: suggestedValue,
      quote: evidenceQuote(suggested),
    },
    alternative: {
      id: asString(nonSuggested?.id),
      value: otherValue,
      quote: evidenceQuote(nonSuggested),
    },
    combinedValue: otherValue && otherValue !== suggestedValue ? otherValue : suggestedValue,
    keepBothLabel: buildKeepBothLabel(otherValue, suggestedValue),
  };
}

function buildKeepBothLabel(otherValue, suggestedValue) {
  const other = asString(otherValue).toLowerCase();
  const suggested = asString(suggestedValue).toLowerCase();
  if (/2\s+trees?/.test(other) || /two/.test(other)) return "Keep both oaks";
  if (other && other !== suggested) return `Keep ${otherValue}`;
  return "Keep earlier scope";
}

/**
 * Price alternatives needing confirmation.
 * @param {object} envelope
 * @returns {object|null}
 */
export function buildPriceAlternativesException(envelope = null) {
  if (!envelope || typeof envelope !== "object") return null;
  const status = asString(envelope.resolution?.status);
  const reasonCode = asString(envelope.resolution?.reasonCode);
  const candidates = (Array.isArray(envelope.candidates) ? envelope.candidates : [])
    .filter((candidate) => {
      if (!candidate) return false;
      if (candidate.status === "rejected") return false;
      return candidate.status === "eligible"
        || candidate.status === "selected"
        || candidate.status === "quarantined";
    });

  const materialStatus = status === "requires_review";
  const materialReason = reasonCode === "stronger_scope_pairing"
    || reasonCode === "duplicate_equivalent_candidates"
    || reasonCode === "conflicting_supported_candidates";

  if ((!materialStatus && !materialReason) || candidates.length < 2) return null;

  return {
    field: asString(envelope.field) || "service_options.prices",
    reasonCode: reasonCode || "stronger_scope_pairing",
    status,
    needsConfirmation: materialStatus || reasonCode === "stronger_scope_pairing",
    candidates: candidates.map((candidate, index) => {
      const value = candidate.value && typeof candidate.value === "object" ? candidate.value : {};
      return {
        id: asString(candidate.id) || `price_${index + 1}`,
        amount: value.amount ?? null,
        display: asString(value.display) || (value.amount != null ? `$${value.amount}` : displayCandidateValue(candidate)),
        description: asString(value.description),
        status: asString(candidate.status),
        quote: evidenceQuote(candidate),
      };
    }),
  };
}

/**
 * @param {object} alphaJson
 * @returns {{ phone: object|null, address: object|null, treeScope: object|null, priceAlternatives: object|null }}
 */
export function getReviewDecisionExceptions(alphaJson = {}) {
  const decisions = decisionsBag(alphaJson);
  const phone = buildPhoneException(decisions.phone || null, alphaJson);
  return {
    // Equivalent duplicates are provenance, not an action the reviewer needs
    // to take. Conflicting values remain an actionable phone exception.
    phone: phone?.equivalent ? null : phone,
    phoneProvenance: phone?.equivalent ? phone : null,
    address: buildAddressException(decisions.service_address || null, alphaJson),
    treeScope: buildTreeScopeException(decisions.tree_count || null),
    priceAlternatives: buildPriceAlternativesException(decisions.prices || null),
  };
}
