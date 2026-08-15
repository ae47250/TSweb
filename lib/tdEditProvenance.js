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

function isScopePlaceholder(value) {
  return /^(?:work\s+scope\s+unclear|service\s+option\s+[A-E]|option\s+[A-E])$/i.test(
    String(value || "").trim(),
  );
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
    const submittedDescription = optionDescription(submittedOption);
    const validSubmittedEdit =
      flags.description_edited_by_td &&
      requestedDescription &&
      sameNormalizedText(submittedDescription, requestedDescription) &&
      !sameNormalizedText(requestedDescription, baselineDescription);
    if (validSubmittedEdit && !sameNormalizedText(currentDescription, requestedDescription)) {
      option.description = requestedDescription;
      option.scope_unclear = submittedOption.scope_unclear === false ? false : option.scope_unclear;
      if (isScopePlaceholder(submittedOption.title)) option.title = submittedOption.title;
    }
    if (
      validSubmittedEdit &&
      optionDescription(option) &&
      !sameNormalizedText(optionDescription(option), baselineDescription) &&
      sameNormalizedText(optionDescription(option), requestedDescription)
    ) {
      option.review_flags = {
        ...(option.review_flags || {}),
        description_server_verified_td_edit: true,
        description_server_verified_td_edit_value: optionDescription(option),
      };
    }
  });

  return alphaJson;
}
