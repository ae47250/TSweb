import { normalizeToAlphaJsonV14 } from "./normalizeAlphaJson.js";

function normalizedComparableText(value) {
  return String(value || "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sameNormalizedText(left, right) {
  const normalizedLeft = normalizedComparableText(left);
  const normalizedRight = normalizedComparableText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function amountFromOption(option = {}) {
  const amount = Number(option.price?.amount ?? option.price?.min_amount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function optionDescription(option = {}) {
  return String(option.description || "").trim();
}

function clearAddressServerVerification(alphaJson = {}) {
  const flags = alphaJson.job?.service_address?.review_flags;
  if (!flags) return;
  delete flags.service_address_server_verified_td_edit;
  delete flags.service_address_server_verified_td_edit_value;
}

function clearOptionServerVerification(option = {}) {
  const flags = option.review_flags;
  if (!flags) return;
  delete flags.description_server_verified_td_edit;
  delete flags.description_server_verified_td_edit_value;
}

function findMatchingOption(options = [], target = {}, fallbackIndex = -1) {
  const targetAmount = amountFromOption(target);
  if (targetAmount) {
    const match = options.find((option) => amountFromOption(option) === targetAmount);
    if (match) return match;
  }
  return fallbackIndex >= 0 ? options[fallbackIndex] : null;
}

export function stampServerVerifiedTdEditProvenance(alphaJson = {}, {
  sourceAlphaJson = {},
  rawInput = "",
  intake = {},
} = {}) {
  const baseline = normalizeToAlphaJsonV14({}, rawInput, intake);

  clearAddressServerVerification(alphaJson);
  const addressFlags = sourceAlphaJson.job?.service_address?.review_flags || {};
  const currentAddress = String(alphaJson.job?.service_address?.display || "").trim();
  const baselineAddress = String(baseline.job?.service_address?.display || "").trim();
  const requestedAddress = String(addressFlags.service_address_edited_by_td_value || "").trim();
  if (
    addressFlags.service_address_edited_by_td &&
    currentAddress &&
    !sameNormalizedText(currentAddress, baselineAddress) &&
    sameNormalizedText(currentAddress, requestedAddress)
  ) {
    alphaJson.job.service_address.review_flags = {
      ...(alphaJson.job.service_address.review_flags || {}),
      service_address_server_verified_td_edit: true,
      service_address_server_verified_td_edit_value: currentAddress,
    };
  }

  const currentOptions = alphaJson.service_options?.items || [];
  const submittedOptions = sourceAlphaJson.service_options?.items || [];
  const baselineOptions = baseline.service_options?.items || [];
  currentOptions.forEach((option, index) => {
    clearOptionServerVerification(option);
    const submittedOption = findMatchingOption(submittedOptions, option, index) || {};
    const flags = submittedOption.review_flags || {};
    const currentDescription = optionDescription(option);
    const baselineOption = findMatchingOption(baselineOptions, option, index) || {};
    const baselineDescription = optionDescription(baselineOption);
    const requestedDescription = String(flags.description_edited_by_td_value || "").trim();
    if (
      flags.description_edited_by_td &&
      currentDescription &&
      !sameNormalizedText(currentDescription, baselineDescription) &&
      sameNormalizedText(currentDescription, requestedDescription)
    ) {
      option.review_flags = {
        ...(option.review_flags || {}),
        description_server_verified_td_edit: true,
        description_server_verified_td_edit_value: currentDescription,
      };
    }
  });

  return alphaJson;
}
