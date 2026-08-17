import { attachClaimGraph } from "./claimGraph.js";
import { attachContactDecisionEnvelopes } from "./contactDecisionEnvelope.js";
import { normalizeEmail, normalizePhoneCandidate } from "./contactNormalizer.js";
import { buildClaimGraphFromRaw } from "./detectClaimRelationships.js";
import { isCompleteServiceAddress } from "./addressResolver.js";
import { attachDecisionEnvelopes, createCandidate, selectCandidate } from "./decisionEnvelope.js";
import {
  applyOptionScopeInference,
  buildCustomerJobSummary,
  lockFactsAndCustomerWording,
  normalizeEditedServiceAddress,
} from "./normalizeAlphaJson.js";
import { attachPriceDecisionEnvelope } from "./priceDecisionEnvelope.js";
import { normalizeReviewerDecisionLog } from "./reviewerDecisionLog.js";
import {
  appendReviewerDecision,
  createReviewerDecision,
  reviewerDecisionFingerprint,
  REVIEWER_LEDGER_POLICY_VERSION,
} from "./reviewerDecisionLedger.js";
import { evaluateReadinessSafety } from "./readinessSafety.js";
import { canonicalReadinessField, readinessSafetyBlockingEnabled, validateReadinessDecisions } from "./readinessReview.js";
import {
  attachTreeCountDecisionEnvelope,
  buildTreeCountDecisionEnvelope,
} from "./treeCountDecisionEnvelope.js";
import {
  attachModelFieldCandidates,
  resolveFieldDecisionEnvelopes,
} from "./unifiedFieldResolution.js";

/**
 * Build and attach the additive claim graph from raw notes.
 * Does not alter selected AlphaJSON field values.
 */
export function attachPipelineClaimGraph(alphaJson = {}, rawInput = "") {
  const text = String(
    rawInput
    || alphaJson?.raw_input?.customer_text
    || "",
  );
  const graph = buildClaimGraphFromRaw(text);
  return attachClaimGraph(alphaJson, graph);
}

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function selectedCandidate(envelope) {
  if (envelope?.resolution?.status !== "selected") return null;
  const selectedId = envelope?.resolution?.selectedCandidateId;
  return (envelope?.candidates || []).find((candidate) => candidate.id === selectedId) || null;
}

function claimValueMatchesCandidate(candidate, claim, field) {
  if (field === "customer.phone") {
    return asString(candidate?.value).replace(/\D/g, "") === asString(claim?.value?.digits).replace(/\D/g, "");
  }
  if (field === "job.price") {
    return Number(candidate?.value?.amount) === Number(claim?.value?.amount);
  }
  return asString(candidate?.value).toLowerCase() === asString(claim?.value?.normalized || claim?.value?.raw).toLowerCase();
}

function candidateEvidenceMatchesClaim(candidate, claim) {
  const claimStart = Number(claim?.start);
  const claimEnd = Number(claim?.end);
  return (candidate?.evidence || []).some((evidence) => {
    if (Number.isFinite(claimStart) && Number.isFinite(claimEnd) && Number.isFinite(evidence.start) && Number.isFinite(evidence.end)) {
      return evidence.start < claimEnd && claimStart < evidence.end;
    }
    const candidateQuote = asString(evidence.quote).toLowerCase();
    const claimQuote = asString(claim?.evidence).toLowerCase();
    return Boolean(candidateQuote && claimQuote && (candidateQuote.includes(claimQuote) || claimQuote.includes(candidateQuote)));
  });
}

function promoteConfirmedCorrection(envelope, claimGraph, field) {
  if (!envelope) return envelope;
  const claimsById = new Map((claimGraph?.claims || []).map((claim) => [claim.id, claim]));
  const corrections = (claimGraph?.relationships || [])
    .filter((relationship) => relationship.confidence === "confirmed" && relationship.type === "supersedes")
    .map((relationship) => ({ relationship, claim: claimsById.get(relationship.from) }))
    .filter(({ claim }) => claim?.field === field)
    .sort((left, right) => (right.claim.start ?? -1) - (left.claim.start ?? -1));

  for (const { relationship, claim } of corrections) {
    const candidate = (envelope.candidates || []).find((item) =>
      claimValueMatchesCandidate(item, claim, field) &&
      (candidateEvidenceMatchesClaim(item, claim) || field === "job.price"),
    );
    if (!candidate) continue;
    return {
      ...envelope,
      candidates: selectCandidate(envelope.candidates, candidate.id),
      resolution: {
        ...envelope.resolution,
        status: "selected",
        selectedCandidateId: candidate.id,
        reasonCode: "explicit_correction",
        resolvedBy: envelope.field === "service_options.prices"
          ? "price_policy"
          : envelope.field === "job.service_address"
            ? "address_policy"
            : "contact_policy",
      },
      correction: {
        relationship,
        previousClaimId: relationship.to,
        claimId: claim.id,
      },
    };
  }
  return envelope;
}

function applySelectedPhoneValue(alphaJson) {
  const decisions = alphaJson?.normalization?.decisions || {};
  const phone = selectedCandidate(decisions.phone)?.value;
  if (phone) {
    alphaJson.customer = {
      ...(alphaJson.customer || {}),
      phone_primary: phone,
      phone_display: phone,
    };
  }
}

function applySelectedEmailValue(alphaJson) {
  const decisions = alphaJson?.normalization?.decisions || {};
  const email = selectedCandidate(decisions.email)?.value;
  if (email) {
    alphaJson.customer = {
      ...(alphaJson.customer || {}),
      email,
    };
  }
}

function applySelectedAddressValue(alphaJson, { allowAddressReviewOverride = false } = {}) {
  const decisions = alphaJson?.normalization?.decisions || {};
  const address = selectedCandidate(decisions.service_address)?.value;
  const addressEditedByTd = Boolean(alphaJson.job?.service_address?.review_flags?.service_address_edited_by_td);
  if (address && (!addressEditedByTd || allowAddressReviewOverride)) {
    alphaJson.job = {
      ...(alphaJson.job || {}),
      service_address: {
        ...(alphaJson.job?.service_address || {}),
        display: address,
      },
    };
  }
}

function canonicalReviewField(field) {
  const value = asString(field).trim();
  if (value === "customer.phone" || value === "customer.phone_display" || value === "customer.phone_primary") return "customer.phone";
  if (value === "customer.email") return "customer.email";
  if (value === "job.service_address" || value === "job.service_address.display") return "job.service_address";
  if (value === "job.tree_details.tree_count" || value === "job.tree_count") return "job.tree_details.tree_count";
  if (value === "service_options.prices" || /^service_options\.items\[\d+\]\.price$/.test(value)) return "service_options.prices";
  return "";
}

function comparableReviewValue(field, value) {
  if (field === "customer.phone") return asString(value).replace(/\D/g, "");
  if (field === "job.price") {
    const rawAmount = value && typeof value === "object" ? value.amount : value;
    const amount = typeof rawAmount === "number"
      ? rawAmount
      : Number(asString(rawAmount).replace(/[$,\s]/g, ""));
    return Number.isFinite(amount) && amount > 0 ? String(amount) : "";
  }
  return asString(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function reviewCandidateValueMatches(field, candidateValue, requestedValue) {
  if (requestedValue == null || requestedValue === "") return true;
  if (field === "service_options.prices") {
    return comparableReviewValue("job.price", candidateValue) === comparableReviewValue("job.price", requestedValue);
  }
  return comparableReviewValue(field, candidateValue) === comparableReviewValue(field, requestedValue);
}

function reviewerCandidateForValue(field, value, note = "", action = "entered_new_value") {
  const reasonCodes = action === "keep_original"
    ? ["reviewer_keep_original", "reviewer_override"]
    : ["reviewer_override"];
  if (field === "customer.phone") {
    const normalized = normalizePhoneCandidate(value);
    if (!normalized) return null;
    return {
      value: normalized.display,
      reasonCodes,
    };
  }
  if (field === "customer.email") {
    const normalized = normalizeEmail(value);
    if (!normalized) return null;
    return {
      value: normalized,
      reasonCodes,
    };
  }
  if (field === "job.service_address") {
    const normalized = normalizeEditedServiceAddress(value);
    if (!normalized || !isCompleteServiceAddress(normalized)) return null;
    return {
      value: normalized,
      reasonCodes,
    };
  }
  if (field === "job.tree_details.tree_count") {
    const text = asString(value).trim();
    const numeric = text.match(/\b([1-9]|10)\b/);
    const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    const number = numeric?.[1] || ({ one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" }[word?.[1]] || "");
    if (!number) return null;
    return {
      value: `${number} ${number === "1" ? "tree" : "trees"}`,
      reasonCodes,
    };
  }
  if (field === "service_options.prices") {
    const amount = Number(String(value?.amount ?? value).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      value: {
        amount,
        display: `$${amount.toLocaleString("en-US")}`,
        description: asString(value?.description),
      },
      reasonCodes,
    };
  }
  return null;
}

function reviewerCandidateId(field, index) {
  return `reviewer_${field.replace(/[^a-z0-9]+/gi, "_")}_${index + 1}`;
}

function reviewerEvidence(value, note) {
  const valueText = typeof value === "object" ? (value.display || value.amount || "") : value;
  const noteText = asString(note).trim();
  const quote = [asString(valueText).trim(), noteText].filter(Boolean).join(" — ");
  return quote ? [{ quote }] : [];
}

function selectedReviewerCandidate(envelope, entry, field) {
  const candidateId = asString(entry?.candidateId);
  if (!candidateId) return null;
  const candidate = (envelope?.candidates || []).find((item) => item.id === candidateId);
  if (!candidate || candidate.status === "quarantined") return null;
  if (!reviewCandidateValueMatches(field, candidate.value, entry.value)) return null;
  return candidate;
}

function applyReviewerCandidate(envelope, candidate, field) {
  if (!envelope || !candidate) return envelope;
  return {
    ...envelope,
    candidates: selectCandidate(envelope.candidates, candidate.id),
    resolution: {
      ...envelope.resolution,
      status: "selected",
      selectedCandidateId: candidate.id,
      suggestedCandidateId: undefined,
      reasonCode: "reviewer_override",
      reasonText: "A reviewer explicitly resolved this field.",
      resolvedBy: "reviewer",
    },
  };
}

function addReviewerCandidate(envelope, field, entry, index) {
  const value = reviewerCandidateForValue(field, entry.value, entry.note, entry.action);
  if (!value) return null;
  const candidate = createCandidate({
    id: reviewerCandidateId(field, index),
    value: value.value,
    source: "reviewer",
    support: "explicit",
    evidence: reviewerEvidence(value.value, entry.note),
    status: "selected",
    reasonCodes: value.reasonCodes,
  });
  return {
    ...envelope,
    candidates: selectCandidate([...(envelope?.candidates || []), candidate], candidate.id),
    resolution: {
      ...(envelope?.resolution || {}),
      status: "selected",
      selectedCandidateId: candidate.id,
      suggestedCandidateId: undefined,
      reasonCode: "reviewer_override",
      reasonText: "A reviewer explicitly resolved this field.",
      resolvedBy: "reviewer",
    },
  };
}

function optionIndexForReviewEntry(options, entry, selectedValue) {
  const optionId = asString(entry?.optionId);
  if (optionId) {
    const byLabel = options.findIndex((option) => option.label === optionId || option.id === optionId);
    if (byLabel >= 0) return byLabel;
    const numeric = Number(optionId);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < options.length) return numeric;
  }
  const amount = Number(selectedValue?.amount);
  if (Number.isFinite(amount)) {
    const byAmount = options.findIndex((option) => Number(option?.price?.amount) === amount);
    if (byAmount >= 0) return byAmount;
  }
  return options.length === 1 ? 0 : -1;
}

function applyReviewerPriceToOption(alphaJson, candidate, entry) {
  const options = Array.isArray(alphaJson.service_options?.items) ? alphaJson.service_options.items : [];
  const selectedValue = candidate?.value;
  const index = optionIndexForReviewEntry(options, entry, selectedValue);
  if (index < 0 || !selectedValue || !Number.isFinite(Number(selectedValue.amount))) return;
  options[index] = replaceOptionPrice(options[index], selectedValue.amount);
  alphaJson.service_options.items = options;
}

function applyReviewerDecisionLog(alphaJson, reviewerDecisionLog = []) {
  const entries = normalizeReviewerDecisionLog(reviewerDecisionLog)
    .filter((entry) => ["selected_candidate", "entered_new_value", "keep_original", "marked_business_change"].includes(entry.action));
  if (!entries.length) return { alphaJson, addressOverride: false, priceEntries: [] };

  let next = alphaJson;
  const decisions = { ...(next.normalization?.decisions || {}) };
  let addressOverride = false;
  const latestByField = new Map();
  const priceEntries = [];
  const appliedPriceEntries = [];
  entries.forEach((entry, index) => {
    const field = canonicalReviewField(entry.field);
    if (!field) return;
    if (field === "service_options.prices") {
      priceEntries.push({ entry, index });
      return;
    }
    latestByField.set(field, { entry, index });
  });

  for (const [field, { entry, index }] of latestByField) {
    const key = field === "customer.phone"
      ? "phone"
      : field === "customer.email"
        ? "email"
        : field === "job.service_address"
          ? "service_address"
          : "tree_count";
    const envelope = decisions[key];
    if (!envelope) continue;
    const candidate = entry.action === "selected_candidate"
      ? selectedReviewerCandidate(envelope, entry, field)
      : null;
    const resolved = candidate
      ? applyReviewerCandidate(envelope, candidate, field)
      : ["entered_new_value", "keep_original", "marked_business_change"].includes(entry.action)
        ? addReviewerCandidate(envelope, field, entry, index)
        : null;
    if (!resolved) continue;
    decisions[key] = resolved;
    if (field === "job.service_address") addressOverride = true;
  }

  if (priceEntries.length) {
    let priceEnvelope = decisions.prices;
    const selectedPriceIds = [];
    for (const { entry, index } of priceEntries) {
      if (!priceEnvelope) continue;
      const candidate = entry.action === "selected_candidate"
        ? selectedReviewerCandidate(priceEnvelope, entry, "service_options.prices")
        : null;
      const resolved = candidate
        ? applyReviewerCandidate(priceEnvelope, candidate, "service_options.prices")
        : ["entered_new_value", "keep_original", "marked_business_change"].includes(entry.action)
          ? addReviewerCandidate(priceEnvelope, "service_options.prices", entry, index)
          : null;
      if (!resolved) continue;
      const selected = selectedCandidate(resolved);
      if (!selected) continue;
      appliedPriceEntries.push({ ...entry, appliedCandidateId: selected.id });
      priceEnvelope = resolved;
      selectedPriceIds.push(selected.id);
    }
    if (selectedPriceIds.length > 1) {
      priceEnvelope = {
        ...priceEnvelope,
        candidates: priceEnvelope.candidates.map((candidate) => selectedPriceIds.includes(candidate.id)
          ? { ...candidate, status: "selected" }
          : candidate),
        resolution: {
          ...priceEnvelope.resolution,
          status: "selected",
          selectedCandidateId: selectedPriceIds[0],
          selectedCandidateIds: selectedPriceIds,
          suggestedCandidateId: undefined,
          reasonCode: "reviewer_override",
          reasonText: "A reviewer explicitly resolved this field.",
          resolvedBy: "reviewer",
        },
      };
    }
    decisions.prices = priceEnvelope;
  }

  next.normalization = { ...(next.normalization || {}), decisions };
  return { alphaJson: next, addressOverride, priceEntries: appliedPriceEntries };
}

function replaceOptionPrice(option, amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return option;
  return {
    ...option,
    price: {
      ...(option.price || {}),
      price_type: "fixed",
      amount: numericAmount,
      min_amount: null,
      max_amount: null,
      display: `$${numericAmount.toLocaleString("en-US")}`,
      is_unclear: false,
    },
  };
}

function reviewerPriceAmount(entry = {}) {
  const rawValue = entry.value && typeof entry.value === "object"
    ? entry.value.amount ?? entry.value.min_amount
    : entry.value;
  const amount = Number(asString(rawValue).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function applyReviewerPriceResolution(alphaJson, reviewerEntries = []) {
  const sidecar = alphaJson.normalization?.sidecar_price_reconciliation;
  if (!sidecar || !reviewerEntries.length) return;

  const selectedCandidateIds = new Set(
    reviewerEntries
      .filter((entry) => entry.action === "selected_candidate")
      .map((entry) => asString(entry.candidateId))
      .filter(Boolean),
  );
  const acceptedAmounts = new Set(
    reviewerEntries
      .map(reviewerPriceAmount)
      .filter((amount) => amount != null),
  );
  const unscopedValueResolution = reviewerEntries.some((entry) =>
    ["entered_new_value", "keep_original", "marked_business_change"].includes(entry.action) && !entry.optionId,
  );
  if (!selectedCandidateIds.size && !acceptedAmounts.size) return;

  function reviewerStatus(entry, id, amount) {
    if (selectedCandidateIds.has(id) || acceptedAmounts.has(Math.round(Number(amount)))) {
      return {
        ...entry,
        candidate_status: "accepted",
        reason_code: "accepted_reviewer_decision",
        reason: "A reviewer explicitly resolved this price candidate.",
      };
    }
    if (unscopedValueResolution && entry.candidate_status !== "accepted") {
      return {
        ...entry,
        candidate_status: "rejected",
        reason_code: "accepted_reviewer_rejection",
        reason: "A reviewer explicitly rejected this unresolved price candidate.",
      };
    }
    return entry;
  }

  const sidecarPrices = (sidecar.sidecar_prices || []).map((entry) =>
    reviewerStatus(entry, asString(entry.price_id), Number(entry.amount)),
  );
  const addOnInterpretations = (sidecar.add_on_interpretations || []).map((entry) =>
    reviewerStatus(entry, asString(entry.add_on_price_id), Number(entry.add_on_amount ?? entry.amount)),
  );
  const resolvedAmounts = new Set([
    ...sidecarPrices
      .filter((entry) => /^accepted_/.test(asString(entry.reason_code)))
      .map((entry) => Number(entry.amount)),
    ...addOnInterpretations
      .filter((entry) => /^accepted_/.test(asString(entry.reason_code)))
      .map((entry) => Number(entry.add_on_amount ?? entry.amount)),
    ...acceptedAmounts,
  ].filter((amount) => Number.isFinite(amount) && amount > 0).map(Math.round));

  alphaJson.normalization.sidecar_price_reconciliation = {
    ...sidecar,
    sidecar_prices: sidecarPrices,
    add_on_interpretations: addOnInterpretations,
    needs_review: (sidecar.needs_review || []).filter((entry) =>
      !resolvedAmounts.has(Math.round(Number(entry.amount))),
    ),
    final_price_gate: {
      ...(sidecar.final_price_gate || {}),
      accepted_amounts: [
        ...(sidecar.final_price_gate?.accepted_amounts || []).filter((entry) =>
          !resolvedAmounts.has(Math.round(Number(entry.amount))),
        ),
        ...[...resolvedAmounts].map((amount) => ({
          amount,
          display: `$${amount.toLocaleString("en-US")}`,
        })),
      ],
    },
  };
}

function normalizedOptionScope(option = {}) {
  return asString([option.title, option.description].filter(Boolean).join(" "))
    .toLowerCase()
    .replace(/\b(?:actually|instead|make\s+that|scratch\s+that|correction)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendPriceCorrectionReview(alphaJson, priceEnvelope, message) {
  const selected = selectedCandidate(priceEnvelope);
  priceEnvelope.resolution = {
    ...priceEnvelope.resolution,
    status: "requires_review",
    ...(selected ? { selectedCandidateId: selected.id } : {}),
    reasonCode: "conflicting_supported_candidates",
    resolvedBy: "price_policy",
  };
  const sidecar = alphaJson.normalization?.sidecar_price_reconciliation;
  if (sidecar) {
    const selectedAmount = Number(selected?.value?.amount);
    const review = {
      kind: "explicit_correction_target",
      price_id: selected?.id || "",
      amount: Number.isFinite(selectedAmount) ? selectedAmount : null,
      display: selected?.value?.display || "",
      reason: message,
    };
    alphaJson.normalization.sidecar_price_reconciliation = {
      ...sidecar,
      needs_review: [
        ...(sidecar.needs_review || []).filter((entry) => entry.kind !== "explicit_correction_target"),
        review,
      ],
    };
  }
  alphaJson.validation = {
    ...(alphaJson.validation || {}),
    price_reconciliation_blocking_errors: [
      ...(alphaJson.validation?.price_reconciliation_blocking_errors || []).filter(
        (entry) => !String(entry).includes("explicit price correction"),
      ),
      `The explicit price correction could not be bound to one customer option: ${message}`,
    ],
    price_reconciliation_follow_ups: [
      ...(alphaJson.validation?.price_reconciliation_follow_ups || []),
      `Confirm which option the corrected price ${selected?.value?.display || ""} replaces.`,
    ],
  };
}

function applyPriceCorrection(alphaJson, priceEnvelope) {
  const correction = priceEnvelope?.correction;
  const selected = selectedCandidate(priceEnvelope);
  if (
    !correction ||
    priceEnvelope?.resolution?.status !== "selected" ||
    priceEnvelope?.resolution?.reasonCode !== "explicit_correction" ||
    !selected ||
    !Number.isFinite(Number(selected.value?.amount))
  ) return;

  const claims = new Map((alphaJson.normalization?.claim_graph?.claims || []).map((claim) => [claim.id, claim]));
  const previousClaim = claims.get(correction.previousClaimId);
  const previousAmount = Number(previousClaim?.value?.amount);
  const selectedAmount = Number(selected.value.amount);
  const options = Array.isArray(alphaJson.service_options?.items) ? alphaJson.service_options.items : [];
  if (!Number.isFinite(previousAmount) || previousAmount <= 0) {
    appendPriceCorrectionReview(alphaJson, priceEnvelope, "the superseded source price was not found");
    return;
  }

  const previousMatches = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => Number(option?.price?.amount) === previousAmount);
  const targetMatches = previousMatches.length === 0 && options.length === 1
    ? [{ option: options[0], index: 0 }]
    : previousMatches;
  if (targetMatches.length !== 1) {
    appendPriceCorrectionReview(
      alphaJson,
      priceEnvelope,
      targetMatches.length === 0
        ? "no existing option has the superseded price"
        : `${targetMatches.length} options have the superseded price`,
    );
    return;
  }

  const target = targetMatches[0].option;
  const targetScope = normalizedOptionScope(target);
  const duplicateIndexes = options
    .map((option, index) => ({ option, index }))
    .filter(({ option, index }) => index !== targetMatches[0].index && Number(option?.price?.amount) === selectedAmount);
  const unsafeDuplicates = duplicateIndexes.filter(({ option }) => {
    const sameSelectedCandidate = option.sidecar_price_id === selected.id;
    const correctionGenerated = /\b(?:actually|instead|make\s+that|scratch\s+that|correction)\b/i.test(
      asString([option.title, option.description].filter(Boolean).join(" ")),
    );
    const sameScope = normalizedOptionScope(option) === targetScope;
    return !(sameSelectedCandidate || correctionGenerated || sameScope);
  });
  if (unsafeDuplicates.length) {
    appendPriceCorrectionReview(
      alphaJson,
      priceEnvelope,
      `${unsafeDuplicates.length} other option${unsafeDuplicates.length === 1 ? " has" : "s have"} the corrected price without a unique correction binding`,
    );
    return;
  }

  const correctedTarget = {
    ...replaceOptionPrice(target, selectedAmount),
    source: "explicit_price_correction",
    sidecar_price_id: selected.id,
    sidecar_price_reconciliation: {
      ...(target.sidecar_price_reconciliation || {}),
      price_id: selected.id,
      previous_price_id: target.sidecar_price_id || "",
      action: "applied_explicit_correction",
    },
    price_review_warning: false,
    review_flags: {
      ...(target.review_flags || {}),
      add_on_interpretation_unclear: false,
      price_warning: "",
    },
  };
  const duplicateIndexSet = new Set(duplicateIndexes.map(({ index }) => index));
  alphaJson.service_options.items = options
    .map((option, index) => {
      if (index === targetMatches[0].index) return correctedTarget;
      if (duplicateIndexSet.has(index)) return null;
      return option;
    })
    .filter(Boolean)
    .map((option, index) => ({
      ...option,
      label: `Option ${String.fromCharCode(65 + index)}`,
      sort_order: index + 1,
      raw_label: "",
    }));

  const sidecar = alphaJson.normalization?.sidecar_price_reconciliation;
  if (sidecar) {
    alphaJson.normalization.sidecar_price_reconciliation = {
      ...sidecar,
      sidecar_prices: (sidecar.sidecar_prices || []).map((price) => price.price_id === selected.id
        ? { ...price, candidate_status: "accepted", reason_code: "accepted_explicit_correction", reason: "Confirmed correction replaced the earlier price." }
        : Number(price.amount) === previousAmount
          ? { ...price, candidate_status: "rejected", reason_code: "superseded_by_explicit_correction", reason: "This earlier price was superseded by a confirmed later correction." }
          : price),
      needs_review: (sidecar.needs_review || []).filter((entry) =>
        entry.price_id !== selected.id && Number(entry.amount) !== selectedAmount,
      ),
      quarantined_final_prices: (sidecar.quarantined_final_prices || []).filter((entry) =>
        entry.price_id !== selected.id && Number(entry.amount) !== selectedAmount,
      ),
      final_price_gate: {
        ...(sidecar.final_price_gate || {}),
        accepted_amounts: [
          ...(sidecar.final_price_gate?.accepted_amounts || [])
            .filter((entry) => Number(entry.amount) !== previousAmount && Number(entry.amount) !== selectedAmount),
          { amount: selectedAmount, display: selected.value.display || `$${selectedAmount.toLocaleString("en-US")}` },
        ],
        correction: {
          previous_amount: previousAmount,
          corrected_amount: selectedAmount,
          previous_claim_id: correction.previousClaimId,
          corrected_claim_id: correction.claimId,
        },
      },
    };
  }

  priceEnvelope.candidates = (priceEnvelope.candidates || []).map((candidate) => {
    if (candidate.id === selected.id) return { ...candidate, status: "selected" };
    if (Number(candidate.value?.amount) === previousAmount) return { ...candidate, status: "rejected" };
    return candidate;
  });

  alphaJson.validation = {
    ...(alphaJson.validation || {}),
    price_reconciliation_blocking_errors: (alphaJson.validation?.price_reconciliation_blocking_errors || []).filter((entry) => {
      const text = String(entry);
      return !/(?:Possible add-on price|High-confidence sidecar price|quarantined|not found in sidecar\/raw price evidence)/i.test(text)
        || (!text.includes(selected.value.display || "") && !text.includes(`$${previousAmount.toLocaleString("en-US")}`));
    }),
    price_reconciliation_follow_ups: (alphaJson.validation?.price_reconciliation_follow_ups || []).filter((entry) => {
      const text = String(entry);
      return !text.includes(selected.value.display || "") && !text.includes(`$${previousAmount.toLocaleString("en-US")}`);
    }),
  };
  priceEnvelope.correction = {
    ...correction,
    applied: true,
    targetOptionLabel: correctedTarget.label,
    previousAmount,
    selectedAmount,
  };
}

function applySelectedTreeValue(alphaJson) {
  const treeDecision = alphaJson.normalization?.decisions?.tree_count;
  const selectedTree = selectedCandidate(treeDecision);
  if (treeDecision?.resolution?.status !== "selected" || !selectedTree?.value) return;
  alphaJson.job = {
    ...(alphaJson.job || {}),
    tree_details: {
      ...(alphaJson.job?.tree_details || {}),
      tree_count: selectedTree.value,
    },
  };
  applyOptionScopeInference(alphaJson);
  alphaJson.job.description = buildCustomerJobSummary(alphaJson);
}

function applyReviewerPriceValues(alphaJson, reviewerPriceEntries = []) {
  const priceEnvelope = alphaJson.normalization?.decisions?.prices;
  for (const entry of reviewerPriceEntries) {
    const candidate = (priceEnvelope?.candidates || []).find((item) => item.id === entry.appliedCandidateId);
    if (candidate) applyReviewerPriceToOption(alphaJson, candidate, entry);
  }
  applyReviewerPriceResolution(alphaJson, reviewerPriceEntries);
}

export function applyResolvedEstimateFacts(alphaJson, {
  allowAddressReviewOverride = false,
  reviewerPriceEntries = [],
} = {}) {
  const decisions = alphaJson.normalization?.decisions || {};
  applySelectedTreeValue(alphaJson);
  applySelectedPhoneValue(alphaJson);
  if (reviewerPriceEntries.length) applyReviewerPriceValues(alphaJson, reviewerPriceEntries);
  else applyPriceCorrection(alphaJson, decisions.prices);
  applySelectedEmailValue(alphaJson);
  applySelectedAddressValue(alphaJson, { allowAddressReviewOverride });
}

function permanentActionForReviewerEntry(entry = {}) {
  if (entry.action === "marked_business_change") return "business_scope_change";
  if (entry.action === "entered_new_value") return "enter_new_value";
  if (entry.action === "rejected_candidate") return "reject_candidate";
  if (entry.action === "keep_original" || entry.action === "selected_candidate") return "accept_candidate";
  return "correct_extraction";
}

function currentReviewValue(alphaJson, entry = {}) {
  const field = canonicalReviewField(entry.field);
  if (field === "customer.phone") return alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "";
  if (field === "customer.email") return alphaJson.customer?.email || "";
  if (field === "job.service_address") return alphaJson.job?.service_address?.display || "";
  if (field === "job.tree_details.tree_count") return alphaJson.job?.tree_details?.tree_count || "";
  if (field === "service_options.prices") {
    const options = Array.isArray(alphaJson.service_options?.items) ? alphaJson.service_options.items : [];
    const index = optionIndexForReviewEntry(options, entry, entry.value);
    return index >= 0 ? structuredClone(options[index]?.price || null) : null;
  }
  return null;
}

function prepareReviewerEntries(alphaJson, reviewerEntries = []) {
  return reviewerEntries.map((entry) => {
    if (entry.action !== "keep_original") return entry;
    const current = currentReviewValue(alphaJson, entry);
    if (entry.value != null && entry.value !== "" && !reviewCandidateValueMatches(
      canonicalReviewField(entry.field),
      current,
      entry.value,
    )) {
      return null;
    }
    if (current == null || current === "" || (Array.isArray(current) && current.length === 0)) return null;
    return { ...entry, value: current };
  }).filter(Boolean);
}

function appendServerReviewerLedger(alphaJson, reviewerEntries = [], {
  actorId = "server_reviewer",
  beforeValues = new Map(),
} = {}) {
  let next = alphaJson;
  const estimateId = asString(next?.document?.number);
  const extractionVersion = asString(next?.schema_info?.schema_version) || "unknown";
  for (const entry of reviewerEntries) {
    if (!entry?.field) continue;
    const candidate = entry.candidateId
      ? (next.normalization?.decisions?.[entry.field === "customer.phone" ? "phone" : entry.field === "customer.email" ? "email" : entry.field === "job.service_address" ? "service_address" : entry.field === "job.tree_details.tree_count" ? "tree_count" : "prices"]?.candidates || [])
        .find((item) => item?.id === entry.candidateId)
      : null;
    const after = entry.value ?? candidate?.value ?? null;
    const decision = createReviewerDecision({
      estimateId,
      field: entry.field,
      action: permanentActionForReviewerEntry(entry),
      before: beforeValues.get(entry) ?? null,
      after,
      candidateIds: entry.candidateId ? [entry.candidateId] : [],
      candidateId: entry.candidateId,
      optionId: entry.optionId,
      findingId: entry.findingId,
      conflictId: entry.findingId,
      reasonCode: entry.reasonCode,
      reviewerNote: entry.note,
      actorId,
      extractionVersion,
      resolutionPolicyVersion: REVIEWER_LEDGER_POLICY_VERSION,
    });
    decision.id = `decision_${reviewerDecisionFingerprint({ ...decision, estimateId: "" }).slice(0, 24)}`;
    next = appendReviewerDecision(next, decision);
  }
  return next;
}

/**
 * Resolve trusted candidates and write the selected facts into the canonical estimate.
 * This is the last shared step before route validation and customer document rendering.
 */
export function attachPipelineDecisionEnvelopes(
  alphaJson = {},
  contactNormalizationResult = null,
  rawInput = "",
  reviewerDecisionLog = [],
  reviewContext = {},
) {
  const trustedRawInput = rawInput || alphaJson?.raw_input?.customer_text || "";
  let next = attachPipelineClaimGraph(alphaJson, trustedRawInput);
  next = attachContactDecisionEnvelopes(next, contactNormalizationResult);
  next = attachModelFieldCandidates(next, trustedRawInput);
  next = attachPriceDecisionEnvelope(next);
  const claimGraph = next.normalization?.claim_graph;
  const phoneDecision = promoteConfirmedCorrection(next.normalization?.decisions?.phone, claimGraph, "customer.phone");
  const priceDecision = promoteConfirmedCorrection(next.normalization?.decisions?.prices, claimGraph, "job.price");
  next = attachDecisionEnvelopes(next, {
    ...(phoneDecision ? { phone: phoneDecision } : {}),
    ...(priceDecision ? { prices: priceDecision } : {}),
  });

  const treeCountDecision = buildTreeCountDecisionEnvelope({
    selectedValue: next?.job?.tree_details?.tree_count || "",
    rawInput: trustedRawInput,
    treeCountOverride: next?.normalization?.field_evidence?.tree_count_override || "",
    claimGraph,
  });
  next = attachTreeCountDecisionEnvelope(next, treeCountDecision);
  next = attachDecisionEnvelopes(next, resolveFieldDecisionEnvelopes(next.normalization?.decisions || {}));

  applyResolvedEstimateFacts(next);
  const normalizedReviewerLog = normalizeReviewerDecisionLog(reviewerDecisionLog);
  const preReviewSafety = evaluateReadinessSafety({
    alphaJson: next,
    options: next?.service_options?.items || [],
  });
  const activeFindings = preReviewSafety.enforced_findings || [];
  const readinessEntries = normalizedReviewerLog.filter((entry) => entry.findingId);
  const legacyEntries = normalizedReviewerLog.filter((entry) => !entry.findingId);
  const readinessValidation = validateReadinessDecisions(activeFindings, readinessEntries, next);
  const activeFields = new Set(activeFindings.map((finding) => canonicalReadinessField(finding.field)).filter(Boolean));
  const strictReadinessDecisions = readinessSafetyBlockingEnabled();
  const allowedLegacyEntries = strictReadinessDecisions
    ? legacyEntries.filter((entry) => !activeFields.has(canonicalReadinessField(entry.field)))
    : legacyEntries;
  const trustedReviewerLog = prepareReviewerEntries(
    next,
    [...allowedLegacyEntries, ...readinessValidation.accepted],
  );
  next.review = {
    ...(next.review || {}),
    readiness_decisions: readinessValidation.accepted,
    readiness_decision_errors: readinessValidation.errors,
  };
  const beforeValues = new Map(trustedReviewerLog.map((entry) => [entry, currentReviewValue(next, entry)]));
  const reviewerResult = applyReviewerDecisionLog(next, trustedReviewerLog);
  applyResolvedEstimateFacts(reviewerResult.alphaJson, {
    allowAddressReviewOverride: reviewerResult.addressOverride,
    reviewerPriceEntries: reviewerResult.priceEntries,
  });
  reviewerResult.alphaJson.review = {
    ...(reviewerResult.alphaJson.review || {}),
    reviewer_decision_log: trustedReviewerLog,
  };
  const withLedger = appendServerReviewerLedger(reviewerResult.alphaJson, trustedReviewerLog, {
    actorId: asString(reviewContext.actorId).trim() || "server_reviewer",
    beforeValues,
  });
  return lockFactsAndCustomerWording(withLedger, trustedReviewerLog, { trustedResolution: true });
}
