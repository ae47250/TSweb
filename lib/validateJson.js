function looksLikeBadAddress(address) {
  if (!address) return false;
  const text = String(address);
  return (
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) ||
    /\b(somewhere|maybe|wants?|storm mess|phone|call|later|email)\b/i.test(text)
  );
}

function addressLooksLikeJobText(address) {
  return Boolean(address) && String(address).split(/\s+/).length > 10 && /\b(remove|trim|cleanup|tree|limb|brush|haul|quote|estimate)\b/i.test(address);
}

function mayNeedCityOrState(address) {
  return Boolean(address) && /\b\d+\b/.test(address) && !/\b(Madison|Hanover|Indiana|IN)\b/i.test(address);
}

function hasClearWorkScope(description, options) {
  const optionText = options.map((option) => option.description || "").join(" ");
  return /\b(tree|trees|limb|limbs|branch|branches|stump|brush|oak|pine|maple|elm|storm\s+limbs?|debris|cleanup|trim|trimming)\b/i.test(`${description || ""} ${optionText}`);
}

function looksLikeMessyName(name) {
  if (!name) return false;
  return (
    /\b(customer|lady|guy|texted|maybe|phone|estimate|yesterday|cousin|office|call)\b/i.test(name) ||
    name.split(/\s+/).length > 4
  );
}

function optionLooksDirty(option) {
  return /\$|maybe|somewhere|lives?\b|email|phone/i.test(option?.description || "");
}

export function validateAlphaJson(input) {
  const json = structuredClone(input || {});
  const blocking = [];
  const warnings = [];
  const followUps = [];

  const address = json?.job?.service_address?.display?.trim();
  const description = json?.job?.description?.trim();
  const customerName = json?.customer?.name?.trim();
  const phone = json?.customer?.phone_display?.trim() || json?.customer?.phone_primary?.trim();
  const treeCount = json?.job?.tree_details?.tree_count?.trim();
  const options = Array.isArray(json?.service_options?.items) ? json.service_options.items : [];

  if (!address || /unknown|tbd|placeholder/i.test(address)) {
    blocking.push("Missing service address.");
    followUps.push("What is the exact service address for this job?");
  } else if (looksLikeBadAddress(address)) {
    blocking.push("Service address looks unclear.");
    followUps.push("What is the exact service address for this job?");
  }
  if (!phone) {
    blocking.push("Missing customer phone.");
    followUps.push("What phone number should Alpha Tree Service use for this customer?");
  }
  if (!treeCount && !hasClearWorkScope(description, options)) {
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
  if (options.length > 4 || json?.layout_flags?.over_normal_option_limit) {
    warnings.push("More than four options were provided. Only four normal customer options are supported.");
  }
  if (customerName && looksLikeMessyName(customerName)) {
    warnings.push("Customer name may need review.");
  }
  if (mayNeedCityOrState(address)) {
    warnings.push("Service address may need city or state.");
  }
  if (addressLooksLikeJobText(address)) {
    warnings.push("Service address may include extra job notes.");
  }
  if (options.some(optionLooksDirty)) {
    warnings.push("One or more option descriptions may need cleanup.");
  }

  const sortedOptions = options
    .map((option) => ({
      ...option,
      price: option.price || {},
      numericPrice: option.price?.amount ?? option.price?.min_amount ?? Number.MAX_SAFE_INTEGER,
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
    over_normal_option_limit: Boolean(json?.layout_flags?.over_normal_option_limit || options.length > 4),
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
