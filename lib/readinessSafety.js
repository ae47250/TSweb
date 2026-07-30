/**
 * Shadow-mode readiness safety invariants.
 *
 * Computes whether an estimate would fail evidence/arbitration readiness rules.
 * Does not mutate blocking_errors or can_generate_pdf — callers attach the
 * result for offline metrics and future enforcement.
 */

export const READINESS_SAFETY_VERSION = "readiness-safety-v0.1";

export const READINESS_INVARIANT_CODES = Object.freeze([
  "UNRESOLVED_EXPLICIT_CORRECTION",
  "CONFLICTING_SUPPORTED_CANDIDATES",
  "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
  "UNSUPPORTED_CUSTOMER_FACING_VALUE",
  "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
  "SOURCE_FACT_OMITTED_WITHOUT_REASON",
  "GENERATED_STATEMENT_AS_EVIDENCE",
]);

const CRITICAL_DECISION_FIELDS = new Set([
  "phone",
  "email",
  "address",
  "service_address",
  "tree_count",
  "prices",
  "service_options.prices",
]);

const MATERIAL_SOURCE_FINAL_FACTS = new Set([
  "option_label",
  "price",
  "work_actions",
  "species",
  "tree_quantity",
  "stump_quantity",
  "stump_treatment",
  "debris_disposition",
  "target_qualifiers",
  "customer_phone",
  "customer_email",
  "service_address",
]);

const CORRECTION_EDGE_TYPES = new Set(["supersedes", "narrows"]);

const PRICE_RESOLVED_REASON_PREFIXES = [
  "accepted_",
  "rejected_",
  "quarantined_",
  "not_used_",
];

const GENERATED_EVIDENCE_FIELD_KEYS = [
  "customer_name",
  "phone",
  "email",
  "service_address",
  "tree_count",
  "tree_type",
  "work_scope",
  "price",
  "options",
];

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeComparable(value) {
  return asString(value)
    .toLowerCase()
    .replace(/[^\w\s@$./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactWhitespace(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function rawCustomerText(json = {}) {
  return asString(json?.raw_input?.customer_text || "");
}

function finalCustomerText(json = {}, options = []) {
  const optionText = asArray(options)
    .map((option) => [option?.title, option?.description, option?.price?.display].filter(Boolean).join(" "))
    .join(" ");
  return [
    json?.customer?.name,
    json?.customer?.phone_display,
    json?.customer?.phone_primary,
    json?.customer?.email,
    json?.job?.service_address?.display,
    json?.job?.description,
    json?.job?.tree_details?.tree_count,
    json?.job?.tree_details?.tree_type,
    optionText,
  ]
    .filter(Boolean)
    .join(" ");
}

function quoteFoundInRaw(quote, rawText) {
  const needle = normalizeComparable(quote);
  if (!needle || needle.length < 3) return true;
  const haystack = normalizeComparable(rawText);
  if (!haystack) return false;
  if (haystack.includes(needle)) return true;

  // Allow minor formatting drift (commas in prices, optional $).
  const looseNeedle = needle.replace(/\$/g, "").replace(/,/g, "");
  const looseHaystack = haystack.replace(/\$/g, "").replace(/,/g, "");
  return Boolean(looseNeedle) && looseHaystack.includes(looseNeedle);
}

function claimById(graph, id) {
  return asArray(graph?.claims).find((claim) => claim?.id === id) || null;
}

function claimValueText(claim) {
  const value = claim?.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return asString(value);
  }
  if (Array.isArray(value)) return value.map((entry) => asString(entry)).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return [
      value.action,
      value.digits,
      value.display,
      value.count,
      ...(Array.isArray(value.entities) ? value.entities : []),
    ]
      .map((entry) => asString(entry))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function claimAdoptedInFinal(claim, finalText) {
  if (!claim) return false;
  const evidence = compactWhitespace(claim.evidence);
  const valueText = compactWhitespace(claimValueText(claim));
  const haystack = normalizeComparable(finalText);
  if (!haystack) return false;
  if (evidence && haystack.includes(normalizeComparable(evidence))) return true;
  if (valueText && haystack.includes(normalizeComparable(valueText))) return true;
  return false;
}

function hasReviewerScopeApproval(json = {}, option = {}) {
  const overrides = json?.review?.overrides || {};
  if (overrides.unclearScopeWithPrice) return true;
  const flags = option?.review_flags || {};
  return Boolean(
    flags.description_server_verified_td_edit ||
    flags.source_to_final_verified_override ||
    flags.scope_approved_by_reviewer,
  );
}

function hasReviewerValueApproval(json = {}, result = {}) {
  if (result?.override_recorded) return true;
  const overrides = json?.review?.overrides || {};
  if (result?.fact === "service_address" && overrides.missingAddress) return true;
  if (result?.fact === "customer_phone" && (overrides.missingPhone || overrides.missingContact)) return true;
  if (result?.fact === "customer_email" && (overrides.missingEmail || overrides.missingContact)) return true;
  return false;
}

function priceReasonResolved(reasonCode = "") {
  const code = asString(reasonCode);
  if (!code) return false;
  return PRICE_RESOLVED_REASON_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function highConfidencePriceUnresolved(entry = {}) {
  if (asString(entry.amount_confidence) !== "high") return false;
  const status = asString(entry.candidate_status);
  const reasonCode = asString(entry.reason_code);
  const priceRole = asString(entry.price_role);

  // Ambiguous role that was still accepted into a final quote needs explicit review.
  if (priceRole === "AMBIGUOUS_PRICE_ROLE" && (status === "accepted" || /^accepted_/.test(reasonCode))) {
    return true;
  }

  if (status === "accepted" || status === "rejected" || status === "quarantined") {
    if (/^needs_review_/.test(reasonCode)) return true;
    if (reasonCode === "accepted_exact_final_price_with_warning") return true;
    return false;
  }
  if (priceReasonResolved(reasonCode)) return false;
  if (/^needs_review_/.test(reasonCode)) return true;
  if (!reasonCode && (status === "eligible" || !status)) return true;
  return !priceReasonResolved(reasonCode);
}

function decisionFieldIsCritical(field) {
  const name = asString(field);
  if (CRITICAL_DECISION_FIELDS.has(name)) return true;
  return /phone|email|address|tree_count|price/i.test(name);
}

function supportedCandidate(candidate = {}) {
  return ["explicit", "normalized_explicit"].includes(candidate.support) &&
    ["eligible", "selected"].includes(candidate.status);
}

function candidateValueKey(candidate = {}) {
  const value = candidate.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return normalizeComparable(value);
  }
  if (typeof value === "object") {
    if (value.amount != null) return normalizeComparable(value.amount);
    if (value.display != null) return normalizeComparable(value.display);
    if (value.count != null) return normalizeComparable(value.count);
    if (value.digits != null) return normalizeComparable(value.digits);
  }
  return normalizeComparable(JSON.stringify(value));
}

function supportedDistinctValues(candidates = []) {
  const values = [];
  for (const candidate of asArray(candidates).filter(supportedCandidate)) {
    const key = candidateValueKey(candidate);
    if (key && !values.includes(key)) values.push(key);
  }
  return values;
}

function conflictingSupportedCandidates(envelope = {}) {
  const status = envelope?.resolution?.status;
  const reasonCode = envelope?.resolution?.reasonCode;
  const distinct = supportedDistinctValues(envelope.candidates);

  // Equivalent restatements (e.g. "1 tree" vs "one maple" → same count) are not conflicts.
  if (distinct.length < 2) return false;

  if (status === "unresolved" || status === "requires_review") return true;
  if (reasonCode === "conflicting_supported_candidates") return true;
  return !envelope?.resolution?.selectedCandidateId;
}

function createFinding({
  invariant_code,
  reason,
  evidence = {},
} = {}) {
  return {
    invariant_code,
    would_block: true,
    reason: asString(reason),
    evidence: evidence && typeof evidence === "object" ? evidence : {},
  };
}

function evaluateUnresolvedExplicitCorrection(json, options) {
  const graph = json?.normalization?.claim_graph || {};
  const finalText = finalCustomerText(json, options);
  const findings = [];

  for (const edge of asArray(graph.relationships)) {
    if (!CORRECTION_EDGE_TYPES.has(edge?.type)) continue;
    const correction = claimById(graph, edge.from);
    const prior = claimById(graph, edge.to);
    if (!correction) continue;

    const correctionAdopted = claimAdoptedInFinal(correction, finalText);
    const priorStillSelected = claimAdoptedInFinal(prior, finalText) && !correctionAdopted;
    if (!correctionAdopted || priorStillSelected) {
      findings.push(createFinding({
        invariant_code: "UNRESOLVED_EXPLICIT_CORRECTION",
        reason: `Explicit ${edge.type} correction remains unresolved for ${correction.field || "field"}.`,
        evidence: {
          edge_type: edge.type,
          from_claim_id: edge.from,
          to_claim_id: edge.to,
          correction_evidence: correction.evidence || "",
          prior_evidence: prior?.evidence || "",
          correction_adopted: correctionAdopted,
          prior_still_selected: priorStillSelected,
        },
      }));
    }
  }

  return findings;
}

function evaluateConflictingSupportedCandidates(json) {
  const decisions = json?.normalization?.decisions || {};
  const findings = [];

  for (const [key, envelope] of Object.entries(decisions)) {
    if (!envelope || typeof envelope !== "object") continue;
    const field = envelope.field || key;
    if (!decisionFieldIsCritical(field)) continue;
    if (!conflictingSupportedCandidates(envelope)) continue;

    findings.push(createFinding({
      invariant_code: "CONFLICTING_SUPPORTED_CANDIDATES",
      reason: `Two or more supported candidates conflict on critical field ${field}.`,
      evidence: {
        field,
        decision_key: key,
        resolution_status: envelope.resolution?.status || "",
        reason_code: envelope.resolution?.reasonCode || "",
        supported_candidate_ids: asArray(envelope.candidates)
          .filter(supportedCandidate)
          .map((candidate) => candidate.id),
      },
    }));
  }

  return findings;
}

function evaluateHighConfidencePriceUnresolved(json, options = []) {
  const sidecar = json?.normalization?.sidecar_price_reconciliation || {};
  const findings = [];
  const entries = [
    ...asArray(sidecar.sidecar_prices).map((entry) => ({ ...entry, _kind: "sidecar_price" })),
    ...asArray(sidecar.add_on_interpretations).map((entry) => ({
      ...entry,
      amount: entry.add_on_amount ?? entry.amount,
      amount_confidence: entry.amount_confidence,
      reason_code: entry.reason_code,
      candidate_status: entry.candidate_status,
      price_role: entry.price_role,
      _kind: "add_on_interpretation",
    })),
  ];

  for (const entry of entries) {
    if (!highConfidencePriceUnresolved(entry)) continue;
    const amount = Number(entry.amount);
    findings.push(createFinding({
      invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
      reason: `High-confidence price ${Number.isFinite(amount) ? `$${Math.round(amount).toLocaleString("en-US")}` : "(unknown)"} has not been accepted, rejected, or explicitly reviewed.`,
      evidence: {
        kind: entry._kind,
        amount: Number.isFinite(amount) ? Math.round(amount) : null,
        amount_confidence: entry.amount_confidence || "",
        pairing_confidence: entry.pairing_confidence || "",
        candidate_status: entry.candidate_status || "",
        reason_code: entry.reason_code || "",
        price_role: entry.price_role || "",
      },
    }));
  }

  for (const [index, option] of asArray(options).entries()) {
    const flags = option?.review_flags || {};
    if (!flags.add_on_interpretation_downgraded_to_warning) continue;
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    findings.push(createFinding({
      invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
      reason: `${option.label || `Option ${index + 1}`} carries a high-confidence price warning that still needs explicit review.`,
      evidence: {
        kind: "option_warning_downgrade",
        option_label: option.label || "",
        amount: Number.isFinite(amount) ? Math.round(amount) : null,
        price_warning: flags.price_warning || "",
      },
    }));
  }

  return findings;
}

function evaluateAmbiguousMultiPriceReview(json, options = []) {
  const rawText = rawCustomerText(json);
  const priced = asArray(options).filter((option) => {
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    return Number.isFinite(amount) && amount > 0 && !option?.price?.is_unclear;
  });
  if (priced.length < 2) return [];

  const ambiguous = /\b(?:maybe|possibly|not sure|unclear|tbd|depending|if\s+(?:they|he|she|customer)\s+wants?|approximate(?:ly)?|around)\b/i.test(rawText);
  if (!ambiguous) return [];

  return [createFinding({
    invariant_code: "HIGH_CONFIDENCE_PRICE_UNRESOLVED",
    reason: "Multiple firm option prices were selected despite ambiguous source language; explicit review is required.",
    evidence: {
      kind: "ambiguous_multi_price",
      priced_option_count: priced.length,
      amounts: priced.map((option) => Math.round(Number(option.price.amount ?? option.price.min_amount))),
    },
  })];
}

function evaluateUnsupportedCustomerFacingValues(json, sourceFinalCoverage) {
  const findings = [];
  const results = asArray(sourceFinalCoverage?.results);

  for (const result of results) {
    if (!MATERIAL_SOURCE_FINAL_FACTS.has(result?.fact)) continue;
    if (!["missing", "changed"].includes(result?.status)) continue;
    if (hasReviewerValueApproval(json, result)) continue;

    findings.push(createFinding({
      invariant_code: "UNSUPPORTED_CUSTOMER_FACING_VALUE",
      reason: result.message ||
        `Final ${result.fact_label || result.fact} lacks source support and has no reviewer approval.`,
      evidence: {
        option_label: result.option_label || "",
        fact: result.fact,
        status: result.status,
        source_value: result.source_value || "",
        final_value: result.final_value || "",
        code: result.code || "",
      },
    }));
  }

  return findings;
}

function evaluateInferredScopeAffectsPrice(json, options) {
  const findings = [];

  for (const [index, option] of asArray(options).entries()) {
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    const hasFirmPrice = Number.isFinite(amount) && amount > 0 && !option?.price?.is_unclear;
    if (!hasFirmPrice) continue;
    if (hasReviewerScopeApproval(json, option)) continue;

    const flags = option?.review_flags || {};
    const inferred = Boolean(
      flags.inferred_base_scope ||
      flags.inferred_from_job_scope ||
      flags.inferred_from_higher_option ||
      flags.inferred_base_only_scope,
    );
    const unclear = Boolean(
      option?.scope_unclear ||
      flags.scope_unclear ||
      /\bwork\s+scope\s+unclear\b|\bscope\s+unclear\b/i.test(`${option?.title || ""} ${option?.description || ""}`),
    );

    if (!inferred && !unclear) continue;

    findings.push(createFinding({
      invariant_code: "INFERRED_SCOPE_AFFECTS_PRICE_UNAPPROVED",
      reason: unclear
        ? `${option.label || `Option ${index + 1}`} has unclear scope that materially affects a firm price without reviewer approval.`
        : `${option.label || `Option ${index + 1}`} uses inferred scope that materially affects price without reviewer approval.`,
      evidence: {
        option_label: option.label || "",
        amount: Math.round(amount),
        inferred,
        unclear,
        inferred_from_job_scope: flags.inferred_from_job_scope || "",
        inferred_from_higher_option: flags.inferred_from_higher_option || "",
      },
    }));
  }

  return findings;
}

function evaluateSourceFactOmittedWithoutReason(sourceFinalCoverage) {
  const findings = [];

  for (const result of asArray(sourceFinalCoverage?.results)) {
    if (!MATERIAL_SOURCE_FINAL_FACTS.has(result?.fact)) continue;
    if (result?.status !== "missing") continue;
    if (result?.override_recorded) continue;
    if (!asArray(result?.missing_source_values).length && !result?.source_value) continue;

    findings.push(createFinding({
      invariant_code: "SOURCE_FACT_OMITTED_WITHOUT_REASON",
      reason: result.message ||
        `Final option omits explicit source fact ${result.fact_label || result.fact} without a recorded reason.`,
      evidence: {
        option_label: result.option_label || "",
        fact: result.fact,
        missing_source_values: result.missing_source_values || [],
        source_value: result.source_value || "",
        code: result.code || "",
      },
    }));
  }

  return findings;
}

function evidenceQuotesFromFieldEvidence(fieldEvidence = {}) {
  const quotes = [];
  for (const key of GENERATED_EVIDENCE_FIELD_KEYS) {
    const value = fieldEvidence[key];
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const quote = compactWhitespace(entry);
        if (quote) quotes.push({ field: key, quote });
      }
      continue;
    }
    if (typeof value === "object") {
      const quote = compactWhitespace(value.quote || value.evidence || value.value || value.display);
      if (quote) quotes.push({ field: key, quote });
      continue;
    }
    const quote = compactWhitespace(value);
    if (quote) quotes.push({ field: key, quote });
  }
  return quotes;
}

function evidenceQuotesFromClaims(graph = {}) {
  return asArray(graph.claims)
    .map((claim) => ({
      field: `claim:${claim.field || "unknown"}`,
      quote: compactWhitespace(claim.evidence),
      claim_id: claim.id || "",
    }))
    .filter((entry) => entry.quote);
}

function evidenceQuotesFromDecisions(decisions = {}) {
  const quotes = [];
  for (const [key, envelope] of Object.entries(decisions || {})) {
    for (const candidate of asArray(envelope?.candidates)) {
      for (const evidence of asArray(candidate?.evidence)) {
        const quote = compactWhitespace(evidence?.quote);
        if (!quote) continue;
        quotes.push({
          field: `decision:${envelope.field || key}`,
          quote,
          candidate_id: candidate.id || "",
        });
      }
    }
  }
  return quotes;
}

function looksLikeGeneratedSummary(quote, json = {}) {
  const generatedSummary = compactWhitespace(json?.job?.description);
  const needle = normalizeComparable(quote);
  if (!needle) return false;
  if (generatedSummary && needle === normalizeComparable(generatedSummary)) return true;
  return /^(?:tree service work as described|full service .+ with .+ and .+|options include)\b/i.test(
    compactWhitespace(quote),
  );
}

function isPhoneStrippedRawVariant(quote, rawText) {
  const rawWithoutPhones = asString(rawText)
    .replace(/(?:\+?1[-./\s]?)?\(?\d{3}\)?[-./\s]?\d{3}[-./\s]?\d{4}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return quoteFoundInRaw(quote, rawWithoutPhones);
}

function evaluateGeneratedStatementAsEvidence(json) {
  const rawText = rawCustomerText(json);
  const findings = [];
  const quotes = [
    ...evidenceQuotesFromFieldEvidence(json?.normalization?.field_evidence || {}),
    ...evidenceQuotesFromClaims(json?.normalization?.claim_graph || {}),
    ...evidenceQuotesFromDecisions(json?.normalization?.decisions || {}),
  ];

  const seen = new Set();
  for (const entry of quotes) {
    const key = `${entry.field}::${normalizeComparable(entry.quote)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (quoteFoundInRaw(entry.quote, rawText)) continue;
    if (isPhoneStrippedRawVariant(entry.quote, rawText)) continue;
    // Only flag when evidence is literally the generated customer-facing summary
    // (or a known generated template), not lightly normalized source text.
    if (!looksLikeGeneratedSummary(entry.quote, json)) continue;

    findings.push(createFinding({
      invariant_code: "GENERATED_STATEMENT_AS_EVIDENCE",
      reason: `Generated or normalized statement is being treated as evidence for ${entry.field}.`,
      evidence: {
        field: entry.field,
        quote: entry.quote,
        claim_id: entry.claim_id || "",
        candidate_id: entry.candidate_id || "",
      },
    }));
  }

  return findings;
}

/**
 * Evaluate shadow readiness-safety invariants for an AlphaJSON payload.
 *
 * @param {object} params
 * @param {object} params.alphaJson
 * @param {object[]} [params.options]
 * @param {object} [params.sourceFinalCoverage]
 * @returns {{
 *   version: string,
 *   shadow_mode: true,
 *   would_block_pdf: boolean,
 *   invariant_codes: string[],
 *   findings: object[],
 *   invariants: object[],
 * }}
 */
export function evaluateReadinessSafety({
  alphaJson = {},
  options = null,
  sourceFinalCoverage = null,
} = {}) {
  const json = alphaJson || {};
  const finalOptions = Array.isArray(options)
    ? options
    : asArray(json?.service_options?.items);
  const coverage = sourceFinalCoverage ||
    json?.validation?.source_final_fact_coverage ||
    {};

  const findings = [
    ...evaluateUnresolvedExplicitCorrection(json, finalOptions),
    ...evaluateConflictingSupportedCandidates(json),
    ...evaluateHighConfidencePriceUnresolved(json, finalOptions),
    ...evaluateAmbiguousMultiPriceReview(json, finalOptions),
    ...evaluateUnsupportedCustomerFacingValues(json, coverage),
    ...evaluateInferredScopeAffectsPrice(json, finalOptions),
    ...evaluateSourceFactOmittedWithoutReason(coverage),
    ...evaluateGeneratedStatementAsEvidence(json),
  ];

  const invariantCodes = [...new Set(findings.map((finding) => finding.invariant_code))];
  const invariants = READINESS_INVARIANT_CODES.map((code) => {
    const codeFindings = findings.filter((finding) => finding.invariant_code === code);
    return {
      code,
      would_block: codeFindings.length > 0,
      finding_count: codeFindings.length,
      findings: codeFindings,
    };
  });

  return {
    version: READINESS_SAFETY_VERSION,
    shadow_mode: true,
    would_block_pdf: findings.length > 0,
    invariant_codes: invariantCodes,
    findings,
    invariants,
  };
}
