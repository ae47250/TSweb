const ADDRESS_BLOCK_RE = /^(Missing service address|Service address looks unclear)\./i;
const CONTACT_BLOCK_RE = /^Missing customer phone or email\./i;
const CLEAR_PRICE_SCOPE_BLOCK_RE = /^(Unclear work scope: remove, trim, or another service|Property responsibility or work scope is unclear|Work scope unclear; confirm what this price covers)\.?/i;

export function normalizeReviewOverrides(value = {}) {
  return {
    missingAddress: Boolean(value.missingAddress),
    missingPhone: Boolean(value.missingPhone),
    missingEmail: Boolean(value.missingEmail),
    missingContact: Boolean(value.missingContact),
    unclearScopeWithPrice: Boolean(value.unclearScopeWithPrice),
  };
}

function addressWarningForBlockingError(error) {
  const text = String(error || "").trim();
  if (/^Missing service address\./i.test(text)) {
    return {
      key: "missingAddress",
      title: "Service address missing",
      message: "Service address is missing, but was OK'd when the estimate was created.",
    };
  }

  if (/^Service address looks unclear\./i.test(text)) {
    return {
      key: "missingAddress",
      title: "Service address not clear",
      message: "Service address is not clear, but was OK'd when the estimate was created.",
    };
  }

  return null;
}

function overrideKeyForBlockingError(error) {
  const text = String(error || "").trim();
  if (ADDRESS_BLOCK_RE.test(text)) return "missingAddress";
  if (CONTACT_BLOCK_RE.test(text)) return "missingContact";
  return "";
}

function hasFirmOptionPrice(alphaJson = {}) {
  const options = Array.isArray(alphaJson.service_options?.items) ? alphaJson.service_options.items : [];
  return options.some((option) => {
    const amount = Number(option?.price?.amount ?? option?.price?.min_amount);
    return Boolean(option?.price?.display) && Number.isFinite(amount) && amount > 0 && !option?.price?.is_unclear;
  });
}

function scopeWarningForBlockingError(error, alphaJson) {
  const text = String(error || "").trim();
  if (!CLEAR_PRICE_SCOPE_BLOCK_RE.test(text) || !hasFirmOptionPrice(alphaJson)) return null;
  return {
    key: "unclearScopeWithPrice",
    title: "Work scope unclear",
    message: "Work scope is unclear, but the displayed price was OK'd when the estimate was created.",
  };
}

function overrideKeyForBlockingErrorWithContext(error, alphaJson) {
  const key = overrideKeyForBlockingError(error);
  if (key) return key;
  return scopeWarningForBlockingError(error, alphaJson)?.key || "";
}

function customerContactState(alphaJson = {}) {
  const phone = alphaJson.customer?.phone_display || alphaJson.customer?.phone_primary || "";
  const email = alphaJson.customer?.email || "";
  return {
    hasPhone: Boolean(String(phone).trim()),
    hasEmail: Boolean(String(email).trim()),
  };
}

function contactWarningForState({ hasPhone, hasEmail }) {
  if (!hasPhone && !hasEmail) {
    return {
      key: "missingContact",
      title: "Customer phone number and email missing",
      message: "Customer phone number and email are missing. Sending Estimate SMS and Email will not be available.",
    };
  }

  if (!hasPhone) {
    return {
      key: "missingPhone",
      title: "Customer phone number missing",
      message: "Customer phone number is missing, but email is given. Sending Estimate SMS will not be available.",
    };
  }

  if (!hasEmail) {
    return {
      key: "missingEmail",
      title: "Customer email missing",
      message: "Customer email is missing, but phone number is given. Sending Estimate Email will not be available.",
    };
  }

  return null;
}

function overrideAccepted(key, normalized) {
  if (key === "missingContact") return normalized.missingContact || (normalized.missingPhone && normalized.missingEmail);
  return Boolean(normalized[key]);
}

export function getBlockingOverrideStatus(validation = {}, overrides = {}, alphaJson = {}) {
  const normalized = normalizeReviewOverrides(overrides);
  const blockingErrors = validation.blocking_errors || [];
  const contactWarning = contactWarningForState(customerContactState(alphaJson));
  const requiredKeys = [
    ...new Set([
      ...blockingErrors.map((error) => overrideKeyForBlockingErrorWithContext(error, alphaJson)).filter(Boolean),
      ...(contactWarning ? [contactWarning.key] : []),
    ]),
  ];
  const remainingBlockingErrors = blockingErrors.filter((error) => {
    const key = overrideKeyForBlockingErrorWithContext(error, alphaJson);
    return !key || !overrideAccepted(key, normalized);
  });
  const addressWarning = blockingErrors.map(addressWarningForBlockingError).find(Boolean);
  const scopeWarning = blockingErrors.map((error) => scopeWarningForBlockingError(error, alphaJson)).find(Boolean);
  const acceptedOverrideWarnings = [];

  if (addressWarning && overrideAccepted("missingAddress", normalized)) {
    acceptedOverrideWarnings.push(addressWarning);
  }
  if (contactWarning && overrideAccepted(contactWarning.key, normalized)) {
    acceptedOverrideWarnings.push(contactWarning);
  }
  if (scopeWarning && overrideAccepted("unclearScopeWithPrice", normalized)) {
    acceptedOverrideWarnings.push(scopeWarning);
  }

  const missingAcceptedWarnings = requiredKeys.filter((key) => !overrideAccepted(key, normalized));

  return {
    canProceed: remainingBlockingErrors.length === 0 && missingAcceptedWarnings.length === 0,
    needsAddressOverride: requiredKeys.includes("missingAddress"),
    needsContactOverride: requiredKeys.includes("missingContact"),
    needsPhoneOverride: requiredKeys.includes("missingPhone"),
    needsEmailOverride: requiredKeys.includes("missingEmail"),
    needsScopeOverride: requiredKeys.includes("unclearScopeWithPrice"),
    remainingBlockingErrors,
    acceptedOverrideWarnings,
    contactWarning,
    addressWarning,
    scopeWarning,
  };
}
