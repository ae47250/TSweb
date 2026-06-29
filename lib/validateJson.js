export function validateAlphaJson(input) {
  const json = structuredClone(input || {});
  const blocking = [];
  const warnings = [];
  const followUps = [];

  const address = json?.job?.service_address?.display?.trim();
  const description = json?.job?.description?.trim();
  const phone = json?.customer?.phone_display?.trim() || json?.customer?.phone_primary?.trim();
  const treeCount = json?.job?.tree_details?.tree_count?.trim();
  const options = Array.isArray(json?.service_options?.items) ? json.service_options.items : [];

  if (!address || /unknown|tbd|placeholder/i.test(address)) {
    blocking.push("Missing service address.");
    followUps.push("What is the exact service address for this job?");
  }
  if (!phone) {
    blocking.push("Missing customer phone.");
    followUps.push("What phone number should Alpha Tree Service use for this customer?");
  }
  if (!treeCount && !/\btree|trees|limb|stump|brush\b/i.test(description || "")) {
    blocking.push("Missing tree count or clear scope.");
    followUps.push("How many trees, limbs, stumps, or brush areas are included?");
  }
  if (!description) {
    blocking.push("Missing job description.");
    followUps.push("What work is being quoted?");
  }
  if (options.length < 1) {
    blocking.push("Missing priced service option.");
    followUps.push("What priced option should appear on the estimate?");
  }
  if (options.length > 4) {
    warnings.push("More than four options were provided. Only four normal customer options are supported.");
  }

  const sortedOptions = options
    .map((option) => ({
      ...option,
      price: option.price || {},
      numericPrice: option.price?.amount ?? option.price?.min_amount ?? 0,
    }))
    .sort((a, b) => Number(a.numericPrice) - Number(b.numericPrice))
    .slice(0, 4)
    .map((option, index) => {
      const { numericPrice, ...rest } = option;
      return {
        ...rest,
        label: `Option ${String.fromCharCode(65 + index)}`,
        sort_order: index + 1,
      };
    });

  sortedOptions.forEach((option, index) => {
    if (!option.title || !option.description) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing title or description.`);
    }
    if (!option.price?.display || option.price?.is_unclear) {
      blocking.push(`${option.label || `Option ${index + 1}`} is missing a clear price.`);
    }
  });

  json.service_options = { ...(json.service_options || {}), items: sortedOptions };
  json.layout_flags = {
    ...(json.layout_flags || {}),
    option_count: sortedOptions.length,
    over_normal_option_limit: options.length > 4,
    long_notes: (json?.notes?.display_notes || "").length > 500,
    likely_two_page_pdf: (json?.job?.description || "").length + (json?.notes?.display_notes || "").length > 1200,
  };
  json.validation = {
    ...(json.validation || {}),
    blocking_errors: [...new Set(blocking)],
    warnings: [...new Set([...(json.validation?.warnings || []), ...warnings])],
    tree_dude_follow_ups: [...new Set(followUps)],
    missing_required_fields: [...new Set(blocking)],
    can_generate_pdf: blocking.length === 0,
    issue_status: blocking.length ? "blocking error + tree dude follow-up" : warnings.length ? "warning" : "none",
    blocking_errors_require_follow_up: true,
  };

  return {
    alphaJson: json,
    can_generate_pdf: blocking.length === 0,
    blocking_errors: json.validation.blocking_errors,
    warnings: json.validation.warnings,
    follow_ups: json.validation.tree_dude_follow_ups,
  };
}
