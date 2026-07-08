function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function normalizePhoneDigits(value) {
  const digits = asString(value).replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function acceptedCandidate(fieldResult = {}) {
  const candidates = Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [];
  return candidates.find((candidate) => candidate.accepted) || null;
}

function validCandidateCount(fieldResult = {}, valueKey) {
  const candidates = Array.isArray(fieldResult.candidates) ? fieldResult.candidates : [];
  return candidates.filter((candidate) => asString(candidate[valueKey]) || asString(candidate.value)).length;
}

function hasWarnings(fieldResult = {}) {
  return Array.isArray(fieldResult.warnings) && fieldResult.warnings.length > 0;
}

function highConfidenceSingle(fieldResult = {}, valueKey) {
  const accepted = acceptedCandidate(fieldResult);
  if (!accepted) return null;
  if (accepted.confidence !== "high") return null;
  if (hasWarnings(fieldResult)) return null;
  if (validCandidateCount(fieldResult, valueKey) !== 1) return null;
  return accepted;
}

function pushUnique(items, item, keyFn) {
  const key = keyFn(item);
  if (!items.some((existing) => keyFn(existing) === key)) items.push(item);
}

function ensureNormalization(alphaJson) {
  alphaJson.normalization = {
    corrected_interpretation: "",
    corrections_made: [],
    uncertainties: [],
    low_confidence_spans: [],
    number_trace: [],
    field_evidence: {},
    ...(alphaJson.normalization || {}),
  };
  alphaJson.normalization.corrections_made = Array.isArray(alphaJson.normalization.corrections_made)
    ? alphaJson.normalization.corrections_made
    : [];
  alphaJson.normalization.uncertainties = Array.isArray(alphaJson.normalization.uncertainties)
    ? alphaJson.normalization.uncertainties
    : [];
  alphaJson.normalization.low_confidence_spans = Array.isArray(alphaJson.normalization.low_confidence_spans)
    ? alphaJson.normalization.low_confidence_spans
    : [];
  alphaJson.normalization.field_evidence = alphaJson.normalization.field_evidence && typeof alphaJson.normalization.field_evidence === "object"
    ? alphaJson.normalization.field_evidence
    : {};
}

function addFillCorrection(alphaJson, field, value) {
  pushUnique(
    alphaJson.normalization.corrections_made,
    {
      original: `missing ${field}`,
      corrected: value,
      reason: "Filled from high-confidence contact normalizer metadata.",
    },
    (item) => `${item.original}|${item.corrected}|${item.reason}`,
  );
}

function addConflict(alphaJson, field, parsedValue, contactValue, rawText) {
  pushUnique(
    alphaJson.normalization.uncertainties,
    {
      field,
      issue: "Parsed contact value differs from high-confidence contact normalizer metadata.",
      evidence: `parsed=${parsedValue}; contact_normalizer=${contactValue}`,
    },
    (item) => `${item.field}|${item.issue}|${item.evidence}`,
  );
  pushUnique(
    alphaJson.normalization.low_confidence_spans,
    {
      field,
      text: rawText || contactValue,
      reason: "Contact normalizer found a different value than the parsed customer contact field.",
      confidence: "low",
    },
    (item) => `${item.field}|${item.text}|${item.reason}`,
  );
}

export function applyContactNormalizationOverlay(alphaJson = {}, contactNormalizationResult = null) {
  const next = cloneJson(alphaJson);
  if (!contactNormalizationResult || typeof contactNormalizationResult !== "object") return next;

  next.customer = next.customer && typeof next.customer === "object" ? next.customer : {};
  ensureNormalization(next);

  const phoneCandidate = highConfidenceSingle(contactNormalizationResult.phone, "display");
  const phoneDisplay = asString(contactNormalizationResult.phone?.display || phoneCandidate?.display);
  const currentPhone = asString(next.customer.phone_display || next.customer.phone_primary);
  if (phoneCandidate && phoneDisplay) {
    next.normalization.field_evidence.contact_normalizer_phone = phoneDisplay;
    if (!currentPhone) {
      next.customer.phone_primary = phoneDisplay;
      next.customer.phone_display = phoneDisplay;
      next.normalization.field_evidence.phone = phoneDisplay;
      addFillCorrection(next, "customer.phone", phoneDisplay);
    } else if (normalizePhoneDigits(currentPhone) !== normalizePhoneDigits(phoneDisplay)) {
      addConflict(next, "customer.phone", currentPhone, phoneDisplay, phoneCandidate.raw);
    }
  }

  const emailCandidate = highConfidenceSingle(contactNormalizationResult.email, "value");
  const emailValue = asString(contactNormalizationResult.email?.value || emailCandidate?.value).toLowerCase();
  const currentEmail = asString(next.customer.email).toLowerCase();
  if (emailCandidate && emailValue) {
    next.normalization.field_evidence.contact_normalizer_email = emailValue;
    if (!currentEmail) {
      next.customer.email = emailValue;
      next.normalization.field_evidence.email = emailValue;
      addFillCorrection(next, "customer.email", emailValue);
    } else if (currentEmail !== emailValue) {
      addConflict(next, "customer.email", currentEmail, emailValue, emailCandidate.raw);
    }
  }

  return next;
}
