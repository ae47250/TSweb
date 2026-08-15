import { readinessOverrideStatus, normalizeReadinessDecisions } from "./readinessReview.js";
import { isCompleteServiceAddress } from "./addressResolver.js";

const ADDRESS_BLOCK_RE = /^(Missing service address|Service address looks unclear)\./i;
const CONTACT_BLOCK_RE = /^Missing customer phone or email\./i;
const CLEAR_PRICE_SCOPE_BLOCK_RE = /^(Work scope unclear; confirm what this price covers)\.?/i;

export function normalizeReviewOverrides(value = {}) {
  return {
    missingAddress: Boolean(value.missingAddress),
    missingPhone: Boolean(value.missingPhone),
    missingEmail: Boolean(value.missingEmail),
    missingContact: Boolean(value.missingContact),
    unclearScopeWithPrice: Boolean(value.unclearScopeWithPrice),
    readinessDecisions: normalizeReadinessDecisions(
      value.readinessDecisions || value.decisions || [],
    ),
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
  if (CONTACT_BLOCK_RE.test(text)) return "missingPhone";
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
      key: "missingPhone",
      title: "Customer phone number missing",
      message: "Customer phone number is missing. Phone is the preferred contact method for this estimate.",
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

function overrideAccepted(key, normalized, alphaJson = {}) {
  if (key === "missingContact") return normalized.missingContact || (normalized.missingPhone && normalized.missingEmail);
  if (key === "missingAddress") {
    return Boolean(normalized.missingAddress) && isCompleteServiceAddress(alphaJson?.job?.service_address?.display);
  }
  return Boolean(normalized[key]);
}

export function getBlockingOverrideStatus(validation = {}, overrides = {}, alphaJson = {}) {
  const normalized = normalizeReviewOverrides(overrides);
  const blockingErrors = validation.blocking_errors || [];
  const structuralBlockingErrors = Array.isArray(validation.structural_blocking_errors)
    ? validation.structural_blocking_errors
    : [];
  const hasStructuredReadiness = Boolean(validation?.readiness_safety);
  const readinessBlockingErrors = new Set(
    hasStructuredReadiness && Array.isArray(validation?.readiness_safety_blocking_errors)
      ? validation.readiness_safety_blocking_errors
      : [],
  );
  const contactWarning = contactWarningForState(customerContactState(alphaJson));
  const hasContactBlock = blockingErrors.some((error) => CONTACT_BLOCK_RE.test(String(error || "").trim()));
  const requiredKeys = [
    ...new Set([
      ...blockingErrors
        .map((error) => overrideKeyForBlockingErrorWithContext(error, alphaJson))
        .filter(Boolean),
      ...(hasContactBlock && contactWarning ? [contactWarning.key] : []),
    ]),
  ];
  const remainingBlockingErrors = [
    ...blockingErrors.filter((error) => {
      if (readinessBlockingErrors.has(error)) return false;
      const key = overrideKeyForBlockingErrorWithContext(error, alphaJson);
      return !key || !overrideAccepted(key, normalized, alphaJson);
    }),
    ...structuralBlockingErrors.filter((error) => !blockingErrors.includes(error)),
  ];
  const addressWarning = blockingErrors.map(addressWarningForBlockingError).find(Boolean);
  const scopeWarning = blockingErrors.map((error) => scopeWarningForBlockingError(error, alphaJson)).find(Boolean);
  const structuredReadiness = readinessOverrideStatus(validation, normalized, alphaJson);
  const readinessWarning = hasStructuredReadiness
    ? {
      key: "readinessSafety",
      title: "Readiness safety findings",
      message: "Each readiness finding must be resolved with a matching field decision.",
      findings: structuredReadiness.remainingReadinessFindings.map((finding) => ({
        findingId: finding.finding_id,
        field: finding.field,
        reason: finding.reason,
      })),
    }
    : null;
  const acceptedOverrideWarnings = [];

  if (addressWarning && overrideAccepted("missingAddress", normalized, alphaJson)) {
    acceptedOverrideWarnings.push(addressWarning);
  }
  if (contactWarning && overrideAccepted(contactWarning.key, normalized, alphaJson)) {
    acceptedOverrideWarnings.push(contactWarning);
  }
  if (scopeWarning && overrideAccepted("unclearScopeWithPrice", normalized, alphaJson)) {
    acceptedOverrideWarnings.push(scopeWarning);
  }
  if (hasStructuredReadiness) {
    acceptedOverrideWarnings.push(...structuredReadiness.acceptedOverrideWarnings);
  }

  const missingAcceptedWarnings = requiredKeys.filter((key) => !overrideAccepted(key, normalized, alphaJson));
  const structuredReadinessBlocking = hasStructuredReadiness && validation?.readiness_safety_pdf_blocking_enabled
    ? structuredReadiness.remainingReadinessFindings.map((finding) => `Readiness check [${finding.finding_id}]: ${finding.reason}`)
    : [];
  const finalRemainingBlockingErrors = [
    ...remainingBlockingErrors,
    ...structuredReadinessBlocking.filter((error) => !remainingBlockingErrors.includes(error)),
  ];

  const readinessDecisionErrors = hasStructuredReadiness && Array.isArray(validation?.readiness_decision_errors)
    ? validation.readiness_decision_errors
    : [];

  return {
    canProceed: finalRemainingBlockingErrors.length === 0 && missingAcceptedWarnings.length === 0,
    needsAddressOverride: requiredKeys.includes("missingAddress"),
    needsContactOverride: requiredKeys.includes("missingContact"),
    needsPhoneOverride: requiredKeys.includes("missingPhone"),
    needsEmailOverride: requiredKeys.includes("missingEmail"),
    needsScopeOverride: requiredKeys.includes("unclearScopeWithPrice"),
    needsReadinessOverride: structuredReadinessBlocking.length > 0,
    remainingBlockingErrors: finalRemainingBlockingErrors,
    structuralBlockingErrors,
    acceptedOverrideWarnings,
    contactWarning,
    addressWarning,
    scopeWarning,
    readinessWarning,
    readinessDecisions: structuredReadiness.decisions,
    clearedReadinessFindingIds: structuredReadiness.clearedFindingIds,
    readinessDecisionErrors,
  };
}
